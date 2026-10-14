import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
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

  private targetScale: number = ALICE_SCALES.NORMAL;
  private currentCapsuleRadius: number = CAPSULE_DIMENSIONS.NORMAL.radius;
  private currentCapsuleHeight: number = CAPSULE_DIMENSIONS.NORMAL.height;

  private body: RAPIER.RigidBody | null = null;
  private physicsWorld: PhysicsWorld;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  public init(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)): void {
    this.position.copy(initialPosition);
    if (this.physicsWorld.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + this.currentCapsuleHeight / 2,
        this.position.z
      );
      this.body = this.physicsWorld.world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.capsule(
        this.currentCapsuleHeight / 2 - this.currentCapsuleRadius,
        this.currentCapsuleRadius
      );
      this.physicsWorld.world.createCollider(colliderDesc, this.body);
    }
  }

  public setScale(newScale: number, smooth: boolean = false): void {
    this.targetScale = newScale;
    if (!smooth) {
      this.scale = newScale;
      this.updateCapsuleDimensions(newScale);
      globalEventBus.emit(GAME_EVENTS.SCALE_CHANGED, this.scale);
    } else {
      this.isScaling = true;
    }
  }

  private updateCapsuleDimensions(scale: number): void {
    if (scale <= 0.3) {
      // Small scale (0.254m)
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.SMALL.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.SMALL.height;
      this.moveSpeed = 1.0;
    } else if (scale >= 2.0) {
      // Giant scale (2.90m)
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.GIANT.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.GIANT.height;
      this.moveSpeed = 4.5;
    } else {
      // Normal scale (1.20m)
      this.currentCapsuleRadius = CAPSULE_DIMENSIONS.NORMAL.radius;
      this.currentCapsuleHeight = CAPSULE_DIMENSIONS.NORMAL.height;
      this.moveSpeed = 2.5;
    }
  }

  public update(deltaTime: number, inputVector: THREE.Vector3): void {
    // Handle smooth 2.5s scaling interpolation (INV-04)
    if (this.isScaling) {
      const step = (this.targetScale - this.scale) * (deltaTime / 2.5);
      if (Math.abs(this.targetScale - this.scale) <= Math.abs(step) * 1.5) {
        this.scale = this.targetScale;
        this.isScaling = false;
      } else {
        this.scale += step;
      }
      this.updateCapsuleDimensions(this.scale);
      globalEventBus.emit(GAME_EVENTS.SCALE_CHANGED, this.scale);
    }

    if (inputVector.lengthSq() > 0.001) {
      const move = inputVector.clone().normalize().multiplyScalar(this.moveSpeed * deltaTime);
      this.position.add(move);

      // Facing angle
      this.rotation.y = Math.atan2(move.x, move.z);
    }

    if (this.body) {
      this.body.setNextKinematicTranslation({
        x: this.position.x,
        y: this.position.y + this.currentCapsuleHeight / 2,
        z: this.position.z,
      });
    }

    this.physicsWorld.checkTriggers(this.position);
  }

  public setPosition(pos: THREE.Vector3): void {
    this.position.copy(pos);
    if (this.body) {
      this.body.setTranslation(
        { x: pos.x, y: pos.y + this.currentCapsuleHeight / 2, z: pos.z },
        true
      );
    }
  }
}
