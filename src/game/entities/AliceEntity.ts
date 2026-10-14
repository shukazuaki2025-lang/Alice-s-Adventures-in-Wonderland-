import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { convertMaterialsToToon } from '../../shaders/ToonShaders';
import { applyInkOutline } from '../../shaders/InkOutline';
import { ALICE_SCALES } from '../../core/constants';

export class AliceEntity {
  public mesh: THREE.Group = new THREE.Group();
  public scale: number = ALICE_SCALES.NORMAL;
  public mixer?: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction?: THREE.AnimationAction;
  private model?: THREE.Group;
  private headMesh?: THREE.Mesh;
  private rightHandSocket?: THREE.Object3D;
  private leftHandSocket?: THREE.Object3D;
  
  private targetRotation: number = 0;

  constructor() {
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load('/assets/models/chr_alice.glb', (gltf: any) => {
      const model: THREE.Group = gltf.scene;
      this.model = model;
      model.scale.set(this.scale, this.scale, this.scale);
      
      this.mixer = new THREE.AnimationMixer(model);
      (gltf.animations as THREE.AnimationClip[]).forEach((clip: THREE.AnimationClip) => {
        const action = this.mixer!.clipAction(clip);
        this.actions.set(clip.name, action);
      });

      convertMaterialsToToon(model);
      applyInkOutline(model);

      model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.name === 'Alice_Head') {
            this.headMesh = mesh;
          }
        } else if ((child as THREE.Bone).isBone || child.name.startsWith('SOCKET_')) {
          if (child.name === 'SOCKET_HandR') this.rightHandSocket = child;
          if (child.name === 'SOCKET_HandL') this.leftHandSocket = child;
        }
      });

      this.mesh.add(model);
      this.playAnimation('Alice_Idle', 0);
    });
  }

  public setExpression(expression: string, weight: number = 1.0): void {
    if (this.headMesh && this.headMesh.morphTargetDictionary && this.headMesh.morphTargetInfluences) {
      const idx = this.headMesh.morphTargetDictionary[expression];
      if (idx !== undefined) {
        this.headMesh.morphTargetInfluences[idx] = weight;
      }
    }
  }

  public playAnimation(name: string, fadeDuration: number = 0.2, loop: boolean = true): void {
    const newAction = this.actions.get(name);
    if (!newAction || newAction === this.currentAction) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
    }
    
    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    newAction.clampWhenFinished = !loop;
    newAction.reset().fadeIn(fadeDuration).play();
    this.currentAction = newAction;
  }

  public attachToHand(side: 'left' | 'right', obj: THREE.Object3D): void {
    const socket = side === 'right' ? this.rightHandSocket : this.leftHandSocket;
    if (socket) {
      socket.add(obj);
    }
  }

  public update(delta: number, velocity: THREE.Vector3): void {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    const speed = velocity.length();
    if (speed > 5) {
      this.playAnimation('Alice_Run');
    } else if (speed > 0.1) {
      this.playAnimation('Alice_Walk');
    } else {
      this.playAnimation('Alice_Idle');
    }

    if (speed > 0.1) {
      this.targetRotation = Math.atan2(velocity.x, velocity.z);
    }
    
    if (this.model) {
      const rotationDiff = this.targetRotation - this.model.rotation.y;
      let diff = rotationDiff % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      
      this.model.rotation.y += diff * 10 * delta;
    }
  }

  public setScale(scale: number): void {
    this.scale = scale;
    if (this.model) {
      this.model.scale.set(scale, scale, scale);
    }
  }

  public setPosition(pos: THREE.Vector3): void {
    this.mesh.position.copy(pos);
  }
}
