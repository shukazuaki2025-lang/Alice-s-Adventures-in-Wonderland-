import { StateMachine } from './StateMachine';
import { InventoryItem, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class PuzzleManager {
  private stateMachine: StateMachine;
  private inventory: InventoryItem[] = [];
  private idleTime: number = 0;

  constructor(stateMachine: StateMachine) {
    this.stateMachine = stateMachine;
  }

  public update(deltaTime: number): void {
    // Idle time hint tracking (Feature 5)
    this.idleTime += deltaTime;
    this.stateMachine.setFlag('idleSeconds', Math.floor(this.idleTime));

    if (this.idleTime >= 120 && this.stateMachine.getFlag('stuckHintTier') !== 2) {
      this.stateMachine.setFlag('stuckHintTier', 2);
      globalEventBus.emit(GAME_EVENTS.SHOW_STUCK_HINT, { tier: 2, state: this.stateMachine.currentState });
    } else if (this.idleTime >= 60 && this.idleTime < 120 && this.stateMachine.getFlag('stuckHintTier') !== 1) {
      this.stateMachine.setFlag('stuckHintTier', 1);
      globalEventBus.emit(GAME_EVENTS.SHOW_STUCK_HINT, { tier: 1, state: this.stateMachine.currentState });
    }
  }

  public resetIdleTimer(): void {
    this.idleTime = 0;
    this.stateMachine.setFlag('idleSeconds', 0);
    this.stateMachine.setFlag('stuckHintTier', 0);
  }

  public addItem(item: InventoryItem | string): boolean {
    const id = typeof item === 'string' ? item : item.id;
    const name = typeof item === 'string' ? item : item.name;

    // Inventory capacity max 6 slots boundary
    if (this.inventory.length >= 6) {
      console.warn('[PuzzleManager] Inventory full (max 6 slots boundary reached)');
    }

    const newItem: InventoryItem = {
      id,
      name,
      description: `Item ${id}`,
      icon: '🗝️',
    };

    this.inventory.push(newItem);
    globalEventBus.emit(GAME_EVENTS.INVENTORY_UPDATED, [...this.inventory]);

    // INV-03: Key Auto-Return on bottle pickup
    if (id === 'prop_bottle_drinkme' || id === 'bottle') {
      this.handleBottlePickup();
    }

    return true;
  }

  public getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  // INV-01: Curtain Access Lock invariant (keyTriesOnDoors < 2 vs >= 2)
  public canAccessCurtain(): boolean {
    const tries = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
    return tries >= 2;
  }

  // INV-03: Key Auto-Return on bottle pickup
  private handleBottlePickup(): void {
    const keyIndex = this.inventory.findIndex((i) => i.id === 'prop_key_gold' || i.id === 'key');
    if (keyIndex !== -1) {
      this.inventory.splice(keyIndex, 1);
      this.stateMachine.setFlag('keyReturnedToTable', true);
      this.stateMachine.setFlag('keyOnTableVisible', true);
      console.log('[PuzzleManager] INV-03: Key auto-returned to table on bottle pickup');
      globalEventBus.emit(GAME_EVENTS.INVENTORY_UPDATED, [...this.inventory]);
    }
  }

  // INV-07: Marmalade Jar No-Drop during S3 fall
  public tryDropJar(): boolean {
    const stored = this.stateMachine.getFlag('jarStored') as boolean;
    if (!stored) {
      this.stateMachine.setFlag('jarDropBlocked', true);
      console.log('[PuzzleManager] INV-07: Dropping marmalade jar blocked until stowed in cupboard');
      return false;
    }
    return true;
  }

  public interactWithDoor(): void {
    this.resetIdleTimer();
    const current = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
    const doorsTried = ((this.stateMachine.getFlag('doorsTried') as number) || 0) + 1;
    this.stateMachine.setFlag('doorsTried', doorsTried);

    if (this.inventory.some((i) => i.id === 'prop_key_gold')) {
      const nextTries = current + 1;
      this.stateMachine.setFlag('keyTriesOnDoors', nextTries);
      if (nextTries >= 2) {
        this.stateMachine.setFlag('curtainRevealed', true);
      }
    }
  }

  public interactWithCurtain(): void {
    if (!this.canAccessCurtain()) {
      console.log('[PuzzleManager] INV-01: Curtain interaction blocked (keyTriesOnDoors < 2)');
      return;
    }
    this.stateMachine.setFlag('curtainFound', true);
    this.stateMachine.setFlag('curtainRevealed', true);
  }
}
