import * as THREE from 'three';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class InputManager {
  public keys: Record<string, boolean> = {};
  public moveVector: THREE.Vector3 = new THREE.Vector3();
  private escPressTime: number = 0;
  private isEscHolding: boolean = false;
  
  public mouseDeltaX: number = 0;
  public mouseDeltaY: number = 0;
  private isDragging: boolean = false;
  private isPointerLocked: boolean = false;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyE') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'E');
      } else if (e.code === 'KeyC') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'C');
      } else if (e.code === 'KeyG' || e.code === 'KeyQ') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'DROP');
      } else if (e.code === 'KeyF') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'F');
      } else if (e.code === 'Escape') {
        if (!this.isEscHolding) {
          this.isEscHolding = true;
          this.escPressTime = performance.now();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'Escape') {
        if (this.isEscHolding) {
          const holdDuration = (performance.now() - this.escPressTime) / 1000;
          if (holdDuration >= 1.0) {
            // Esc skip triggered (INV-06)
            globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'ESC_SKIP');
          }
          this.isEscHolding = false;
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          target.id === 'render-canvas' &&
          !this.isPointerLocked &&
          document.pointerLockElement !== document.body
        ) {
          try {
            const p = document.body.requestPointerLock?.() as unknown as Promise<void> | undefined;
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {
            // Ignore pointer lock rejection in headless browser
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDragging = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === document.body) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      } else if (this.isDragging) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });
  }

  public update(): THREE.Vector3 {
    this.moveVector.set(0, 0, 0);

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      this.moveVector.z -= 1;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      this.moveVector.z += 1;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      this.moveVector.x -= 1;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      this.moveVector.x += 1;
    }

    if (this.isEscHolding && (performance.now() - this.escPressTime) >= 1000) {
      globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'ESC_SKIP');
      this.isEscHolding = false;
    }

    return this.moveVector.normalize();
  }

  public consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }
}
