import { StateMachine } from './StateMachine';
import { InventoryItem, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

const ITEM_CATALOG: Record<string, Omit<InventoryItem, 'id'>> = {
  daisy: { name: 'item.daisy.name', description: 'item.daisy.desc', icon: '🌼' },
  pocket_watch: { name: 'item.watch.name', description: 'item.watch.desc', icon: '⏱️' },
  marmalade_jar: { name: 'item.jar.name', description: 'item.jar.desc', icon: '🏺' },
  gold_key: { name: 'item.key.name', description: 'item.key.desc', icon: '🔑' },
  drink_me_bottle: { name: 'item.bottle.name', description: 'item.bottle.desc', icon: '🧪' },
  eat_me_cake: { name: 'item.cake.name', description: 'item.cake.desc', icon: '🧁' },
};

export class PuzzleManager {
  private stateMachine: StateMachine;
  private inventory: InventoryItem[] = [];
  private idleTime: number = 0;

  constructor(stateMachine: StateMachine) {
    this.stateMachine = stateMachine;
  }

  public update(deltaTime: number): void {
    const currentState = this.stateMachine.currentState;
    if (currentState === 'S0_TITLE' || currentState === 'END') return;

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
    const rawId = typeof item === 'string' ? item : item.id;
    let catalogId = rawId;

    if (rawId === 'daisy' || rawId.startsWith('daisy_')) {
      const picked = (this.stateMachine.getFlag('daisiesPicked') as number) || 0;
      this.stateMachine.setFlag('daisiesPicked', picked + 1);
      catalogId = 'daisy';
    } else if (rawId.includes('key')) catalogId = 'gold_key';
    else if (rawId.includes('jar')) catalogId = 'marmalade_jar';
    else if (rawId.includes('bottle')) catalogId = 'drink_me_bottle';
    else if (rawId.includes('cake')) catalogId = 'eat_me_cake';
    else if (rawId.includes('watch')) catalogId = 'pocket_watch';
    else catalogId = rawId;

    if (this.inventory.length >= 6) {
      console.warn('[PuzzleManager] Inventory full (max 6 slots boundary reached)');
    }

    const catalogData = ITEM_CATALOG[catalogId] || { name: `item.${catalogId}`, description: `desc.${catalogId}`, icon: '📦' };

    const newItem: InventoryItem = {
      id: catalogId,
      name: catalogData.name,
      description: catalogData.description,
      icon: catalogData.icon,
    };

    if (!this.inventory.some(i => i.id === catalogId)) {
      this.inventory.push(newItem);
      globalEventBus.emit(GAME_EVENTS.INVENTORY_UPDATED, [...this.inventory]);
    }

    // INV-03: Key Auto-Return on bottle pickup
    if (catalogId === 'drink_me_bottle') {
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
    const keyIndex = this.inventory.findIndex((i) => i.id === 'gold_key');
    if (keyIndex !== -1) {
      this.inventory.splice(keyIndex, 1);
      this.stateMachine.setFlag('keyTaken', false);
      this.stateMachine.setFlag('keyOnTable', true);
      this.stateMachine.setFlag('keyReturnedToTable', true);
      this.stateMachine.setFlag('keyOnTableVisible', true);
      // Play sound
      globalEventBus.emit('playSfx', 'sfx_key_down');
      console.log('[PuzzleManager] INV-03: Key auto-returned to table on bottle pickup');
      globalEventBus.emit(GAME_EVENTS.INVENTORY_UPDATED, [...this.inventory]);
    }
  }

  // INV-05: bottle front+back inspected before drinking
  public canDrinkBottle(): boolean {
    const front = Boolean(
      this.stateMachine.getFlag('bottleInspectedFront') ||
        this.stateMachine.getFlag('frontLabelChecked')
    );
    const back = Boolean(
      this.stateMachine.getFlag('bottleInspectedBack') ||
        this.stateMachine.getFlag('backLabelChecked')
    );
    return front && back;
  }

  // INV-07: Marmalade Jar No-Drop during S3 fall
  public tryDropJar(): boolean {
    const stored = this.stateMachine.getFlag('jarStored') as boolean;
    if (!stored) {
      this.stateMachine.setFlag('jarDropBlocked', true);
      console.log('[PuzzleManager] INV-07: Dropping marmalade jar blocked until stowed in cupboard');
      globalEventBus.emit(GAME_EVENTS.DIALOGUE_TRIGGER, {
        id: 'S3_JAR_NO_DROP',
        speaker: 'alice',
        type: 'think'
      });
      return false;
    }
    return true;
  }

  public interactWithDoor(): void {
    this.resetIdleTimer();
    const current = (this.stateMachine.getFlag('keyTriesOnDoors') as number) || 0;
    const doorsTried = ((this.stateMachine.getFlag('doorsTried') as number) || 0) + 1;
    this.stateMachine.setFlag('doorsTried', doorsTried);

    if (this.inventory.some((i) => i.id === 'gold_key')) {
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
