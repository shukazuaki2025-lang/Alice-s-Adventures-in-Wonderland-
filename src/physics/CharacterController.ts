import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { ALICE_SCALES, CAPSULE_DIMENSIONS } from '../core/constants';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class CharacterController {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public scale: number = ALICE_SCALES.NORMAL;
  public moveSpeed: number = 2.5; // m/s
  public isScaling: boolean = false;
  
  public currentState: string = 'S1_BANK';

  private targetScale: number = ALICE_SCALES.NORMAL;
  public currentCapsuleRadius: number = CAPSULE_DIMENSIONS.NORMAL.radius;
  public currentCapsuleHeight: number = CAPSULE_DIMENSIONS.NORMAL.height;

  private physicsWorld: PhysicsWorld;
  public reduceMotion: boolean = false;
  private swayTime: number = 0;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  public init(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)): void {
    this.position.copy(initialPosition);
  }

  private scaleTime: number = 0;
  private startScale: number = ALICE_SCALES.NORMAL;

  public setScale(newScale: number, smooth: boolean = false): void {
    if (!smooth) {
      this.targetScale = newScale;
      this.scale = newScale;
      this.updateCapsuleDimensions(newScale);
      globalEventBus.emit(GAME_EVENTS.SCALE_CHANGED, this.scale);
    } else {
      this.startScale = this.scale;
      this.targetScale = newScale;
      this.scaleTime = 0;
      this.isScaling = true;
    }
  }

  private updateCapsuleDimensions(scale: number): void {
    if (scale <= 0.3) {
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.SMALL.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.SMALL.height;
    } else if (scale >= 2.0) {
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.GIANT.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.GIANT.height;
    } else {
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.NORMAL.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.NORMAL.height;
    }
  }

  public update(deltaTime: number, inputVector: THREE.Vector3, cameraYaw: number = 0): void {
    if (this.isScaling) {
      this.scaleTime += deltaTime;
      const t = Math.min(this.scaleTime / 2.5, 1.0);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.scale = this.startScale + (this.targetScale - this.startScale) * ease;
      
      if (t >= 1.0) {
        this.scale = this.targetScale;
        this.isScaling = false;
      }
      this.updateCapsuleDimensions(this.scale);
      globalEventBus.emit(GAME_EVENTS.SCALE_CHANGED, this.scale);
    }
    
    // speed logic
    if (this.scale <= 0.3) {
      this.moveSpeed = 0.5;
    } else if (this.scale >= 2.0) {
      this.moveSpeed = 4.5;
    } else {
      // normal
      const isRunning = false; // Add sprint logic if needed
      this.moveSpeed = isRunning ? 2.55 : 1.4;
      if (this.currentState === 'S1_BANK') {
        this.moveSpeed *= 0.85; // S1 sluggish
      }
    }

    if (inputVector.lengthSq() > 0.001) {
      // transform input based on camera yaw
      const move = inputVector.clone().normalize();
      move.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      move.multiplyScalar(this.moveSpeed * deltaTime);
      
      const resolvedMove = this.physicsWorld.resolveMovement(
          this.position, 
          move, 
          this.currentCapsuleRadius, 
          this.currentCapsuleHeight
      );

      this.position.add(resolvedMove);

      // Facing angle follows movement
      if (resolvedMove.lengthSq() > 0.0001) {
        this.rotation.y = Math.atan2(resolvedMove.x, resolvedMove.z);
      } else {
        this.rotation.y = Math.atan2(move.x, move.z);
      }
    }

    // Drowsy sway for S1
    if (this.currentState === 'S1_BANK' && !this.reduceMotion && inputVector.lengthSq() < 0.001) {
        this.swayTime += deltaTime;
        // visual only sway, not modifying position physics-wise
    } else {
        this.swayTime = 0;
    }

    this.physicsWorld.checkTriggers(this.position, this.currentCapsuleRadius, this.currentCapsuleHeight);
  }

  public setPosition(pos: THREE.Vector3): void {
    this.position.copy(pos);
  }
}
