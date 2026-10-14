import * as THREE from 'three';
import { CAMERA_PROFILES } from '../core/constants';

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

  constructor() {
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
    } else if (scale >= 2.0) {
      this.currentDistance = CAMERA_PROFILES.GIANT.distance;
      this.currentHeight = CAMERA_PROFILES.GIANT.height;
      this.targetFOV = CAMERA_PROFILES.GIANT.fov;
    } else {
      this.currentDistance = CAMERA_PROFILES.NORMAL.distance;
      this.currentHeight = CAMERA_PROFILES.NORMAL.height;
      this.targetFOV = CAMERA_PROFILES.NORMAL.fov;
    }
  }

  public update(playerPosition: THREE.Vector3, deltaTime: number): void {
    if (this.isCinematic) {
      if (this.cinematicProgress < 1.0) {
        this.cinematicProgress += deltaTime / this.cinematicDuration;
        const t = Math.min(1.0, this.cinematicProgress);
        this.camera.position.lerp(this.cinematicTargetPos, t);
        const lookAt = new THREE.Vector3().lerpVectors(this.target, this.cinematicTargetLookAt, t);
        this.camera.lookAt(lookAt);
      }
      return;
    }

    // Follow player with spring-arm smoothing
    this.target.copy(playerPosition).add(new THREE.Vector3(0, this.currentHeight, 0));

    const desiredCamPos = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + this.currentHeight,
      playerPosition.z + this.currentDistance
    );

    // Smooth lerp
    this.camera.position.lerp(desiredCamPos, 0.1);
    this.camera.lookAt(this.target);

    // Smooth FOV transition
    if (Math.abs(this.camera.fov - this.targetFOV) > 0.1) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * 0.05;
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
