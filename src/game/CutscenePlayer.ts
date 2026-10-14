import { StateMachine } from './StateMachine';
import { CameraRig } from '../engine/CameraRig';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';
import * as THREE from 'three';

export interface CutsceneTrackEvent {
  time: number;
  type: 'camera' | 'animation' | 'dialogue' | 'audio' | 'flag' | 'scale' | 'state';
  target?: string;
  payload?: Record<string, any>;
  duration?: number; // In case it comes from somewhere, though duration is usually in payload
}

export interface CutsceneTimelineData {
  id: string;
  title: string;
  duration: number;
  events: CutsceneTrackEvent[];
  terminalFlags: Record<string, any>;
}

export class CutscenePlayer {
  public isPlaying: boolean = false;
  public currentCutsceneId: string | null = null;
  public activeTimeline: CutsceneTimelineData | null = null;
  private stateMachine: StateMachine;
  private cameraRig: CameraRig;
  private loadedTimelines: Map<string, CutsceneTimelineData> = new Map();

  private currentTime: number = 0;
  private firedEvents: Set<CutsceneTrackEvent> = new Set();
  private onCompleteCallback?: () => void;

  constructor(stateMachine: StateMachine, cameraRig: CameraRig) {
    this.stateMachine = stateMachine;
    this.cameraRig = cameraRig;

    globalEventBus.on(GAME_EVENTS.INTERACTION_TRIGGERED, (action: string) => {
      if (action === 'ESC_SKIP' && this.isPlaying) {
        this.skip();
      }
    });

    globalEventBus.on('skipCutscene', () => {
      if (this.isPlaying) {
        this.skip();
      }
    });
  }

  public async preloadAll(): Promise<void> {
    const ids = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
    await Promise.all(ids.map((id) => this.loadCutsceneTimeline(id)));
  }

  public async loadCutsceneTimeline(id: string): Promise<CutsceneTimelineData> {
    if (this.loadedTimelines.has(id)) {
      return this.loadedTimelines.get(id)!;
    }

    const defaultDurations: Record<string, number> = {
      C1: 8, C2: 6, C3: 5, C4: 6, C5: 7, C6: 6, C7: 5, C8: 10,
    };
    const fallback: CutsceneTimelineData = {
      id,
      title: id,
      duration: defaultDurations[id] || 6,
      events: [],
      terminalFlags: {},
    };

    try {
      if (typeof fetch !== 'undefined') {
        const url = `/assets/cutscenes/ch1/${id}.json`;
        const response = await fetch(url);
        if (response.ok) {
          const data: CutsceneTimelineData = await response.json();
          this.loadedTimelines.set(id, data);
          return data;
        }
      }
    } catch {
      // Fallback in Node unit test or offline environment
    }
    this.loadedTimelines.set(id, fallback);
    return fallback;
  }

  public async playCutscene(id: string, onComplete?: () => void): Promise<void> {
    this.isPlaying = true;
    this.currentCutsceneId = id;
    this.currentTime = 0;
    this.firedEvents.clear();
    this.onCompleteCallback = onComplete;
    console.log(`[CutscenePlayer] Playing JSON timeline cutscene: ${id}`);

    // Set synchronous timeline immediately if preloaded, or fallback while loading
    const defaultDurations: Record<string, number> = {
      C1: 8, C2: 6, C3: 5, C4: 6, C5: 7, C6: 6, C7: 5, C8: 10,
    };
    this.activeTimeline = this.loadedTimelines.get(id) || {
      id,
      title: id,
      duration: defaultDurations[id] || 6,
      events: [],
      terminalFlags: {},
    };

    globalEventBus.emit(GAME_EVENTS.CUTSCENE_START, id);

    if (!this.loadedTimelines.has(id)) {
      const timeline = await this.loadCutsceneTimeline(id);
      if (this.isPlaying && this.currentCutsceneId === id) {
        this.activeTimeline = timeline;
      }
    }
  }

