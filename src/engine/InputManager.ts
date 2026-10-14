import * as THREE from 'three';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class InputManager {
  public keys: Record<string, boolean> = {};
  public moveVector: THREE.Vector3 = new THREE.Vector3();
  private escPressTime: number = 0;
  private isEscHolding: boolean = false;

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
          if (holdDuration >= 0.5) {
            // Esc skip triggered (INV-06)
            globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'ESC_SKIP');
          }
          this.isEscHolding = false;
        }
      }
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
}
