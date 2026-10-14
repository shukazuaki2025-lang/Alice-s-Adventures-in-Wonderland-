import { GameManager } from '../game/GameManager';
import { GameStateSnapshot } from '../core/types';

export function registerTestHarness(gameManager: GameManager): void {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('test') !== '1') {
    return;
  }

  window.__game = {
    getState: (): GameStateSnapshot => {
      return gameManager.getSnapshot();
    },
    getFlags: () => {
      return { ...gameManager.stateMachine.flags };
    },
    getFlag: (flag: string) => {
      return gameManager.stateMachine.getFlag(flag);
    },
    getInventory: () => {
      return gameManager.puzzleManager.getInventory();
    },
    getPlayerTransform: () => {
      return {
        position: { x: gameManager.characterController.position.x, y: gameManager.characterController.position.y, z: gameManager.characterController.position.z },
        rotation: { x: gameManager.characterController.rotation.x, y: gameManager.characterController.rotation.y, z: gameManager.characterController.rotation.z },
        scale: gameManager.characterController.scale
      };
    },
    getCameraState: () => {
      const rig = gameManager.cameraRig;
      const fwd = rig.getForward();
      return {
        yaw: rig.yaw,
        pitch: rig.pitch,
        yawGoal: rig.yawGoal,
        pitchGoal: rig.pitchGoal,
        zoom: rig.zoom,
        distance: rig.distance,
        fov: rig.camera.fov,
        cinematic: rig.isCinematicActive,
        position: { x: rig.camera.position.x, y: rig.camera.position.y, z: rig.camera.position.z },
        forward: { x: fwd.x, y: fwd.y, z: fwd.z },
      };
    },
    getPlayerMotion: () => {
      const c = gameManager.characterController;
      return {
        velocity: { x: c.velocity.x, y: c.velocity.y, z: c.velocity.z },
        speed: c.speed,
        running: c.isRunning,
        facing: c.rotation.y,
      };
    },
    getAliceAnimation: () => gameManager.aliceEntity.getDebug(),
    getAliceBoneWorld: (name: string) => {
      const v = gameManager.aliceEntity.getBoneWorldPosition(name);
      return v ? { x: v.x, y: v.y, z: v.z } : null;
    },
    getInteractables: () => {
      const interactables: string[] = [];
      gameManager.sceneLoader.propsMap.forEach((_mesh, name) => {
        if (name.startsWith('INT_')) {
          interactables.push(name);
        }
      });
      return interactables;
    },
    getSceneMetrics: () => {
      return {
        spawns: gameManager.sceneLoader.markers.spawns.size,
        triggers: gameManager.sceneLoader.markers.triggers.size,
        cameras: gameManager.sceneLoader.markers.cameras.size
      };
    },
    setTimeScale: (n: number) => {
      gameManager.gameLoop.setTimeScale(n);
    },
    fastForward: (seconds: number) => {
      const dt = 1.0 / 30.0;
      const steps = Math.max(1, Math.floor(seconds / dt));
      const zeroMove = gameManager.characterController.position.clone().set(0, 0, 0);
      for (let i = 0; i < steps; i++) {
        gameManager.characterController.update(dt, zeroMove, gameManager.cameraRig.yaw, false);
        gameManager['onUpdate'](dt);
        gameManager.cameraRig.update(gameManager.characterController.position, dt);
      }
      gameManager.renderer.render(gameManager.scene, gameManager.cameraRig.camera);
    },
    movePlayerTo: (x: number, z: number) => {
      const pos = gameManager.characterController.position.clone();
      pos.x = x;
      pos.z = z;
      gameManager.characterController.setPosition(pos);
    },
    lookAtBottleSide: (side: 'front' | 'back') => {
      if (gameManager.itemInspector) {
        gameManager.itemInspector.inspectSide(side);
      }
    }
  };

  console.log('[TestHarness] window.__game harness successfully registered for testing');
}
