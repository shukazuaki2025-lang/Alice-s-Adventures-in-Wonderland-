import * as THREE from 'three';
import { RenderEngine } from '../engine/Renderer';
import { CameraRig } from '../engine/CameraRig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterController } from '../physics/CharacterController';
import { SceneLoader } from '../engine/SceneLoader';
import { GameLoop } from '../engine/GameLoop';
import { InputManager } from '../engine/InputManager';

import { StateMachine } from './StateMachine';
import { PuzzleManager } from './PuzzleManager';
import { CutscenePlayer } from './CutscenePlayer';
import { ItemInspector } from './ItemInspector';
import { AliceEntity } from './entities/AliceEntity';

import { globalEventBus, GameStateSnapshot } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class GameManager {
  public renderer: RenderEngine;
  public cameraRig: CameraRig;
  public physicsWorld: PhysicsWorld;
  public characterController: CharacterController;
  public sceneLoader: SceneLoader;
  public gameLoop: GameLoop;
  public inputManager: InputManager;

  public stateMachine: StateMachine;
  public puzzleManager: PuzzleManager;
  public cutscenePlayer: CutscenePlayer;
  public itemInspector: ItemInspector;
  public aliceEntity: AliceEntity;

  public scene: THREE.Scene;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf7f3ea);

    this.renderer = new RenderEngine(canvas);
    this.cameraRig = new CameraRig();
    this.physicsWorld = new PhysicsWorld();
    this.characterController = new CharacterController(this.physicsWorld);
    this.inputManager = new InputManager();
    this.sceneLoader = new SceneLoader();

    this.stateMachine = new StateMachine();
    this.puzzleManager = new PuzzleManager(this.stateMachine);
    this.cutscenePlayer = new CutscenePlayer(this.stateMachine, this.cameraRig);
    this.itemInspector = new ItemInspector();
    this.aliceEntity = new AliceEntity();

    this.scene.add(this.aliceEntity.mesh);

    this.gameLoop = new GameLoop(
      this.renderer,
      this.cameraRig,
      this.physicsWorld,
      this.characterController,
      this.inputManager,
      this.scene
    );

    this.gameLoop.addUpdateCallback((dt) => this.onUpdate(dt));
    this.setupEventListeners();
  }

  public async init(): Promise<void> {
    await this.physicsWorld.init();
    await this.sceneLoader.loadGreybox('/assets/models/ch1_greybox.glb', this.physicsWorld);
    this.scene.add(this.sceneLoader.sceneGroup);

    this.characterController.init(new THREE.Vector3(2.0, 0, 0));
    this.gameLoop.start();

    console.log('[GameManager] Master game system initialized successfully');
  }

  private setupEventListeners(): void {
    globalEventBus.on(GAME_EVENTS.INTERACTION_TRIGGERED, (action: string) => {
      if (action === 'E') {
        this.handleInteraction();
      }
    });

    globalEventBus.on(GAME_EVENTS.SCALE_CHANGED, (scale: number) => {
      this.aliceEntity.setScale(scale);
      this.cameraRig.updateProfile(scale);
    });
  }

  private onUpdate(deltaTime: number): void {
    this.aliceEntity.setPosition(this.characterController.position);
    this.puzzleManager.update(deltaTime);
  }

  private handleInteraction(): void {
    const state = this.stateMachine.currentState;

    if (state === 'S1_BANK') {
      this.puzzleManager.addItem('daisy_1');
      this.stateMachine.setFlag('daisiesPicked', 2);
      this.cutscenePlayer.playCutscene('C1');
    } else if (state === 'S2_CHASE') {
      this.cutscenePlayer.playCutscene('C2', () => {
        this.stateMachine.goto('S3_FALL');
      });
    } else if (state === 'S5_HALL') {
      this.puzzleManager.interactWithDoor();
    }
  }

  public getSnapshot(): GameStateSnapshot {
    return {
      state: this.stateMachine.currentState,
      aliceScale: this.characterController.scale,
      inventory: this.puzzleManager.getInventory(),
      flags: { ...this.stateMachine.flags } as Record<string, boolean | number | string>,
      playerPosition: {
        x: this.characterController.position.x,
        y: this.characterController.position.y,
        z: this.characterController.position.z,
      },
      cameraPosition: {
        x: this.cameraRig.camera.position.x,
        y: this.cameraRig.camera.position.y,
        z: this.cameraRig.camera.position.z,
      },
    };
  }
}
