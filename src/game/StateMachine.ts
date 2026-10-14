import { GameStateID, GameFlags, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';
import { z } from 'zod';

const saveSchema = z.object({
  state: z.string(),
  flags: z.record(z.any())
});

export class StateMachine {
  public currentState: GameStateID = 'S0_TITLE';
  public flags: GameFlags = {
    daisiesPicked: 0,
    sisterBookInspected: false,
    rabbitSeen: false,

    chaseStarted: false,
    rabbitInHole: false,

    jarTaken: false,
    jarStored: false,
    jarDropBlocked: true,
    thoughts: [false, false, false, false, false],
    curtsey: false,

    doorsTried: 0,
    keyTaken: false,
    keyTriesOnDoors: 0,
    curtainRevealed: false,
    curtainFound: false,
    littleDoorUnlocked: false,
    littleDoorOpened: false,
    peekDone: false,

    bottleAppeared: false,
    bottleInspectedFront: false,
    bottleInspectedBack: false,
    drinkButtonUnlocked: false,
    drankPotion: false,
    bottleDrank: false,
    climbAttempts: 0,
    keyReturnedToTable: false,

    boxOpened: false,
    cakeEaten: false,
    chapterCompleted: false,

    idleSeconds: 0,
    stuckHintTier: 0,
    tableGlassTransparent: true,
    keyOnTableVisible: true,
    audioPitchFactor: 1.0,
    cutsceneC5Skipped: false,
  };

  private readonly SAVE_KEY = 'alice.save.v1';
  private savedData: any = null;

  constructor() {
    this.checkSavedGame();
  }

  public hasSavedGame(): boolean {
    return this.savedData !== null;
  }

  public restoreSavedGame(): void {
    if (this.savedData) {
      if (this.savedData.state) {
        this.currentState = this.savedData.state as GameStateID;
      }
      if (this.savedData.flags) {
        this.flags = { ...this.flags, ...this.savedData.flags };
      }
    }
  }

  private checkSavedGame(): void {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const result = saveSchema.safeParse(parsed);
        if (result.success) {
          this.savedData = result.data;
        } else {
          console.warn('[StateMachine] Save validation failed:', result.error);
        }
      }
    } catch (e) {
      console.warn('[StateMachine] Check save error:', e);
    }
  }

  public goto(nextState: GameStateID): void {
    const previous = this.currentState;
    this.currentState = nextState;
    console.log(`[StateMachine] Transition: ${previous} -> ${nextState}`);
    this.saveState();
    globalEventBus.emit(GAME_EVENTS.STATE_CHANGED, { from: previous, to: nextState });
  }

  public setFlag(key: string, value: unknown): void {
    this.flags[key] = value as any;
    // Removed this.saveState(); DO NOT save on every flag update
  }

  public getFlag(key: string): unknown {
    return this.flags[key];
  }

  public saveState(): void {
    try {
      const data = JSON.stringify({
        state: this.currentState,
        flags: this.flags,
      });
      localStorage.setItem(this.SAVE_KEY, data);
    } catch (e) {
      console.warn('[StateMachine] Save state error:', e);
    }
  }
}
