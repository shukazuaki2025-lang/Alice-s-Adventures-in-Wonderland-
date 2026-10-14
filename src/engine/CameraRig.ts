import * as THREE from 'three';
import { CAMERA_PROFILES } from '../core/constants';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3(0, 1.4, 0);

  private currentDistance: number = CAMERA_PROFILES.NORMAL.distance;
  private currentHeight: number = CAMERA_PROFILES.NORMAL.height;
  private targetFOV: number = CAMERA_PROFILES.NORMAL.fov;

  private isCinematic: boolean = false;
  private cinematicTargetPos: THREE.Vector3 = new THREE.Vector3();
  private cinematicTargetLookAt: THREE.Vector3 = new THREE.Vector3();
  private cinematicProgress: number = 0;
  private cinematicDuration: number = 1.0;
  
  public yaw: number = 0;
  public pitch: number = 0;
  private minPitch: number = -30 * Math.PI / 180;
  private maxPitch: number = 60 * Math.PI / 180;

  private physicsWorld: PhysicsWorld | null = null;
  public reduceMotion: boolean = false;
  private swayTime: number = 0;
  public currentState: string = 'S1_BANK';

  constructor(physicsWorld?: PhysicsWorld) {
    this.physicsWorld = physicsWorld || null;
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.4, 3.2);
  }

  public updateProfile(scale: number): void {
    if (scale <= 0.3) {
      this.currentDistance = CAMERA_PROFILES.SMALL.distance;
      this.currentHeight = CAMERA_PROFILES.SMALL.height;
      this.targetFOV = CAMERA_PROFILES.SMALL.fov;
      this.minPitch = -20 * Math.PI / 180;
      this.maxPitch = 70 * Math.PI / 180;
    } else if (scale >= 2.0) {
      this.currentDistance = CAMERA_PROFILES.GIANT.distance;
      this.currentHeight = CAMERA_PROFILES.GIANT.height;
      this.targetFOV = CAMERA_PROFILES.GIANT.fov;
      this.minPitch = -30 * Math.PI / 180;
      this.maxPitch = 60 * Math.PI / 180;
    } else {
      this.currentDistance = CAMERA_PROFILES.NORMAL.distance;
      this.currentHeight = CAMERA_PROFILES.NORMAL.height;
      this.targetFOV = CAMERA_PROFILES.NORMAL.fov;
      this.minPitch = -30 * Math.PI / 180;
      this.maxPitch = 60 * Math.PI / 180;
    }
  }

  public applyMouseDelta(deltaX: number, deltaY: number): void {
    if (this.isCinematic) return;
    this.yaw -= deltaX * 0.005;
    this.pitch -= deltaY * 0.005;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  public update(playerPosition: THREE.Vector3, deltaTime: number): void {
    if (this.isCinematic) {
      if (this.cinematicProgress < 1.0) {
        this.cinematicProgress += deltaTime / this.cinematicDuration;
        const t = Math.min(1.0, this.cinematicProgress);
        // Smooth step for keyframe interpolation
        const smoothT = t * t * (3 - 2 * t);
        this.camera.position.lerpVectors(this.camera.position, this.cinematicTargetPos, 1 - Math.exp(-10 * deltaTime));
        const currentLookAt = new THREE.Vector3().addVectors(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
        const targetLook = new THREE.Vector3().lerpVectors(currentLookAt, this.cinematicTargetLookAt, 1 - Math.exp(-10 * deltaTime));
        this.camera.lookAt(targetLook);
        
        // Actually for cutscene we should just interpolate correctly
        this.camera.position.lerp(this.cinematicTargetPos, smoothT);
        const lookAt = new THREE.Vector3().lerpVectors(this.target, this.cinematicTargetLookAt, smoothT);
        this.camera.lookAt(lookAt);
      }
      return;
    }

    // Follow player with spring-arm smoothing
    this.target.copy(playerPosition).add(new THREE.Vector3(0, this.currentHeight, 0));
    
    // Add drowsy sway in S1
    if (this.currentState === 'S1_BANK' && !this.reduceMotion) {
      this.swayTime += deltaTime;
      this.target.x += Math.sin(this.swayTime * 1.5) * 0.05;
      this.target.y += Math.sin(this.swayTime * 2.0) * 0.02;
    } else {
      this.swayTime = 0;
    }

    // Calculate desired position from yaw and pitch
    const offset = new THREE.Vector3(0, 0, this.currentDistance);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    offset.applyEuler(euler);

    let desiredCamPos = this.target.clone().add(offset);

    // Spring-arm ray/segment collision sweep against PhysicsWorld colliders
    if (this.physicsWorld) {
        const dir = new THREE.Vector3().subVectors(desiredCamPos, this.target);
        const maxDist = dir.length();
        dir.normalize();
        
        const hitDist = this.physicsWorld.sweepSphere(this.target, dir, 0.1, maxDist);
        if (hitDist < maxDist) {
            desiredCamPos = this.target.clone().add(dir.multiplyScalar(Math.max(0.1, hitDist - 0.1)));
        }
    }

    // Frame-rate-independent exponential smoothing
    const lambda = 10.0;
    const blend = 1.0 - Math.exp(-lambda * deltaTime);
    this.camera.position.lerp(desiredCamPos, blend);
    this.camera.lookAt(this.target);

    // Smooth FOV transition
    if (Math.abs(this.camera.fov - this.targetFOV) > 0.1) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * blend;
      this.camera.updateProjectionMatrix();
    }
  }

  public transitionToAnchor(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number = 2.0,
    fov?: number
  ): void {
    this.isCinematic = true;
    this.cinematicTargetPos.copy(position);
    this.cinematicTargetLookAt.copy(lookAt);
    this.cinematicDuration = duration;
    this.cinematicProgress = 0;

    if (fov) {
      this.targetFOV = fov;
    }
  }

  public exitCinematic(): void {
    this.isCinematic = false;
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
