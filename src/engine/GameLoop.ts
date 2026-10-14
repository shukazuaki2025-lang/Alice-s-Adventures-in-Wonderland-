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
      // 1. Input update
      const moveInput = this.inputManager.update();

      // 2. Physics & Player update
      this.physicsWorld.step(deltaTime);
      this.characterController.update(deltaTime, moveInput);

      // 3. Camera update
      this.cameraRig.update(this.characterController.position, deltaTime);

      // 4. Custom update callbacks (State machine, cutscenes, stuck timers)
      this.onUpdateCallbacks.forEach((cb) => cb(deltaTime));
    }

    // 5. Render frame
    this.renderer.render(this.scene, this.cameraRig.camera);
  };
}
