import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { ALICE_SCALES, CAPSULE_DIMENSIONS } from '../core/constants';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ACCEL_LAMBDA = 9.0;
const BRAKE_LAMBDA = 12.0;
const TURN_LAMBDA = 13.0;

export class CharacterController {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public scale: number = ALICE_SCALES.NORMAL;
  public moveSpeed: number = 2.5; // m/s
  public isScaling: boolean = false;
  /** Smoothed horizontal velocity in world space (m/s). Fed to the animator so walk/run clips match real motion. */
  public velocity: THREE.Vector3 = new THREE.Vector3();
  /** Horizontal speed in m/s (|velocity|). */
  public speed: number = 0;
  /** True while the sprint key is held and Alice is actually moving. */
  public isRunning: boolean = false;
  
  public currentState: string = 'S1_BANK';

  private targetScale: number = ALICE_SCALES.NORMAL;
  public currentCapsuleRadius: number = CAPSULE_DIMENSIONS.NORMAL.radius;
  public currentCapsuleHeight: number = CAPSULE_DIMENSIONS.NORMAL.height;

  private physicsWorld: PhysicsWorld;
  private desiredFacing: number = 0;
  /** Angular velocity of the facing (rad/s); the animator uses it to bank into turns. */
  public turnRate: number = 0;
  private _desired: THREE.Vector3 = new THREE.Vector3();
  private _step: THREE.Vector3 = new THREE.Vector3();
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

  public update(deltaTime: number, inputVector: THREE.Vector3, cameraYaw: number = 0, sprint: boolean = false): void {
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
    let runMultiplier = 1.0;
    if (this.scale <= 0.3) {
      this.moveSpeed = 0.5;
      runMultiplier = 1.5;
    } else if (this.scale >= 2.0) {
      this.moveSpeed = 4.5;
      runMultiplier = 1.4;
    } else {
      // normal
      this.moveSpeed = 1.4;
      runMultiplier = 1.82; // 2.55 m/s sprint
      if (this.currentState === 'S1_BANK') {
        this.moveSpeed *= 0.85; // S1 sluggish
        runMultiplier = 1.85;
      }
    }

    const wantsMove = inputVector.lengthSq() > 0.001;
    const desired = this._desired.set(0, 0, 0);
    if (wantsMove) {
      // transform input based on camera yaw
      desired.copy(inputVector).normalize();
      desired.applyAxisAngle(Y_AXIS, cameraYaw);
      desired.multiplyScalar(this.moveSpeed * (sprint ? runMultiplier : 1.0));
    }

    // Exponential acceleration / braking: quick to respond, never a hard on/off snap.
    const lambda = wantsMove ? ACCEL_LAMBDA : BRAKE_LAMBDA;
    const blend = 1 - Math.exp(-lambda * deltaTime);
    this.velocity.x += (desired.x - this.velocity.x) * blend;
    this.velocity.z += (desired.z - this.velocity.z) * blend;
    if (!wantsMove && this.velocity.lengthSq() < 0.0004) this.velocity.set(0, 0, 0);

    const step = this._step.copy(this.velocity).multiplyScalar(deltaTime);
    if (step.lengthSq() > 1e-10) {
      const resolvedMove = this.physicsWorld.resolveMovement(
        this.position,
        step,
        this.currentCapsuleRadius,
        this.currentCapsuleHeight
      );
      this.position.add(resolvedMove);

      // If a wall stopped us, bleed off the blocked component so the run animation does not keep playing in place.
      const wanted = step.length();
      const achieved = resolvedMove.length();
      if (wanted > 1e-6 && achieved < wanted * 0.35) {
        this.velocity.multiplyScalar(Math.max(0, achieved / wanted));
      }
    }

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.isRunning = sprint && wantsMove && this.speed > this.moveSpeed * 1.15;

    // Facing eases toward the direction of travel (≈0.25 s for a half turn) instead of snapping.
    if (this.speed > 0.12 * Math.max(0.2, this.scale)) {
      this.desiredFacing = Math.atan2(this.velocity.x, this.velocity.z);
    }
    let dYaw = this.desiredFacing - this.rotation.y;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    this.rotation.y += dYaw * (1 - Math.exp(-TURN_LAMBDA * deltaTime));
    this.turnRate = dYaw * TURN_LAMBDA;

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
    this.velocity.set(0, 0, 0);
    this.speed = 0;
  }

  /** Face a world direction immediately (spawns / cutscene hand-offs). */
  public setFacing(yaw: number): void {
    this.rotation.y = this.desiredFacing = yaw;
    this.turnRate = 0;
  }
}
