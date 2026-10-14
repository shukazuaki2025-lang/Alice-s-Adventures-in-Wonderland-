/**
 * Core interface contracts and types for Alice: Down the Rabbit-Hole
 */

export type GameStateID =
  | 'S0_TITLE'
  | 'S1_BANK'
  | 'S2_CHASE'
  | 'S3_FALL'
  | 'S4_PASSAGE'
  | 'S5_HALL'
  | 'S6_SMALL'
  | 'S7_CAKE'
  | 'END'
  | string;

export type Language = 'en' | 'zh' | 'ja';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string; // SVG icon or data URI or emoji
  inspectedFront?: boolean;
  inspectedBack?: boolean;
  modelPath?: string;
}

export interface GameFlags {
  // S1 Flags
  daisiesPicked: number;
  sisterBookInspected: boolean;
  rabbitSeen: boolean;

  // S2 Flags
  chaseStarted: boolean;
  rabbitInHole: boolean;

  // S3 Flags
  jarTaken: boolean;
  jarStored: boolean;
  jarDropBlocked: boolean;
  thoughts: [boolean, boolean, boolean, boolean, boolean];
  curtsey: boolean;

  // S5 Flags
  doorsTried: number;
  keyTaken: boolean;
  keyTriesOnDoors: number;
  curtainRevealed: boolean;
  curtainFound: boolean;
  littleDoorUnlocked: boolean;
  littleDoorOpened: boolean;
  peekDone: boolean;

  // S6 Flags
  bottleAppeared: boolean;
  bottleInspectedFront: boolean;
  bottleInspectedBack: boolean;
  drinkButtonUnlocked: boolean;
  drankPotion: boolean;
  bottleDrank: boolean;
  climbAttempts: number;
  keyReturnedToTable: boolean;

  // S7 Flags
  boxOpened: boolean;
  cakeEaten: boolean;
  chapterCompleted: boolean;

  // Global / Helper Flags
  idleSeconds: number;
  stuckHintTier: number;
  tableGlassTransparent: boolean;
  keyOnTableVisible: boolean;
  audioPitchFactor: number;
  cutsceneC5Skipped: boolean;
  [key: string]: unknown;
}

export interface GameStateSnapshot {
  state: GameStateID;
  aliceScale: number; // 1.0 = normal (1.20m), 0.254 = small (0.254m), 2.90 = giant (2.90m)
  inventory: InventoryItem[];
  flags: Record<string, boolean | number | string>;
  playerPosition?: { x: number; y: number; z: number };
  cameraPosition?: { x: number; y: number; z: number };
  language?: Language;
  audioVolumes?: {
    master: number;
    music: number;
    sfx: number;
    vo: number;
  };
  subtitlesEnabled?: boolean;
}

export type EventCallback = (...args: any[]) => void;

export class SimpleEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.error(`[EventBus] Error in event listener for '${event}':`, e);
        }
      });
    }
  }
}

export const globalEventBus = new SimpleEventBus();
