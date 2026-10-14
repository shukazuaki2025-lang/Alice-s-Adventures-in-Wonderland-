import { InventoryItem, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class ItemInspector {
  public isOpen: boolean = false;
  public currentItem: InventoryItem | null = null;
  private rotationX: number = 0;
  private rotationY: number = 0;
  private inspectedFront: boolean = false;
  private inspectedBack: boolean = false;
  private onVerifiedCallback?: () => void;

  constructor() {
    this.setupUIListeners();
  }

  private setupUIListeners(): void {
    globalEventBus.on(GAME_EVENTS.INSPECT_ITEM, (data: { item: InventoryItem; onVerified?: () => void }) => {
      this.open(data.item, data.onVerified);
    });
  }

  public open(item: InventoryItem, onVerified?: () => void): void {
    this.isOpen = true;
    this.currentItem = item;
    this.rotationX = 0;
    this.rotationY = 0;
    this.inspectedFront = false;
    this.inspectedBack = false;
    this.onVerifiedCallback = onVerified;

    console.log(`[ItemInspector] Inspecting item: ${item.name}`);
  }

  public rotate(deltaX: number, deltaY: number): void {
    if (!this.isOpen || !this.currentItem) return;

    this.rotationY += deltaX;
    this.rotationX += deltaY;

    const normalizedY = ((this.rotationY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Front face (~0 rad) vs Back face (~PI rad)
    if (normalizedY < 0.5 || normalizedY > Math.PI * 2 - 0.5) {
      this.inspectedFront = true;
      if (this.currentItem) this.currentItem.inspectedFront = true;
    }

    if (Math.abs(normalizedY - Math.PI) < 0.6) {
      this.inspectedBack = true;
      if (this.currentItem) this.currentItem.inspectedBack = true;
    }

    // Unlocks drink button when both front and back inspected (INV-05)
    if (this.inspectedFront && this.inspectedBack) {
      if (this.onVerifiedCallback) {
        this.onVerifiedCallback();
      }
    }
  }

  public close(): void {
    this.isOpen = false;
    this.currentItem = null;
  }
}
