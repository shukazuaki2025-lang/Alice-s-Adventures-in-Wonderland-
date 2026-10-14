import * as THREE from 'three';

/**
 * Three.js 3D Spatial Audio integration helper
 */
export class SpatialAudioSystem {
  private listener: THREE.AudioListener | null = null;
  private camera: THREE.Camera;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  public init(): void {
    if (!this.listener) {
      this.listener = new THREE.AudioListener();
      this.camera.add(this.listener);
    }
  }

  public getListener(): THREE.AudioListener | null {
    return this.listener;
  }

  /**
   * Attach a 3D PositionalAudio source to a Three.js Object3D (e.g. White Rabbit, river, lamp)
   */
  public attachPositionalAudio(
    targetObject: THREE.Object3D,
    refDistance = 1.0,
    maxDistance = 15.0,
    rolloffFactor = 1.0
  ): THREE.PositionalAudio | null {
    if (!this.listener) {
        console.warn('SpatialAudioSystem not initialized. Call init() after user gesture.');
        return null;
    }
    const positionalSound = new THREE.PositionalAudio(this.listener);
    positionalSound.setRefDistance(refDistance);
    positionalSound.setMaxDistance(maxDistance);
    positionalSound.setRolloffFactor(rolloffFactor);
    targetObject.add(positionalSound);
    return positionalSound;
  }
}
