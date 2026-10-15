import * as THREE from 'three';
import { RenderEngine } from './Renderer';
import { CameraRig } from './CameraRig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterController } from '../physics/CharacterController';
import { InputManager } from './InputManager';

export class GameLoop {
  private clock: THREE.Clock = new THREE.Clock();
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  public timeScale: number = 1.0;

  private renderer: RenderEngine;
  private cameraRig: CameraRig;
  private physicsWorld: PhysicsWorld;
  private characterController: CharacterController;
  private inputManager: InputManager;
  private scene: THREE.Scene;
  private onUpdateCallbacks: Array<(deltaTime: number) => void> = [];
  /** When this returns true the player cannot walk (cutscenes). Camera orbit stays available. */
  private movementLocked: () => boolean = () => false;

  constructor(
    renderer: RenderEngine,
    cameraRig: CameraRig,
    physicsWorld: PhysicsWorld,
    characterController: CharacterController,
    inputManager: InputManager,
    scene: THREE.Scene
  ) {
    this.renderer = renderer;
    this.cameraRig = cameraRig;
    this.physicsWorld = physicsWorld;
    this.characterController = characterController;
    this.inputManager = inputManager;
    this.scene = scene;
  }

  public setMovementLock(fn: () => boolean): void {
    this.movementLocked = fn;
  }

  public addUpdateCallback(fn: (deltaTime: number) => void): void {
    this.onUpdateCallbacks.push(fn);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.clock.start();
    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.clock.getDelta(); // Clear accumulated time during pause
  }

  public setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.tick);

    let deltaTime = Math.min(this.clock.getDelta(), 0.1);
    deltaTime *= this.timeScale;

    if (!this.isPaused) {
      // 1. Input update: WASD vector plus mouse / touch look and wheel zoom
      const moveInput = this.inputManager.update();
      const look = this.inputManager.consumeLook();
      this.cameraRig.applyMouseDelta(look.x, look.y);
      this.cameraRig.zoomBy(this.inputManager.consumeZoom());
      if (this.movementLocked()) moveInput.set(0, 0, 0);

      // 2. Physics & Player update (movement is camera-relative: W walks away from the lens)
      this.physicsWorld.step(deltaTime);
      this.characterController.update(deltaTime, moveInput, this.cameraRig.yaw, this.inputManager.sprint);

      // 3. Camera update
      this.cameraRig.update(this.characterController.position, deltaTime);

      // 4. Custom update callbacks (State machine, cutscenes, stuck timers)
      this.onUpdateCallbacks.forEach((cb) => cb(deltaTime));
    }

    // Camera input that arrives while paused must not be applied in one lump after resume.
    if (this.isPaused) this.inputManager.discardLook();

    // 5. Render frame
    this.renderer.render(this.scene, this.cameraRig.camera);
  };
}
