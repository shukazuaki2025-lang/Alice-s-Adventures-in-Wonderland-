import { GameManager } from './game/GameManager';
import { UIManager } from './ui/UIManager';
import { AudioManager } from './audio/AudioManager';
import { loadI18nData } from './ui/i18n';
import { registerTestHarness } from './testing/testHarness';
import { GameStateSnapshot } from './core/types';

console.log('[Alice: Down the Rabbit-Hole] Initializing game runtime...');

declare global {
  interface Window {
    __game?: {
      getState: () => GameStateSnapshot;
      getFlags: () => Record<string, unknown>;
      getFlag: (k: string) => unknown;
      getInventory: () => unknown[];
      getPlayerTransform: () => { position: { x: number, y: number, z: number }, rotation: { x: number, y: number, z: number }, scale: number };
      getInteractables: () => unknown[];
      getCameraState: () => {
        yaw: number; pitch: number; yawGoal: number; pitchGoal: number; zoom: number; distance: number; fov: number;
        cinematic: boolean; position: { x: number; y: number; z: number }; forward: { x: number; y: number; z: number };
      };
      getPlayerMotion: () => {
        velocity: { x: number; y: number; z: number }; speed: number; running: boolean; facing: number;
      };
      getRenderStats: () => { calls: number; triangles: number };
      getRenderBreakdown: () => Record<string, { meshes: number; hulls: number; shadowCasters: number; drawn: number }>;
      getNearbyInteractable: () => string | null;
      getAliceAnimation: () => unknown;
      getAliceBoneWorld: (name: string) => { x: number; y: number; z: number } | null;
      getSceneMetrics: () => unknown;
      setTimeScale: (n: number) => void;
      fastForward: (seconds: number) => void;
      movePlayerTo: (x: number, z: number) => void;
      lookAtBottleSide: (side: 'front' | 'back') => void;
    };
  }
}

class AliceGameBootstrap {
  private canvas: HTMLCanvasElement;
  private gameManager: GameManager | null = null;
  private uiManager: UIManager | null = null;
  private audioManager: AudioManager | null = null;

  public getUIManager(): UIManager | null {
    return this.uiManager;
  }
  public getAudioManager(): AudioManager | null {
    return this.audioManager;
  }

  constructor() {
    const canvasEl = document.getElementById('render-canvas') as HTMLCanvasElement;
    if (!canvasEl) {
      throw new Error('Canvas element #render-canvas not found in DOM');
    }
    this.canvas = canvasEl;
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await loadI18nData('/assets/i18n/ch1.json');
    } catch (e) {
      console.warn('[Bootstrap] Using embedded i18n data due to fetch error:', e);
    }

    this.uiManager = new UIManager();
    this.audioManager = new AudioManager();

    this.gameManager = new GameManager(this.canvas);
    await this.gameManager.init();
    // Only expose window.__game once every GLB is parsed and the loop is running: init() ends by re-applying the state's
    // visuals (Alice back to the spawn), so a harness that drove the game earlier would be teleported mid-test.
    registerTestHarness(this.gameManager);

    // Play title music (M1)
    this.audioManager.playMusic('M1');

    // Fade out loading screen
    const loader = document.getElementById('loading-screen');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 800);
      }, 500);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AliceGameBootstrap();
});
