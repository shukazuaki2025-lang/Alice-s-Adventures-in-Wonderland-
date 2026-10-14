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
    getRenderStats: () => ({ ...gameManager.renderer.sceneStats }),
    /** visible meshes grouped by their top-level scene group — shows where the draw calls go */
    getRenderBreakdown: () => {
      const out: Record<string, { meshes: number; hulls: number; shadowCasters: number; drawn: number }> = {};
      const isVisible = (o: import('three').Object3D): boolean => {
        for (let n: import('three').Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
        return true;
      };
      gameManager.scene.traverse((o) => {
        const m = o as import('three').Mesh;
        if (!m.isMesh || !isVisible(m)) return;
        let top: import('three').Object3D = m;
        while (top.parent && top.parent !== gameManager.scene) top = top.parent;
        const key = top.name || top.type;
        const e = (out[key] ??= { meshes: 0, hulls: 0, shadowCasters: 0, drawn: 0 });
        e.meshes++;
        if (m.name.endsWith('_ink_outline')) e.hulls++;
        if (m.castShadow) e.shadowCasters++;
        e.drawn += Array.isArray(m.material) ? m.material.length : 1;
      });
      return out;
    },
    /** which INT_/TRG_ prop the E key would act on right now (null = nothing eligible in reach) */
    getNearbyInteractable: () => gameManager['getNearbyInteractable'](),
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

  // dev-only lab hook (?lab=1): lets a scratch spec tune lighting / grade live. Never present in a normal run.
  if (urlParams.get('lab') === '1') (window as any).__lab = { gm: gameManager };

  console.log('[TestHarness] window.__game harness successfully registered for testing');
}
