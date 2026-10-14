import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { convertMaterialsToToon } from '../../shaders/ToonShaders';
import { applyInkOutline } from '../../shaders/InkOutline';
import { ALICE_SCALES } from '../../core/constants';
import { globalEventBus } from '../../core/types';

/** Model-space speed (m/s at scale 1.0) at which the walk / run clips play at their authored rate. */
export const WALK_REF_SPEED = 1.2;
export const RUN_REF_SPEED = 2.6;

const LOCOMOTION = ['Alice_Idle', 'Alice_Walk', 'Alice_Run'] as const;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (lambda: number, dt: number): number => 1 - Math.exp(-lambda * dt);

export interface AliceAnimDebug {
  /** Name of the clip that is currently driving the body (one-shot override wins over locomotion). */
  active: string;
  weights: { idle: number; walk: number; run: number };
  override: string | null;
  walkTimeScale: number;
  modelSpeed: number;
  clips: string[];
  lean: { pitch: number; roll: number };
}

/**
 * Alice's visual entity: loads the rigged GLB, blends idle / walk / run continuously from the character's real
 * velocity (foot-synced), layers one-shot story animations on top, and adds a small procedural lean so the body
 * leans into acceleration and banks into turns.
 */
export class AliceEntity {
  public mesh: THREE.Group = new THREE.Group();
  public scale: number = ALICE_SCALES.NORMAL;
  public mixer?: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private model?: THREE.Group;
  /** The head is exported as several primitives (skin, lids, mouth, lips, brows) that share one set of morph targets. */
  private headMeshes: THREE.Mesh[] = [];
  private rightHandSocket?: THREE.Object3D;
  private leftHandSocket?: THREE.Object3D;

  // locomotion blend state
  private weights = { idle: 1, walk: 0, run: 0 };
  private locoPhase = 0;
  private walkTimeScale = 1;
  private modelSpeed = 0;
  private overrideAction: THREE.AnimationAction | null = null;
  private overrideName: string | null = null;
  private overrideWeight = 0;
  private overrideLooping = false;

  // procedural layer
  private leanPitch = 0;
  private leanRoll = 0;
  private prevSpeed = 0;
  private blinkTimer = 2.5;
  private blinkPhase = -1;
  private morphWeights: Record<string, number> = {};

  public loaded: Promise<void>;

  constructor() {
    this.loaded = this.loadModel();

    // Cutscene timelines address actors by name.
    globalEventBus.on('playAnimation', (e: { target?: string; animation?: string }) => {
      if (!e || !e.animation) return;
      if (e.target === 'chr_alice' || e.target === 'alice') {
        this.playAnimation(e.animation, 0.25, false);
      }
    });
  }

