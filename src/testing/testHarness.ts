import { GameManager } from '../game/GameManager';
import { GameStateSnapshot, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';
import * as THREE from 'three';

export function registerTestHarness(gameManager: GameManager): void {
  window.__game = {
    goto: (state: string) => {
      console.log(`[TestHarness] goto(${state})`);
      const titleEl = document.getElementById('ui-title-screen');
      if (titleEl) {
        if (state === 'S0_TITLE') {
          titleEl.classList.remove('hidden');
        } else {
          titleEl.classList.add('hidden');
        }
      }

      gameManager.stateMachine.goto(state);

      // Reposition player based on state spawn points
      if (state === 'S1_BANK') {
        gameManager.characterController.setPosition(new THREE.Vector3(2.0, 0, 0));
        gameManager.characterController.setScale(1.0);
      } else if (state === 'S2_CHASE') {
        gameManager.characterController.setPosition(new THREE.Vector3(10.0, 0, -1.5));
        gameManager.characterController.setScale(1.0);
      } else if (state === 'S3_FALL') {
        gameManager.characterController.setPosition(new THREE.Vector3(0, 0, 0));
        gameManager.characterController.setScale(1.0);
      } else if (state === 'S4_PASSAGE') {
        gameManager.characterController.setPosition(new THREE.Vector3(0, 0, 0));
        gameManager.characterController.setScale(1.0);
      } else if (state === 'S5_HALL') {
        gameManager.characterController.setPosition(new THREE.Vector3(0, 0, 0));
        gameManager.characterController.setScale(1.0);
      } else if (state === 'S6_SMALL') {
        gameManager.characterController.setPosition(new THREE.Vector3(0.4, 0, -0.2));
        gameManager.characterController.setScale(0.254);
        gameManager.stateMachine.setFlag('audioPitchFactor', 1.6);
      } else if (state === 'S7_CAKE') {
        gameManager.characterController.setPosition(new THREE.Vector3(0.5, 0, -0.3));
        gameManager.characterController.setScale(0.254);
      } else if (state === 'END') {
        gameManager.stateMachine.setFlag('chapterCompleted', true);
        globalEventBus.emit(GAME_EVENTS.CHAPTER_COMPLETE, {
          thoughts: 5,
          notes: 5,
          curtseyUnlocked: true,
        });
      }
    },

    setFlag: (flag: string, value: unknown) => {
      gameManager.stateMachine.setFlag(flag, value);
    },

    getFlag: (flag: string) => {
      return gameManager.stateMachine.getFlag(flag);
    },

    addItem: (itemId: string) => {
      gameManager.puzzleManager.addItem(itemId);
    },

    setScale: (scale: number) => {
      gameManager.characterController.setScale(scale);
      if (scale <= 0.3) {
        gameManager.stateMachine.setFlag('audioPitchFactor', 1.6);
      } else {
        gameManager.stateMachine.setFlag('audioPitchFactor', 1.0);
      }
    },

    getState: (): GameStateSnapshot => {
      return gameManager.getSnapshot();
    },

    triggerInteraction: (id: string) => {
      console.log(`[TestHarness] triggerInteraction(${id})`);
      globalEventBus.emit(GAME_EVENTS.INTERACTION_TRIGGERED, id);
    },
  };

  console.log('[TestHarness] window.__game harness successfully registered');
}