  public update(dt: number): void {
    if (!this.isPlaying || !this.activeTimeline) return;

    this.currentTime += dt;

    for (const event of this.activeTimeline.events) {
      if (this.currentTime >= event.time && !this.firedEvents.has(event)) {
        this.executeEvent(event, false);
        this.firedEvents.add(event);
      }
    }

    if (this.currentTime >= this.activeTimeline.duration) {
      this.finishCutscene();
    }
  }

  public skip(): void {
    if (!this.isPlaying || !this.currentCutsceneId) return;
    console.log(`[CutscenePlayer] Skipping cutscene: ${this.currentCutsceneId} via 1.0s Esc skip (INV-06 parity)`);
    
    if (this.activeTimeline) {
      for (const event of this.activeTimeline.events) {
        if (!this.firedEvents.has(event)) {
          this.executeEvent(event, true);
          this.firedEvents.add(event);
        }
      }
    }
    
    if (this.currentCutsceneId === 'C5') {
      this.stateMachine.setFlag('cutsceneC5Skipped', true);
    }

    this.finishCutscene();
  }

  private executeEvent(event: CutsceneTrackEvent, isSkipping: boolean): void {
    const { type, target, payload } = event;
    if (!payload) return;

    switch (type) {
      case 'camera':
        if (payload.mode === 'RESET_CONTROL') {
          this.cameraRig.exitCinematic();
        } else if (payload.position && payload.lookAt) {
          const pos = new THREE.Vector3().fromArray(payload.position);
          const lookAt = new THREE.Vector3().fromArray(payload.lookAt);
          // If skipping, duration could be 0, but CameraRig transitionToAnchor doesn't perfectly support 0, 
          // let's just pass 0.001 if skipping, otherwise standard duration or 2.0
          const duration = isSkipping ? 0.001 : (payload.duration || 2.0);
          this.cameraRig.transitionToAnchor(pos, lookAt, duration);
        }
        break;
      case 'animation':
        // actor animation callbacks
        globalEventBus.emit('playAnimation', { target, animation: payload.animation, position: payload.position });
        break;
      case 'dialogue':
        if (!isSkipping) {
          const lineId = payload.lineId || payload.id;
          const speaker =
            target === 'chr_rabbit' || target === 'rabbit'
              ? 'rabbit'
              : target === 'narrator'
                ? 'narrator'
                : 'alice';
          if (lineId) {
            globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
              id: lineId,
              lineId,
              speaker,
              target,
            });
          }
        }
        break;
      case 'audio':
        if (!isSkipping) {
          if (payload.sfx) {
            globalEventBus.emit('playSfx', payload.sfx);
          } else if (payload.track) {
            globalEventBus.emit('playMusic', payload.track);
          }
        }
        break;
      case 'flag':
        if (payload.flag && payload.value !== undefined) {
          this.stateMachine.setFlag(payload.flag, payload.value);
        }
        break;
      case 'scale':
        globalEventBus.emit(GAME_EVENTS.SCALE_CHANGED, payload.to);
        // Also if you need smooth scaling you might emit an event for it
        globalEventBus.emit('scaleChange', { target, from: payload.from, to: payload.to, duration: isSkipping ? 0 : payload.duration });
        break;
      case 'state':
        if (payload.goto) {
          this.stateMachine.goto(payload.goto);
        }
        break;
    }
  }

  private applyTerminalState(): void {
    const timeline = this.activeTimeline;
    if (timeline && timeline.terminalFlags) {
      for (const [key, val] of Object.entries(timeline.terminalFlags)) {
        this.stateMachine.setFlag(key, val);
      }
    }
  }

  private finishCutscene(): void {
    const id = this.currentCutsceneId;
    
    // Always apply terminal flags at the very end
    this.applyTerminalState();
    
    // Close any open dialogues deterministically
    globalEventBus.emit('dialogueEnd');

    this.isPlaying = false;
    this.currentCutsceneId = null;
    this.activeTimeline = null;
    this.cameraRig.exitCinematic();
    globalEventBus.emit(GAME_EVENTS.CUTSCENE_END, id);
    if (this.onCompleteCallback) this.onCompleteCallback();
  }
}