  private loadModel(): Promise<void> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        '/assets/models/chr_alice.glb',
        (gltf) => {
          const model: THREE.Group = gltf.scene;
          this.model = model;
          model.scale.set(this.scale, this.scale, this.scale);

          this.mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip: THREE.AnimationClip) => {
            const action = this.mixer!.clipAction(clip);
            this.actions.set(clip.name, action);
          });
          this.mixer.addEventListener('finished', (ev) => {
            if (ev.action === this.overrideAction && !this.overrideLooping) {
              this.releaseOverride(0.35);
            }
          });

          convertMaterialsToToon(model);
          applyInkOutline(model);

          model.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = false;
              mesh.frustumCulled = false; // skinned bounds are static; avoid popping while animating
              if (mesh.name.startsWith('Alice_Head') && mesh.morphTargetDictionary) {
                this.headMeshes.push(mesh);
              }
            }
            if (child.name === 'SOCKET_HandR') this.rightHandSocket = child;
            if (child.name === 'SOCKET_HandL') this.leftHandSocket = child;
          });

          // Start every locomotion clip together; weights + explicit phase drive them from here on.
          for (const name of LOCOMOTION) {
            const a = this.actions.get(name);
            if (!a) continue;
            a.setLoop(THREE.LoopRepeat, Infinity);
            a.enabled = true;
            a.setEffectiveWeight(name === 'Alice_Idle' ? 1 : 0);
            a.play();
          }
          this.mesh.add(model);
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }

  public get clipNames(): string[] {
    return [...this.actions.keys()];
  }

  public setExpression(expression: string, weight: number = 1.0): void {
    this.morphWeights[expression] = weight;
    this.applyMorph(expression, weight);
  }

  private applyMorph(name: string, weight: number): void {
    for (const head of this.headMeshes) {
      if (head.morphTargetDictionary && head.morphTargetInfluences) {
        const idx = head.morphTargetDictionary[name];
        if (idx !== undefined) head.morphTargetInfluences[idx] = weight;
      }
    }
  }

  /**
   * Play a named clip. Locomotion names are driven automatically from velocity, so asking for them just releases any
   * story override. Anything else is a one-shot (or looping when `loop` is true) that fades in over the locomotion
   * layer and hands control back when it finishes.
   */
  public playAnimation(name: string, fadeDuration: number = 0.2, loop: boolean = false): void {
    if ((LOCOMOTION as readonly string[]).includes(name)) {
      this.releaseOverride(fadeDuration);
      return;
    }
    const next = this.actions.get(name);
    if (!next) return;
    if (this.overrideAction && this.overrideAction !== next) {
      this.overrideAction.fadeOut(fadeDuration);
    }
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.fadeIn(fadeDuration).play();
    this.overrideAction = next;
    this.overrideName = name;
    this.overrideLooping = loop;
    this.overrideWeight = 0;
  }

  public releaseOverride(fadeDuration: number = 0.3): void {
    if (this.overrideAction) {
      this.overrideAction.fadeOut(fadeDuration);
      this.overrideAction = null;
      this.overrideName = null;
      this.overrideLooping = false;
    }
  }

  public attachToHand(side: 'left' | 'right', obj: THREE.Object3D): void {
    const socket = side === 'right' ? this.rightHandSocket : this.leftHandSocket;
    if (socket) {
      socket.add(obj);
    }
  }

  /**
   * @param delta   seconds since last frame
   * @param velocity horizontal world velocity of Alice in m/s (as produced by CharacterController)
   * @param turnRate facing angular velocity in rad/s (positive = turning left / counter-clockwise from above)
   */
  public update(delta: number, velocity: THREE.Vector3, turnRate: number = 0): void {
    if (!this.mixer) return;

    const speed = Math.hypot(velocity.x, velocity.z);
    const modelSpeed = speed / Math.max(0.05, this.scale);
    this.modelSpeed = modelSpeed;

    // A looping story pose (sit-cry etc.) ends as soon as the player moves.
    if (this.overrideAction && this.overrideLooping && modelSpeed > 0.4) {
      this.releaseOverride(0.3);
    }

    // ---- locomotion weights (continuous blend by speed) ---------------------------------------------------------
    const moveAmt = smoothstep(0.06, 0.5, modelSpeed);
    const runAmt = smoothstep(1.7, 2.3, modelSpeed);
    const target = {
      idle: 1 - moveAmt,
      walk: moveAmt * (1 - runAmt),
      run: moveAmt * runAmt,
    };
    const wBlend = damp(12, delta);
    this.weights.idle += (target.idle - this.weights.idle) * wBlend;
    this.weights.walk += (target.walk - this.weights.walk) * wBlend;
    this.weights.run += (target.run - this.weights.run) * wBlend;

    // Story animations take over the body; locomotion fades under them.
    const overrideTarget = this.overrideAction ? 1 : 0;
    this.overrideWeight += (overrideTarget - this.overrideWeight) * damp(10, delta);
    const loco = 1 - Math.min(1, this.overrideWeight);

    const idle = this.actions.get('Alice_Idle');
    const walk = this.actions.get('Alice_Walk');
    const run = this.actions.get('Alice_Run');
    if (idle) idle.setEffectiveWeight(this.weights.idle * loco);
    if (walk) walk.setEffectiveWeight(this.weights.walk * loco);
    if (run) run.setEffectiveWeight(this.weights.run * loco);

    // ---- foot sync: one shared gait phase, advanced by real ground speed -----------------------------------------
    if (walk && run) {
      const walkDur = walk.getClip().duration;
      const runDur = run.getClip().duration;
      const cyclesPerSecWalk = (modelSpeed / WALK_REF_SPEED) / walkDur;
      const cyclesPerSecRun = (modelSpeed / RUN_REF_SPEED) / runDur;
      const cps = THREE.MathUtils.lerp(cyclesPerSecWalk, cyclesPerSecRun, this.weights.run / Math.max(0.001, this.weights.walk + this.weights.run));
      if (moveAmt > 0.02) {
        this.locoPhase = (this.locoPhase + cps * delta) % 1;
      }
      walk.timeScale = 0;
      run.timeScale = 0;
      walk.time = this.locoPhase * walkDur;
      run.time = this.locoPhase * runDur;
      this.walkTimeScale = cyclesPerSecWalk * walkDur;
    } else if (walk) {
      walk.timeScale = THREE.MathUtils.clamp(modelSpeed / WALK_REF_SPEED, 0.4, 1.8);
      this.walkTimeScale = walk.timeScale;
    }

    this.mixer.update(delta);

    // ---- procedural layer (after the mixer so it composes on the sampled pose) -----------------------------------
    if (this.model) {
      const accel = (speed - this.prevSpeed) / Math.max(delta, 1e-4);
      this.prevSpeed = speed;
      const wantPitch = THREE.MathUtils.clamp(modelSpeed * 0.035 + accel * 0.01, -0.06, 0.16) * (1 - this.overrideWeight);
      const wantRoll = THREE.MathUtils.clamp(-turnRate * Math.min(1, modelSpeed) * 0.04, -0.12, 0.12) * (1 - this.overrideWeight);
      this.leanPitch += (wantPitch - this.leanPitch) * damp(8, delta);
      this.leanRoll += (wantRoll - this.leanRoll) * damp(8, delta);
      this.model.rotation.x = this.leanPitch;
      this.model.rotation.z = this.leanRoll;
    }

    this.updateBlink(delta);
  }

  /** Procedural blink on the 'Blink' morph target when the model provides one. */
  private updateBlink(delta: number): void {
    const head = this.headMeshes[0];
    if (!head || !head.morphTargetDictionary || head.morphTargetDictionary['Blink'] === undefined) return;
    this.blinkTimer -= delta;
    if (this.blinkPhase < 0 && this.blinkTimer <= 0) {
      this.blinkPhase = 0;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += delta / 0.16;
      const w = this.blinkPhase < 0.5 ? this.blinkPhase * 2 : Math.max(0, 2 - this.blinkPhase * 2);
      this.applyMorph('Blink', w);
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1;
        this.blinkTimer = 2.2 + Math.random() * 3.2;
        this.applyMorph('Blink', 0);
      }
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

  /** Read-only snapshot for the test harness / quality gate. */
  public getDebug(): AliceAnimDebug {
    const w = this.weights;
    let active = 'Alice_Idle';
    if (this.overrideName && this.overrideWeight > 0.5) active = this.overrideName;
    else if (w.run > w.walk && w.run > w.idle) active = 'Alice_Run';
    else if (w.walk > w.idle) active = 'Alice_Walk';
    return {
      active,
      weights: { idle: w.idle, walk: w.walk, run: w.run },
      override: this.overrideName,
      walkTimeScale: this.walkTimeScale,
      modelSpeed: this.modelSpeed,
      clips: this.clipNames,
      lean: { pitch: this.leanPitch, roll: this.leanRoll },
    };
  }

  /** World-space positions of named bones, for gait assertions. */
  public getBoneWorldPosition(name: string, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 | null {
    if (!this.model) return null;
    const bone = this.model.getObjectByName(name);
    if (!bone) return null;
    this.model.updateWorldMatrix(true, true);
    return bone.getWorldPosition(out);
  }
}
