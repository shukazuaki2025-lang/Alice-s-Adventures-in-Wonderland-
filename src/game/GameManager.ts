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
import { RabbitEntity } from './entities/RabbitEntity';
import { SisterEntity, DinahDreamEntity } from './entities/NpcEntities';

import { SceneLightingManager } from '../engine/SceneLighting';
import { PaintedSky } from '../world/PaintedSky';
import { Pollen } from '../world/Pollen';

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
  public rabbitEntity: RabbitEntity;
  public sisterEntity: SisterEntity;
  public dinahDreamEntity: DinahDreamEntity;

  public scene: THREE.Scene;
  public lighting: SceneLightingManager;
  public sky: PaintedSky;
  public pollen: Pollen;
  private elapsedTime = 0;
  private stateElapsedTime = 0; // Tracks time spent in current state
  private fallThoughtsTriggered = [false, false, false, false, false];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.lighting = new SceneLightingManager(this.scene);
    this.sky = new PaintedSky();
    this.scene.add(this.sky.mesh);
    this.pollen = new Pollen();
    this.scene.add(this.pollen.points);

    this.renderer = new RenderEngine(canvas);
    this.physicsWorld = new PhysicsWorld();
    this.cameraRig = new CameraRig(this.physicsWorld);
    this.characterController = new CharacterController(this.physicsWorld);
    this.inputManager = new InputManager();
    this.sceneLoader = new SceneLoader();

    this.stateMachine = new StateMachine();
    this.puzzleManager = new PuzzleManager(this.stateMachine);
    this.cutscenePlayer = new CutscenePlayer(this.stateMachine, this.cameraRig);
    this.itemInspector = new ItemInspector();
    this.aliceEntity = new AliceEntity();
    this.rabbitEntity = new RabbitEntity();
    this.sisterEntity = new SisterEntity();
    this.dinahDreamEntity = new DinahDreamEntity();

    this.scene.add(this.aliceEntity.mesh);

    this.gameLoop = new GameLoop(
      this.renderer,
      this.cameraRig,
      this.physicsWorld,
      this.characterController,
      this.inputManager,
      this.scene
    );

    this.gameLoop.setMovementLock(() => this.cutscenePlayer.isPlaying);
    this.gameLoop.addUpdateCallback((dt) => this.onUpdate(dt));
    this.setupEventListeners();
    this.setupResizeHandler();
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.resize(w, h);
      this.cameraRig.resize(w / h);
    });
  }

  public async init(): Promise<void> {
    await this.physicsWorld.init();
    await this.cutscenePlayer.preloadAll();
    await this.sceneLoader.loadGreybox('/assets/models/ch1_greybox.glb', this.physicsWorld);
    this.scene.add(this.sceneLoader.sceneGroup);

    // Replace primitive placeholders with real GLB entities
    this.sceneLoader.sisterMesh.clear();
    this.sceneLoader.sisterMesh.add(this.sisterEntity.mesh);
    this.sceneLoader.rabbitMesh.clear();
    this.sceneLoader.rabbitMesh.add(this.rabbitEntity.mesh);

    this.characterController.init(new THREE.Vector3(2.0, 0, 0));
    this.characterController.setFacing(Math.PI);
    this.aliceEntity.setPosition(this.characterController.position);
    this.cameraRig.update(this.characterController.position, 0.16);
    this.applySceneVisualsForState(this.stateMachine.currentState);
    this.gameLoop.start();

    console.log('[GameManager] Master game system initialized successfully');
  }

  private applySceneVisualsForState(state: string): void {
    this.sceneLoader.setActiveStateScene(state);
    this.stateElapsedTime = 0; // Reset timer on state transition
    this.characterController.currentState = state;
    this.cameraRig.currentState = state;
    this.physicsWorld.setActiveGroup(SceneLoader.getColliderGroup(state));
    this.physicsWorld.setWalkBounds(SceneLoader.getWalkBounds(state));

    this.lighting.applyStateLighting(state);
    // Dinah only drifts through the well's lavender dusk (added at t >= 70 s of S3); she used to linger in every later scene
    if (state !== 'S3_FALL') this.dinahDreamEntity.mesh.removeFromParent();
    const outdoors = state === 'S0_TITLE' || state === 'S1_BANK' || state === 'S2_CHASE';
    this.sky.mesh.visible = outdoors;
    this.pollen.points.visible = outdoors;
    if (!outdoors) {
      this.characterController.setPosition(new THREE.Vector3(0, 0, 0));
    }

    this.updatePromptForState(state);
  }

  private updatePromptForState(state: string): void {
    if (state === 'S1_BANK') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[WASD] 移动 · [E] 采雏菊 / 观察白兔');
    } else if (state === 'S2_CHASE') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[WASD] 追赶白兔 · [E] 跳进兔子洞');
    } else if (state === 'S3_FALL') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 拿取橘子果酱瓶并放回壁橱 · [C] 空中行屈膝礼');
    } else if (state === 'S4_PASSAGE') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[WASD] 穿过地下走廊 · [E] 进入多门大厅');
    } else if (state === 'S5_HALL') {
      const tries = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
      const keyTaken = Boolean(this.stateMachine.getFlag('keyTaken'));
      const curtainFound = Boolean(this.stateMachine.getFlag('curtainFound'));
      const peekDone = Boolean(this.stateMachine.getFlag('peekDone'));
      if (!keyTaken) {
        globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 从三脚玻璃桌上拾取小金钥匙');
      } else if (tries < 2) {
        globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, `[E] 用金钥匙尝试大厅四周的门 (${tries}/2)`);
      } else if (!curtainFound) {
        globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 拉开北墙低矮的红丝绒窗帘');
      } else if (!peekDone) {
        globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 用小金钥匙打开15英寸小门窥视花园');
      } else {
        globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 回到玻璃桌前拿起“喝我”药水瓶并饮用');
      }
    } else if (state === 'S6_SMALL') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 尝试攀爬光滑的玻璃桌腿 / 寻找桌下点心盒');
    } else if (state === 'S7_CAKE') {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, '[E] 打开桌下玻璃盒，吃下“吃我”葡萄干蛋糕');
    } else if (state === 'END') {
      globalEventBus.emit(GAME_EVENTS.HIDE_PROMPT);
    }
  }

  private setupEventListeners(): void {
    globalEventBus.on('startJourney', () => {
      this.characterController.setPosition(new THREE.Vector3(2.0, 0, -1.0));
      this.characterController.setFacing(Math.PI);
      this.characterController.setScale(1.0);
      this.stateMachine.goto('S1_BANK');
      globalEventBus.emit('S1_OBJECTIVE');
      globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
        id: 'ch1_s1_01',
        speaker: 'narrator',
        type: 'narr',
      });
    });

    globalEventBus.on('continueJourney', () => {
      this.stateMachine.restoreSavedGame();
      this.applySceneVisualsForState(this.stateMachine.currentState);
    });

    globalEventBus.on('pauseGame', () => {
      this.gameLoop.pause();
    });

    globalEventBus.on('resumeGame', () => {
      this.gameLoop.resume();
    });

    globalEventBus.on(GAME_EVENTS.STATE_CHANGED, ({ to }: { from: string; to: string }) => {
      this.applySceneVisualsForState(to);
    });

    globalEventBus.on('bottleSideInspected', (side: 'front' | 'back') => {
      if (side === 'front') {
        this.stateMachine.setFlag('bottleInspectedFront', true);
        this.stateMachine.setFlag('frontLabelChecked', true);
      } else if (side === 'back') {
        this.stateMachine.setFlag('bottleInspectedBack', true);
        this.stateMachine.setFlag('backLabelChecked', true);
      }
      if (this.puzzleManager.canDrinkBottle()) {
        this.stateMachine.setFlag('drinkButtonUnlocked', true);
      }
    });

    globalEventBus.on('drinkBottle', () => {
      this.handleDrinkBottle();
    });

    globalEventBus.on(GAME_EVENTS.INTERACTION_TRIGGERED, (action: string) => {
      if (action === 'E') {
        this.handleInteraction();
      } else if (action === 'C') {
        this.handleCurtsey();
      } else if (action === 'F') {
        this.handleDrinkBottle();
      } else if (action === 'G' || action === 'Q' || action === 'DROP') {
        if (this.stateMachine.currentState === 'S3_FALL' && this.stateMachine.getFlag('jarTaken')) {
          this.puzzleManager.tryDropJar();
        }
      }
    });

    globalEventBus.on(GAME_EVENTS.SCALE_CHANGED, (scale: number) => {
      this.aliceEntity.setScale(scale);
      this.cameraRig.updateProfile(scale);
    });
  }

  private isInteractableEligible(name: string, state: string): boolean {
    if (state === 'S1_BANK') {
      return name.startsWith('INT_daisy_') || name === 'INT_sister_book';
    }
    if (state === 'S2_CHASE') {
      return name === 'INT_rabbit_hole';
    }
    if (state === 'S3_FALL') {
      if (!this.stateMachine.getFlag('jarTaken')) {
        return name === 'INT_jar_marmalade';
      }
      if (!this.stateMachine.getFlag('jarStored')) {
        return name === 'INT_cupboard_return';
      }
      return false;
    }
    if (state === 'S4_PASSAGE') {
      return name === 'TRG_S4_exit';
    }
    if (state === 'S5_HALL') {
      const keyTaken = Boolean(this.stateMachine.getFlag('keyTaken'));
      const tries = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
      const curtainFound = Boolean(this.stateMachine.getFlag('curtainFound'));
      const peekDone = Boolean(this.stateMachine.getFlag('peekDone'));

      if (!keyTaken && !peekDone) {
        return name === 'INT_gold_key' || name.startsWith('INT_door_');
      }
      if (tries < 2) {
        return name.startsWith('INT_door_') || name === 'INT_curtain';
      }
      if (!curtainFound) {
        return name === 'INT_curtain' || name.startsWith('INT_door_');
      }
      if (!peekDone) {
        return name === 'INT_little_door';
      }
      return name === 'INT_bottle_drinkme' || name === 'INT_little_door';
    }
    if (state === 'S6_SMALL') {
      return name === 'INT_table_leg' || name === 'INT_little_door';
    }
    if (state === 'S7_CAKE') {
      return name === 'INT_glass_box' || name === 'INT_cake_eatme';
    }
    return false;
  }

  private getNearbyInteractable(): string | null {
    const state = this.stateMachine.currentState;
    let closestInteractable: string | null = null;
    let minDistance = 2.2;

    this.sceneLoader.propsMap.forEach((mesh, name) => {
      if ((name.startsWith('INT_') || name.startsWith('TRG_')) && this.isInteractableEligible(name, state)) {
        const dx = this.characterController.position.x - mesh.position.x;
        const dz = this.characterController.position.z - mesh.position.z;
        const distXZ = Math.hypot(dx, dz);
        if (distXZ < minDistance) {
          minDistance = distXZ;
          closestInteractable = name;
        }
      }
    });
    return closestInteractable;
  }

  private getInteractablePrompt(name: string): string {
    if (name.startsWith('INT_daisy_')) return '[E] 采摘河畔雏菊 · Pick Daisy';
    if (name === 'INT_sister_book') return '[E] 翻看姐姐的无字书 · Peek at Sister’s Book';
    if (name === 'INT_rabbit_hole') return '[E] 钻进树篱下的兔子洞 · Enter Rabbit-Hole';
    if (name === 'INT_jar_marmalade') return '[E] 拿取橘子果酱陶罐 · Take Marmalade Jar';
    if (name === 'INT_cupboard_return') return '[E] 将空果酱罐稳妥放回壁橱 · Return Jar to Cupboard';
    if (name === 'TRG_S4_exit') return '[E] 推门步入地下多门大厅 · Enter Great Hall';
    if (name === 'INT_gold_key') return '[E] 拾取玻璃桌上的小金钥匙 · Take Tiny Golden Key';
    if (name.startsWith('INT_door_')) return '[E] 用小金钥匙试锁 · Try Key on Hall Door';
    if (name === 'INT_curtain') return '[E] 拉开低矮的红丝绒幕帘 · Draw Back Low Curtain';
    if (name === 'INT_little_door') return '[E] 打开十五英寸小门窥视花园 · Unlock & Peek into Garden';
    if (name === 'INT_bottle_drinkme') return '[E] 拿起“喝我”玻璃药水瓶 · Examine “DRINK ME” Bottle';
    if (name === 'INT_table_leg') return '[E] 尝试攀爬光滑的玻璃桌腿 · Climb Glass Table Leg';
    if (name === 'INT_glass_box' || name === 'INT_cake_eatme') return '[E] 打开玻璃盒品尝“吃我”蛋糕 · Open Box & Eat Cake';
    return `[E] ${name}`;
  }

  private onUpdate(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.stateElapsedTime += deltaTime;
    
    this.aliceEntity.setPosition(this.characterController.position);
    this.aliceEntity.mesh.rotation.y = this.characterController.rotation.y;
    this.aliceEntity.update(deltaTime, this.characterController.velocity, this.characterController.turnRate);
    this.sceneLoader.update(deltaTime);
    this.sky.update(deltaTime, this.cameraRig.camera.position);
    this.pollen.update(deltaTime, this.characterController.position);
    this.lighting.follow(this.characterController.position);
    this.sisterEntity.update(deltaTime);
    this.rabbitEntity.update(deltaTime);
    this.puzzleManager.update(deltaTime);
    this.dinahDreamEntity.update(deltaTime);
    this.cutscenePlayer.update(deltaTime);

    const state = this.stateMachine.currentState;

    // Interaction checks
    const interactable = this.getNearbyInteractable();
    if (interactable) {
      globalEventBus.emit(GAME_EVENTS.SHOW_PROMPT, this.getInteractablePrompt(interactable));
    } else if (state !== 'END') {
      this.updatePromptForState(state);
    }

    if (state === 'S1_BANK') {
      if (this.stateElapsedTime >= 45 && !this.stateMachine.getFlag('chaseStarted')) {
        this.triggerS2Chase();
      }
    }

    if (state === 'S2_CHASE') {
      // Gentle idle/hop animation on the White Rabbit
      this.sceneLoader.rabbitMesh.position.y = Math.abs(Math.sin(this.elapsedTime * 4.5)) * 0.18;
      this.sceneLoader.rabbitMesh.rotation.y = Math.sin(this.elapsedTime * 1.5) * 0.35;
    }

    if (state === 'S3_FALL') {
      this.sceneLoader.wellScrollingGroup.position.y = (this.elapsedTime * 2.2) % 6.0;
      this.aliceEntity.mesh.position.y = Math.sin(this.elapsedTime * 2.5) * 0.15;
      this.aliceEntity.mesh.rotation.y += deltaTime * 0.6;
      
      // Keep within 1.4m radial WASD drift
      const pos = this.characterController.position;
      const radius = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      if (radius > 1.4) {
        pos.x *= 1.4 / radius;
        pos.z *= 1.4 / radius;
        this.characterController.setPosition(pos);
      }

      // S3 Time-based events
      const t = this.stateElapsedTime;
      
      // Spawn jar at t=15s
      if (t >= 15 && !this.stateMachine.getFlag('jarAppeared')) {
        this.stateMachine.setFlag('jarAppeared', true);
      }

      const thoughtTimes = [10, 30, 45, 58, 70];
      for (let i = 0; i < thoughtTimes.length; i++) {
        if (t >= thoughtTimes[i] && !this.fallThoughtsTriggered[i]) {
          this.fallThoughtsTriggered[i] = true;
          this.stateMachine.setFlag('thoughtsCollected', i + 1);
          globalEventBus.emit('showCuriosityNote', `Thought ${i + 1}`);
        }
      }

      this.lighting.setS3Progress(t); // amber candlelight -> lavender twilight from t = 70 s
      if (t >= 70 && !this.stateMachine.getFlag('lavenderTwilight')) {
        this.stateMachine.setFlag('lavenderTwilight', true);
        this.scene.add(this.dinahDreamEntity.mesh);
      }

      if (t >= 88 && !this.stateMachine.getFlag('landedInPassage')) {
        this.stateMachine.setFlag('landedInPassage', true);
        this.cutscenePlayer.playCutscene('C3', () => {
          this.characterController.setPosition(new THREE.Vector3(0, 0, 0));
          this.stateMachine.goto('S4_PASSAGE');
        });
      }
    }

    if (state === 'S4_PASSAGE') {
      if (this.characterController.position.x >= 16.5 && !this.stateMachine.getFlag('enteredHall')) {
        this.stateMachine.setFlag('enteredHall', true);
        this.cutscenePlayer.playCutscene('C4', () => {
          this.characterController.setPosition(new THREE.Vector3(-6.0, 0, 0));
          this.stateMachine.goto('S5_HALL');
        });
      }
    }
  }

  private triggerS2Chase(): void {
    this.stateMachine.setFlag('chaseStarted', true);
    this.cutscenePlayer.playCutscene('C1', () => {
      this.stateMachine.goto('S2_CHASE');
      this.characterController.setPosition(new THREE.Vector3(10.0, 0, -1.5));
    });
  }

  private handleCurtsey(): void {
    if (this.stateMachine.currentState === 'S3_FALL') {
      this.stateMachine.setFlag('curtsey', true);
      this.aliceEntity.playAnimation('Alice_CurtseyAir', 0.2, false);
      globalEventBus.emit('showCuriosityNote', 'Curtsey');
      globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
        id: 'ch1_s3_05',
        speaker: 'alice',
        type: 'say',
      });
    }
  }

  private handleDrinkBottle(): void {
    if (!this.puzzleManager.canDrinkBottle()) {
      console.log('[GameManager] INV-05: Cannot drink bottle before inspecting both front and back labels');
      return;
    }
    if (this.stateMachine.getFlag('bottleDrunk')) return;
    this.stateMachine.setFlag('bottleDrunk', true);
    this.stateMachine.setFlag('drinkButtonUnlocked', true);
    globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
      id: 'S6_SHRINK',
      speaker: 'alice',
      type: 'say',
    });
    this.characterController.setScale(0.2117, true);
    this.cutscenePlayer.playCutscene('C6', () => {
      this.characterController.setPosition(new THREE.Vector3(0.4, 0, -0.2));
      this.characterController.setScale(0.2117, false);
      this.stateMachine.goto('S6_SMALL');
    });
  }

  private handleInteraction(): void {
    const state = this.stateMachine.currentState;
    this.puzzleManager.resetIdleTimer();

    const interactable = this.getNearbyInteractable();

    if (state === 'S0_TITLE') {
      this.stateMachine.goto('S1_BANK');
      return;
    }

    if (state === 'S1_BANK') {
      if (interactable && interactable.startsWith('INT_daisy_')) {
        this.puzzleManager.addItem(interactable.replace('INT_', ''));
        const mesh = this.sceneLoader.propsMap.get(interactable);
        if (mesh) mesh.visible = false;
        const daisies = (this.stateMachine.getFlag('daisiesPicked') as number) || 0;
        if (daisies >= 2 && !this.stateMachine.getFlag('chaseStarted')) {
          this.triggerS2Chase();
        }
      }
    } else if (state === 'S2_CHASE') {
      if (interactable === 'INT_rabbit_hole') {
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'ch1_s2_02',
          speaker: 'narrator',
          type: 'narr',
        });
        this.cutscenePlayer.playCutscene('C2', () => {
          this.characterController.setPosition(new THREE.Vector3(0, 0, 0));
          this.stateMachine.goto('S3_FALL');
        });
      }
    } else if (state === 'S3_FALL') {
      if (!this.stateMachine.getFlag('jarTaken')) {
        this.stateMachine.setFlag('jarTaken', true);
        this.puzzleManager.addItem('marmalade_jar');
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'ch1_s3_02',
          speaker: 'narrator',
          type: 'narr',
        });
      } else if (this.stateMachine.getFlag('jarTaken') && !this.stateMachine.getFlag('jarStored')) {
        this.stateMachine.setFlag('jarStored', true);
        globalEventBus.emit('playSfx', 'sfx_jar_return');
      }
    } else if (state === 'S4_PASSAGE') {
      if (interactable === 'TRG_S4_exit' && !this.stateMachine.getFlag('enteredHall')) {
        this.stateMachine.setFlag('enteredHall', true);
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'ch1_s4_01',
          speaker: 'alice',
          type: 'say',
        });
        this.characterController.setPosition(new THREE.Vector3(-6.0, 0, 0));
        this.cutscenePlayer.playCutscene('C4', () => {
          this.stateMachine.goto('S5_HALL');
        });
      }
    } else if (state === 'S5_HALL') {
      const keyTaken = Boolean(this.stateMachine.getFlag('keyTaken'));
      const curtainFound = Boolean(this.stateMachine.getFlag('curtainFound'));
      const peekDone = Boolean(this.stateMachine.getFlag('peekDone'));

      if (interactable === 'INT_gold_key' && !keyTaken && !peekDone) {
        this.stateMachine.setFlag('keyTaken', true);
        this.stateMachine.setFlag('keyOnTable', false);
        this.puzzleManager.addItem('gold_key');
        const keyObj = this.sceneLoader.propsMap.get('INT_gold_key');
        if (keyObj) keyObj.visible = false;
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'S5_TABLE',
          speaker: 'alice',
          type: 'think',
        });
      } else if (interactable && interactable.startsWith('INT_door_')) {
        this.puzzleManager.interactWithDoor();
        const updatedTries = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
        if (updatedTries < 2) {
          globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
            id: 'S5_KEY_FAIL',
            speaker: 'alice',
            type: 'think',
          });
        }
      } else if (interactable === 'INT_curtain' && !curtainFound) {
        this.puzzleManager.interactWithCurtain();
        if (this.stateMachine.getFlag('curtainFound')) {
          const curtainObj = this.sceneLoader.propsMap.get('INT_curtain');
          if (curtainObj) curtainObj.position.x = -0.25;
          globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
            id: 'S5_CURTAIN_FOUND',
            speaker: 'alice',
            type: 'think',
          });
        }
      } else if (interactable === 'INT_little_door' && curtainFound && !peekDone) {
        this.stateMachine.setFlag('littleDoorUnlocked', true);
        // kneel beside the door (not in front of it) so the glide camera can look straight down the passage into the garden
        this.characterController.setPosition(new THREE.Vector3(-1.45, 0, -3.0));
        this.characterController.setFacing(Math.PI);
        this.sceneLoader.setLittleDoorOpen(true);
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'S5_PEEK',
          speaker: 'narrator',
          type: 'narr',
        });
        this.cutscenePlayer.playCutscene('C5', () => {
          this.stateMachine.setFlag('peekDone', true);
        });
      } else if (interactable === 'INT_bottle_drinkme' && peekDone) {
        if (!this.stateMachine.getFlag('bottleTaken')) {
          this.stateMachine.setFlag('bottleTaken', true);
          this.puzzleManager.addItem('drink_me_bottle');
          // Show gold key back on table per INV-03
          const keyObj = this.sceneLoader.propsMap.get('INT_gold_key');
          if (keyObj) keyObj.visible = true;
          const bottleItem = this.puzzleManager.getInventory().find((i) => i.id === 'drink_me_bottle');
          if (bottleItem) {
            globalEventBus.emit(GAME_EVENTS.INSPECT_ITEM, { item: bottleItem });
          }
        } else if (this.puzzleManager.canDrinkBottle()) {
          this.handleDrinkBottle();
        } else {
          const bottleItem = this.puzzleManager.getInventory().find((i) => i.id === 'drink_me_bottle');
          if (bottleItem) {
            globalEventBus.emit(GAME_EVENTS.INSPECT_ITEM, { item: bottleItem });
          }
        }
      }
      this.updatePromptForState(this.stateMachine.currentState);
    } else if (state === 'S6_SMALL') {
      if (interactable === 'INT_table_leg') {
        const attempts = (this.stateMachine.getFlag('climbAttempts') as number) || 0;
        this.stateMachine.setFlag('climbAttempts', attempts + 1);
        if (attempts + 1 >= 2) {
          globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
            id: 'ch1_s6_06',
            speaker: 'alice',
            type: 'say',
          });
          this.cutscenePlayer.playCutscene('C7', () => {
            this.stateMachine.goto('S7_CAKE');
          });
        }
      }
    } else if (state === 'S7_CAKE') {
      if (interactable === 'INT_glass_box' || interactable === 'INT_cake_eatme') {
        this.stateMachine.setFlag('boxOpened', true);
        this.stateMachine.setFlag('cakeEaten', true);
        this.puzzleManager.addItem('eat_me_cake');
        globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
          id: 'ch1_s7_02',
          speaker: 'alice',
          type: 'say',
        });
        this.cutscenePlayer.playCutscene('C8', () => {
          this.stateMachine.goto('END');
          globalEventBus.emit(GAME_EVENTS.CHAPTER_COMPLETE, {
            thoughts: (this.stateMachine.getFlag('thoughtsCollected') as number) || 5,
            notes: 5,
            curtseyUnlocked: Boolean(this.stateMachine.getFlag('curtsey')),
          });
        });
      }
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
