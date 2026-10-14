import * as THREE from 'three';
import { CAMERA_PROFILES } from '../core/constants';
import { PhysicsWorld } from '../physics/PhysicsWorld';

const DEG = Math.PI / 180;
/** Default camera elevation above the horizon (looking slightly down at Alice). */
const DEFAULT_PITCH = 11 * DEG;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.9;

const _tmpOffset = new THREE.Vector3();
const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpDir = new THREE.Vector3();
const _tmpDesired = new THREE.Vector3();
const _tmpLook = new THREE.Vector3();

/** Frame-rate independent exponential approach factor. */
const damp = (lambda: number, dt: number): number => 1 - Math.exp(-lambda * dt);

/**
 * Third-person orbit camera.
 *
 * `yaw`   – heading around Alice (radians). 0 puts the camera on +Z looking toward -Z.
 * `pitch` – ELEVATION of the camera above the horizon through Alice's head (radians, positive = camera higher,
 *           looking down at her).
 * Both are driven toward `yawGoal` / `pitchGoal` with critical damping so mouse input feels silky rather than
 * stepping. `applyMouseDelta` takes *radians* (the InputManager already applies sensitivity).
 */
export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3(0, 1.4, 0);

  private currentDistance: number = CAMERA_PROFILES.NORMAL.distance;
  private currentHeight: number = CAMERA_PROFILES.NORMAL.height;
  private targetFOV: number = CAMERA_PROFILES.NORMAL.fov;
  private profileFOV: number = CAMERA_PROFILES.NORMAL.fov;
  /** User zoom multiplier applied on top of the per-scale profile distance. */
  public zoom: number = 1.0;
  private zoomGoal: number = 1.0;
  private smoothedDistance: number = CAMERA_PROFILES.NORMAL.distance;

  private isCinematic: boolean = false;
  private cinematicStartPos: THREE.Vector3 = new THREE.Vector3();
  private cinematicStartLook: THREE.Vector3 = new THREE.Vector3();
  private cinematicTargetPos: THREE.Vector3 = new THREE.Vector3();
  private cinematicTargetLookAt: THREE.Vector3 = new THREE.Vector3();
  private cinematicProgress: number = 0;
  private cinematicDuration: number = 1.0;
  /** 1 -> 0 after leaving a cinematic: blends the last cinematic pose back into the follow camera. */
  private blendBack: number = 0;
  private lastCinematicPos: THREE.Vector3 = new THREE.Vector3();
  private lastCinematicLook: THREE.Vector3 = new THREE.Vector3();

  public yaw: number = 0;
  public pitch: number = DEFAULT_PITCH;
  public yawGoal: number = 0;
  public pitchGoal: number = DEFAULT_PITCH;
  private minPitch: number = -8 * DEG;
  private maxPitch: number = 72 * DEG;

  private physicsWorld: PhysicsWorld | null = null;
  public reduceMotion: boolean = false;
  private swayTime: number = 0;
  public currentState: string = 'S1_BANK';

  private smoothedTarget: THREE.Vector3 = new THREE.Vector3(0, 1.4, 0);
  private lookAtPoint: THREE.Vector3 = new THREE.Vector3(0, 1.4, 0);
  private collisionDistance: number = Infinity;
  private initialised: boolean = false;

  constructor(physicsWorld?: PhysicsWorld) {
    this.physicsWorld = physicsWorld || null;
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.05,
      1000
    );
    this.camera.position.set(0, 1.4, 3.2);
  }

  public setPhysicsWorld(world: PhysicsWorld): void {
    this.physicsWorld = world;
  }

  public get distance(): number {
    return this.smoothedDistance;
  }

  public get isCinematicActive(): boolean {
    return this.isCinematic;
  }

  public updateProfile(scale: number): void {
    if (scale <= 0.3) {
      this.currentDistance = CAMERA_PROFILES.SMALL.distance;
      this.currentHeight = CAMERA_PROFILES.SMALL.height;
      this.targetFOV = this.profileFOV = CAMERA_PROFILES.SMALL.fov;
      this.minPitch = -4 * DEG;
      this.maxPitch = 78 * DEG;
    } else if (scale >= 2.0) {
      this.currentDistance = CAMERA_PROFILES.GIANT.distance;
      this.currentHeight = CAMERA_PROFILES.GIANT.height;
      this.targetFOV = this.profileFOV = CAMERA_PROFILES.GIANT.fov;
      this.minPitch = -8 * DEG;
      this.maxPitch = 72 * DEG;
    } else {
      this.currentDistance = CAMERA_PROFILES.NORMAL.distance;
      this.currentHeight = CAMERA_PROFILES.NORMAL.height;
      this.targetFOV = this.profileFOV = CAMERA_PROFILES.NORMAL.fov;
      this.minPitch = -8 * DEG;
      this.maxPitch = 72 * DEG;
    }
  }

  /**
   * Rotate the camera. Arguments are RADIANS: `yawDelta > 0` means the mouse moved right (the view turns right),
   * `pitchDelta > 0` means the mouse moved down (the camera rises and looks further down).
   */
  public applyMouseDelta(yawDelta: number, pitchDelta: number): void {
    if (this.isCinematic) return;
    this.yawGoal -= yawDelta;
    this.pitchGoal += pitchDelta;
    this.pitchGoal = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitchGoal));
  }

  /** Positive = zoom out (wheel scrolled toward the user). Unit ≈ one wheel notch. */
  public zoomBy(delta: number): void {
    if (this.isCinematic || delta === 0) return;
    this.zoomGoal = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomGoal * Math.exp(delta * 0.12)));
  }

  /** Snap the orbit instantly (tests, scene changes). */
  public setOrbit(yaw: number, pitch: number): void {
    this.yaw = this.yawGoal = yaw;
    this.pitch = this.pitchGoal = Math.max(this.minPitch, Math.min(this.maxPitch, pitch));
  }

  public update(playerPosition: THREE.Vector3, deltaTime: number): void {
    if (this.isCinematic) {
      this.updateCinematic(deltaTime);
      return;
    }

    // Spring-damped orbit angles / zoom.
    const orbitBlend = damp(22, deltaTime);
    this.yaw += (this.yawGoal - this.yaw) * orbitBlend;
    this.pitch += (this.pitchGoal - this.pitch) * orbitBlend;
    this.zoom += (this.zoomGoal - this.zoom) * damp(12, deltaTime);

    // Follow point: head height above the feet, eased so footsteps do not jitter the view.
    _tmpLook.copy(playerPosition);
    _tmpLook.y += this.currentHeight;
    if (!this.initialised) {
      this.smoothedTarget.copy(_tmpLook);
      this.initialised = true;
    } else if (_tmpLook.distanceToSquared(this.smoothedTarget) > 25) {
      // Teleport (scene change): do not swoop across the world.
      this.smoothedTarget.copy(_tmpLook);
    } else {
      this.smoothedTarget.lerp(_tmpLook, damp(16, deltaTime));
    }
    this.target.copy(this.smoothedTarget);

    // Drowsy sway in S1 (visual only).
    if (this.currentState === 'S1_BANK' && !this.reduceMotion) {
      this.swayTime += deltaTime;
      this.target.x += Math.sin(this.swayTime * 1.5) * 0.03;
      this.target.y += Math.sin(this.swayTime * 2.0) * 0.015;
    } else {
      this.swayTime = 0;
    }

    // Offset from yaw / elevation: positive pitch lifts the camera above the target.
    const wantDistance = this.currentDistance * this.zoom;
    _tmpEuler.set(-this.pitch, this.yaw, 0, 'YXZ');
    _tmpOffset.set(0, 0, wantDistance).applyEuler(_tmpEuler);
    _tmpDesired.copy(this.target).add(_tmpOffset);

    // Spring-arm sweep: pull in instantly on contact, ease back out afterwards.
    let armLength = wantDistance;
    if (this.physicsWorld) {
      _tmpDir.copy(_tmpOffset).normalize();
      const hit = this.physicsWorld.sweepSphere(this.target, _tmpDir, 0.1, wantDistance);
      if (hit < wantDistance) armLength = Math.max(0.25, hit - 0.1);
    }
    if (armLength < this.collisionDistance) {
      this.collisionDistance = armLength;
    } else {
      this.collisionDistance += (armLength - this.collisionDistance) * damp(5, deltaTime);
    }
    this.smoothedDistance = Math.min(wantDistance, this.collisionDistance);
    _tmpDesired.copy(this.target).addScaledVector(_tmpDir.copy(_tmpOffset).normalize(), this.smoothedDistance);

    // Keep the lens above the floor.
    const floorY = playerPosition.y + 0.06 * Math.max(0.3, this.currentHeight / 1.4);
    if (_tmpDesired.y < floorY) _tmpDesired.y = floorY;

    this.camera.position.copy(_tmpDesired);
    this.lookAtPoint.copy(this.target);

    if (this.blendBack > 0) {
      this.blendBack = Math.max(0, this.blendBack - deltaTime / 0.9);
      const k = this.blendBack * this.blendBack * (3 - 2 * this.blendBack);
      this.camera.position.lerp(this.lastCinematicPos, k);
      this.lookAtPoint.lerp(this.lastCinematicLook, k);
    }

    this.camera.lookAt(this.lookAtPoint);

    // Smooth FOV transition.
    if (Math.abs(this.camera.fov - this.targetFOV) > 0.05) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * damp(8, deltaTime);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateCinematic(deltaTime: number): void {
    if (this.cinematicProgress < 1.0) {
      this.cinematicProgress = Math.min(1.0, this.cinematicProgress + deltaTime / Math.max(0.001, this.cinematicDuration));
    }
    const t = this.cinematicProgress;
    const s = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.cinematicStartPos, this.cinematicTargetPos, s);
    this.lookAtPoint.lerpVectors(this.cinematicStartLook, this.cinematicTargetLookAt, s);
    this.camera.lookAt(this.lookAtPoint);
    this.lastCinematicPos.copy(this.camera.position);
    this.lastCinematicLook.copy(this.lookAtPoint);

    if (Math.abs(this.camera.fov - this.targetFOV) > 0.05) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * damp(6, deltaTime);
      this.camera.updateProjectionMatrix();
    }
  }

  public transitionToAnchor(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number = 2.0,
    fov?: number
  ): void {
    // Start from wherever the camera currently is, so consecutive shots chain smoothly.
    this.cinematicStartPos.copy(this.camera.position);
    this.cinematicStartLook.copy(this.isCinematic ? this.lookAtPoint : this.target);
    this.isCinematic = true;
    this.cinematicTargetPos.copy(position);
    this.cinematicTargetLookAt.copy(lookAt);
    this.cinematicDuration = duration;
    this.cinematicProgress = 0;
    this.blendBack = 0;

    if (fov) {
      this.targetFOV = fov;
    }
  }

  public exitCinematic(): void {
    if (!this.isCinematic) return;
    this.isCinematic = false;
    this.lastCinematicPos.copy(this.camera.position);
    this.lastCinematicLook.copy(this.lookAtPoint);
    this.blendBack = 1;
    // Return the lens to the scale profile's field of view.
    this.targetFOV = this.profileFOV;
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Horizontal forward direction of the camera (for tests and HUD). */
  public getForward(out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.camera.getWorldDirection(out);
    out.y = 0;
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    return out.normalize();
  }
}
