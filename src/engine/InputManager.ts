import * as THREE from 'three';
import { globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

/** Radians of camera rotation per CSS pixel of mouse travel. */
const DRAG_SENSITIVITY = 0.0042;
/** Pointer-lock deltas are raw device counts, so they need a gentler factor. */
const LOCK_SENSITIVITY = 0.0026;
const TOUCH_SENSITIVITY = 0.0058;
/** Guards against the occasional giant movementX spike browsers emit around pointer-lock transitions. */
const MAX_DELTA_PER_EVENT = 140;
/** Pixels of mouse travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3;

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label, [role="button"], [data-no-orbit]';

/**
 * Keyboard + mouse + touch input.
 *
 * Camera control (all of these feed {@link consumeLook} / {@link consumeZoom}):
 *  - hold left / right / middle mouse button and drag  -> orbit the camera around Alice
 *  - mouse wheel                                       -> zoom in / out
 *  - `M` key                                           -> toggle pointer-lock mouse-look (no button needed)
 *  - one-finger drag / two-finger pinch                -> orbit / zoom on touch screens
 */
export class InputManager {
  public keys: Record<string, boolean> = {};
  public moveVector: THREE.Vector3 = new THREE.Vector3();
  private escPressTime: number = 0;
  private isEscHolding: boolean = false;

  /** Accumulated look delta in *radians* since the last {@link consumeLook}. x = yaw delta, y = pitch delta. */
  private lookX: number = 0;
  private lookY: number = 0;
  private zoomDelta: number = 0;

  /** True while a mouse button is held after a press that started on the game surface. */
  public isDragging: boolean = false;
  /** True once a held press has travelled further than DRAG_THRESHOLD. */
  public hasDragged: boolean = false;
  public isPointerLocked: boolean = false;
  /** Set by the game to swallow camera input (cutscenes, menus). */
  public lookEnabled: boolean = true;

  private dragPointerId: number | null = null;
  private dragTravel: number = 0;
  private lastX: number = 0;
  private lastY: number = 0;
  private touchPoints: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDistance: number = 0;
  private canvas: HTMLElement | null = null;

  constructor() {
    this.canvas = document.getElementById('render-canvas');
    this.setupListeners();
  }

  /** Shift held -> run. */
  public get sprint(): boolean {
    return Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }

  /** Mouse-look is considered active while dragging or while the pointer is locked. */
  public get isLooking(): boolean {
    return this.isPointerLocked || (this.isDragging && this.hasDragged);
  }

  private isUiTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return Boolean(el && typeof el.closest === 'function' && el.closest(INTERACTIVE_SELECTOR));
  }

  private addLook(dx: number, dy: number, sensitivity: number): void {
    if (!this.lookEnabled) return;
    const cx = Math.max(-MAX_DELTA_PER_EVENT, Math.min(MAX_DELTA_PER_EVENT, dx));
    const cy = Math.max(-MAX_DELTA_PER_EVENT, Math.min(MAX_DELTA_PER_EVENT, dy));
    this.lookX += cx * sensitivity;
    this.lookY += cy * sensitivity;
  }

  private setBodyCursor(): void {
    const cls = document.body.classList;
    cls.toggle('cam-dragging', this.isDragging && this.hasDragged);
    cls.toggle('cam-locked', this.isPointerLocked);
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && e.code !== 'Escape') {
        this.keys[e.code] = true;
        return;
      }
      this.keys[e.code] = true;

      if (e.code.startsWith('Arrow') || e.code === 'Space') {
        e.preventDefault();
      }

      if (e.code === 'KeyE') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'E');
      } else if (e.code === 'KeyC') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'C');
      } else if (e.code === 'KeyG' || e.code === 'KeyQ') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'DROP');
      } else if (e.code === 'KeyF') {
        globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, 'F');
      } else if (e.code === 'KeyM') {
        this.togglePointerLock();
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

    // Never leave a movement key "stuck" after alt-tab / focus loss.
    window.addEventListener('blur', () => {
      this.keys = {};
      this.endDrag();
    });

    // ---- Mouse / touch via Pointer Events -------------------------------------------------
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touchPoints.size === 2) {
          this.lastPinchDistance = this.pinchDistance();
        }
        if (this.touchPoints.size === 1 && !this.isUiTarget(e.target)) {
          this.isDragging = true;
          this.hasDragged = false;
          this.dragPointerId = e.pointerId;
          this.dragTravel = 0;
        }
        return;
      }
      // Any of left / middle / right may orbit.
      if (this.isUiTarget(e.target)) return;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.isDragging = true;
      this.hasDragged = false;
      this.dragPointerId = e.pointerId;
      this.dragTravel = 0;
      this.setBodyCursor();
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        const prev = this.touchPoints.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touchPoints.size >= 2) {
          const d = this.pinchDistance();
          if (this.lastPinchDistance > 0) {
            this.zoomDelta -= (d - this.lastPinchDistance) * 0.01;
          }
          this.lastPinchDistance = d;
        } else if (this.isDragging && e.pointerId === this.dragPointerId) {
          this.dragTravel += Math.hypot(dx, dy);
          if (this.dragTravel >= DRAG_THRESHOLD) this.hasDragged = true;
          this.addLook(dx, dy, TOUCH_SENSITIVITY);
        }
        return;
      }

      if (this.isPointerLocked) {
        this.addLook(e.movementX, e.movementY, LOCK_SENSITIVITY);
        return;
      }
      if (this.isDragging && (e.buttons & 7) !== 0) {
        // clientX deltas rather than movementX: identical in practice, but also correct for synthetic events.
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.dragTravel += Math.hypot(dx, dy);
        if (this.dragTravel >= DRAG_THRESHOLD && !this.hasDragged) {
          this.hasDragged = true;
          this.setBodyCursor();
        }
        this.addLook(dx, dy, DRAG_SENSITIVITY);
      } else if (this.isDragging) {
        // Button released outside the window.
        this.endDrag();
      }
    });

    const release = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') {
        this.touchPoints.delete(e.pointerId);
        if (this.touchPoints.size < 2) this.lastPinchDistance = 0;
        if (e.pointerId === this.dragPointerId) this.endDrag();
        return;
      }
      if (e.pointerId === this.dragPointerId || (e.buttons & 7) === 0) this.endDrag();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (this.isUiTarget(e.target)) return;
        // Normalise line / page deltas to ~pixels.
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        this.zoomDelta += (e.deltaY * unit) / 100;
        e.preventDefault();
      },
      { passive: false }
    );

    // Right-button drag must not open the browser menu over the game surface.
    window.addEventListener('contextmenu', (e) => {
      if (!this.isUiTarget(e.target)) e.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
      this.setBodyCursor();
    });
    document.addEventListener('pointerlockerror', () => {
      this.isPointerLocked = false;
      this.setBodyCursor();
    });
  }

  private pinchDistance(): number {
    const pts = [...this.touchPoints.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private endDrag(): void {
    this.isDragging = false;
    this.hasDragged = false;
    this.dragPointerId = null;
    this.setBodyCursor();
  }

  /** Toggle pointer-lock mouse-look (press M, or Esc to leave). */
  public togglePointerLock(): void {
    const target = this.canvas ?? document.body;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
      return;
    }
    try {
      const p = target.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Pointer lock can be refused in headless / embedded browsers; drag-orbit still works.
    }
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

  /**
   * Look delta accumulated since the previous call, in radians.
   * `x` is yaw (positive = mouse moved right), `y` is pitch (positive = mouse moved down).
   */
  public consumeLook(): { x: number; y: number } {
    const delta = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return delta;
  }

  /** Wheel / pinch zoom accumulated since the previous call. Positive = zoom out. */
  public consumeZoom(): number {
    const z = this.zoomDelta;
    this.zoomDelta = 0;
    return z;
  }

  /** Drop any pending camera input (used while paused / during cutscenes). */
  public discardLook(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.zoomDelta = 0;
  }
}
