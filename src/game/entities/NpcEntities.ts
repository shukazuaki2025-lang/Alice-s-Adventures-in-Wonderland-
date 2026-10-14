import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { convertMaterialsToToon } from '../../shaders/ToonShaders';
import { applyInkOutline } from '../../shaders/InkOutline';

export class SisterEntity {
  public mesh: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();

  constructor() {
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load('/assets/models/chr_sister.glb', (gltf) => {
      const model = gltf.scene;
      convertMaterialsToToon(model);
      applyInkOutline(model);
      this.mesh.add(model);
      
      this.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        this.actions.set(clip.name, this.mixer!.clipAction(clip));
      });
      
      this.playAnimation('Sister_ReadIdle');
    });
  }

  public playAnimation(name: string): void {
    const action = this.actions.get(name);
    if (action) {
      this.mixer?.stopAllAction();
      action.play();
    }
  }

  public update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}

export class DinahDreamEntity {
  public mesh: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private orbitAngle: number = 0;
  private orbitRadius: number = 2.0;
  private orbitSpeed: number = 0.5;

  constructor() {
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load('/assets/models/chr_dinah_dream.glb', (gltf) => {
      const model = gltf.scene;
      convertMaterialsToToon(model);
      applyInkOutline(model);
      this.mesh.add(model);
      
      this.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        this.actions.set(clip.name, this.mixer!.clipAction(clip));
      });
      
      this.playAnimation('Dinah_Float');
    });
  }

  public playAnimation(name: string): void {
    const action = this.actions.get(name);
    if (action) {
      this.mixer?.stopAllAction();
      action.play();
    }
  }

  public update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Orbit gently
    this.orbitAngle += this.orbitSpeed * dt;
    this.mesh.position.x = Math.cos(this.orbitAngle) * this.orbitRadius;
    this.mesh.position.z = Math.sin(this.orbitAngle) * this.orbitRadius;
    // Face tangential to orbit
    this.mesh.rotation.y = -this.orbitAngle;
  }
}
