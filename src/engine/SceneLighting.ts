import * as THREE from 'three';
import { GameStateID as GameState } from '../core/types';
import { GradeParams, NEUTRAL_GRADE, lerpGrade } from '../shaders/PaperGrain';

/**
 * Colour grade of each world, applied by the final post pass (src/shaders/PaperGrain.ts).
 * Every one is a split-tone: lights lean toward warm paper-amber, shadows toward cool violet-teal, so there are always two
 * temperatures in play; the underground grades hold saturation back (the brick/earth palette is already hot) and open the
 * contrast so lamp pools read against deep soft shadow.
 */
export const GRADE_DAY: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.93, 0.96, 1.07],
  highlightTint: [1.05, 1.01, 0.92],
  lift: [0.012, 0.008, 0.03],
  contrast: 0.3,
  saturation: 0.95,
  satCompress: 0.15,
  vignette: 0.28,
  vignetteTint: [0.62, 0.58, 0.74],
  clarity: 0.9,
  clarityBroad: 0.5,
  bloom: 0.22,
  bloomTint: [1.0, 0.88, 0.62],
  bloomThreshold: 0.85,
  granulation: 0.05,
  mottle: 0.035,
};

export const GRADE_WELL: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.9, 0.9, 1.12],
  highlightTint: [1.08, 1.0, 0.88],
  lift: [0.02, 0.012, 0.04],
  contrast: 0.45,
  saturation: 0.82,
  satCompress: 0.55,
  vignette: 0.45,
  vignetteTint: [0.5, 0.42, 0.62],
  clarity: 1.2,
  clarityBroad: 0.7,
  bloom: 0.5,
  bloomTint: [1.0, 0.72, 0.4],
  bloomThreshold: 0.7,
  granulation: 0.06,
  mottle: 0.04,
};

export const GRADE_WELL_TWILIGHT: GradeParams = {
  ...GRADE_WELL,
  shadowTint: [0.9, 0.88, 1.16],
  highlightTint: [1.02, 0.96, 1.0],
  bloomTint: [0.85, 0.68, 0.95],
  vignetteTint: [0.46, 0.4, 0.66],
};

export const GRADE_PASSAGE: GradeParams = { ...GRADE_WELL, contrast: 0.4, vignette: 0.4 };

export const GRADE_HALL: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.92, 0.93, 1.1],
  highlightTint: [1.07, 1.01, 0.88],
  lift: [0.016, 0.01, 0.035],
  contrast: 0.38,
  saturation: 0.86,
  satCompress: 0.4,
  vignette: 0.38,
  vignetteTint: [0.52, 0.46, 0.64],
  clarity: 1.0,
  clarityBroad: 0.6,
  bloom: 0.4,
  bloomTint: [1.0, 0.78, 0.46],
  bloomThreshold: 0.75,
  granulation: 0.05,
  mottle: 0.035,
};

/**
 * Per-scene lighting and atmospheric fog manager (WP-1).
 * Configures warm afternoon sunlight for S0–S2, amber candlelight + lavender twilight for S3–S4,
 * and 6 golden chandelier point lights + warm ambient fill for S5–S7.
 */
export class SceneLightingManager {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private wellLights: THREE.PointLight[] = [];
  private hallLamps: THREE.PointLight[] = [];
  private vistaLight: THREE.SpotLight;
  private sunOffset = new THREE.Vector3(18, 28, 14);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Remove any existing raw lights in the root scene so we manage them cleanly
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) {
        toRemove.push(obj);
      }
    });
    for (const l of toRemove) {
      l.parent?.remove(l);
    }

    this.ambientLight = new THREE.AmbientLight(0xfff2cc, 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xcfe4ff, 0x8a7b65, 0.65);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff2cc, 1.35);
    this.sunLight.position.set(18, 28, 14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 90;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 3;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Well shaft candle sconces (S3_FALL)
    const wellOffsets: [number, number, number][] = [
      [1.6, 2.0, 0],
      [-1.6, -2.0, 0.5],
      [0, -6.0, -1.6],
      [1.4, -10.0, 1.1],
    ];
    for (const [x, y, z] of wellOffsets) {
      const pl = new THREE.PointLight(0xffb86c, 1.4, 14, 1.5);
      pl.position.set(x, y, z);
      pl.visible = false;
      this.scene.add(pl);
      this.wellLights.push(pl);
    }

    // 6 Chandelier lamps along the 24m Great Hall (S5_HALL / S6_SMALL / S7_CAKE)
    const hallX = [-9, -5.4, -1.8, 1.8, 5.4, 9.0];
    for (const x of hallX) {
      const lamp = new THREE.PointLight(0xf5c26b, 1.5, 14, 1.4);
      lamp.position.set(x, 2.55, 0);
      lamp.visible = false;
      this.scene.add(lamp);
      this.hallLamps.push(lamp);
    }

    // Sunlit Garden Vista spotlight behind the little door (-0.8, 0.5, -5.0)
    this.vistaLight = new THREE.SpotLight(0xfff7d6, 2.2, 16, Math.PI / 3, 0.35, 1.0);
    this.vistaLight.position.set(-0.8, 3.2, -6.5);
    this.vistaLight.target.position.set(-0.8, 0.2, -3.5);
    this.vistaLight.visible = false;
    this.scene.add(this.vistaLight);
    this.scene.add(this.vistaLight.target);

    this.applyStateLighting('S0_TITLE');
  }

  /** Keep the sun's shadow frustum centred on the player so shadows stay crisp wherever Alice walks. */
  public follow(target: THREE.Vector3): void {
    const off = this.sunOffset;
    this.sunLight.position.set(target.x + off.x, off.y, target.z + off.z);
    this.sunLight.target.position.set(target.x, 0, target.z);
    this.sunLight.target.updateMatrixWorld();
  }

  public applyStateLighting(state: GameState): void {
    // Reset sub-lights first
    this.wellLights.forEach((l) => (l.visible = false));
    this.hallLamps.forEach((l) => (l.visible = false));
    this.vistaLight.visible = false;

    switch (state) {
      case 'S0_TITLE':
      case 'S1_BANK':
      case 'S2_CHASE': {
        this.scene.background = new THREE.Color(0xdfeef5);
        this.scene.fog = new THREE.FogExp2(0xe8dfc8, 0.014);
        this.ambientLight.color.setHex(0xfff2cc);
        this.ambientLight.intensity = 0.65;
        this.hemiLight.color.setHex(0xcfe4ff);
        this.hemiLight.groundColor.setHex(0x8a7b65);
        this.hemiLight.intensity = 0.75;
        this.sunLight.color.setHex(0xfff2cc);
        this.sunLight.intensity = 1.4;
        this.sunOffset.set(18, 28, 14);
        this.sunLight.position.set(18, 28, 14);
        break;
      }

      case 'S3_FALL': {
        this.scene.background = new THREE.Color(0x281e29);
        this.scene.fog = new THREE.FogExp2(0x281e29, 0.045);
        this.ambientLight.color.setHex(0x8c6d58);
        this.ambientLight.intensity = 0.65;
        this.hemiLight.color.setHex(0xffc98b);
        this.hemiLight.groundColor.setHex(0x3b2c3d);
        this.hemiLight.intensity = 0.55;
        this.sunLight.color.setHex(0xffb86c);
        this.sunLight.intensity = 0.65;
        this.sunOffset.set(2, 12, 3);
        this.sunLight.position.set(2, 12, 3);
        this.wellLights.forEach((l) => {
          l.color.setHex(0xffb86c);
          l.visible = true;
        });
        break;
      }

      case 'S4_PASSAGE': {
        this.scene.background = new THREE.Color(0x2b222c);
        this.scene.fog = new THREE.FogExp2(0x2b222c, 0.04);
        this.ambientLight.color.setHex(0x9a7bb5);
        this.ambientLight.intensity = 0.7;
        this.hemiLight.color.setHex(0xd6b88c);
        this.hemiLight.groundColor.setHex(0x4a3b4e);
        this.hemiLight.intensity = 0.6;
        this.sunLight.color.setHex(0xf5c26b);
        this.sunLight.intensity = 0.75;
        this.sunOffset.set(6, 8, 4);
        this.sunLight.position.set(6, 8, 4);
        break;
      }

      case 'S5_HALL':
      case 'S6_SMALL':
      case 'S7_CAKE':
      case 'END': {
        this.scene.background = new THREE.Color(0x3a2d3b);
        this.scene.fog = new THREE.FogExp2(0x3a2d3b, 0.022);
        this.ambientLight.color.setHex(0xf5d6a7);
        this.ambientLight.intensity = 0.72;
        this.hemiLight.color.setHex(0xffe4b5);
        this.hemiLight.groundColor.setHex(0x523e38);
        this.hemiLight.intensity = 0.65;
        this.sunLight.color.setHex(0xf5c26b);
        this.sunLight.intensity = 0.85;
        this.sunOffset.set(4, 10, 5);
        this.sunLight.position.set(4, 10, 5);
        this.hallLamps.forEach((l) => (l.visible = true));
        this.vistaLight.visible = true;
        break;
      }
    }
  }

  /** The colour grade the post pass should use in a game state. */
  public gradeForState(state: GameState): GradeParams {
    switch (state) {
      case 'S3_FALL':
        return GRADE_WELL;
      case 'S4_PASSAGE':
        return GRADE_PASSAGE;
      case 'S5_HALL':
      case 'S6_SMALL':
      case 'S7_CAKE':
      case 'END':
        return GRADE_HALL;
      default:
        return GRADE_DAY;
    }
  }

  /** Grade of the well while the amber candlelight turns to lavender twilight (t >= 70 s). */
  public s3Grade(elapsedSeconds: number): GradeParams {
    const t = Math.min(1, Math.max(0, (elapsedSeconds - 70) / 10));
    return lerpGrade(GRADE_WELL, GRADE_WELL_TWILIGHT, t);
  }

  /**
   * Smoothly transitions S3_FALL lighting to dreamy lavender twilight (#9A7BB5) at t >= 75s.
   */
  public setS3Progress(elapsedSeconds: number): void {
    if (elapsedSeconds < 70) return;
    const t = Math.min(1, Math.max(0, (elapsedSeconds - 70) / 10));
    const amber = new THREE.Color(0xffb86c);
    const lavender = new THREE.Color(0x9a7bb5);
    const blended = amber.clone().lerp(lavender, t);

    this.ambientLight.color.copy(blended);
    this.wellLights.forEach((l) => l.color.copy(blended));

    const bgStart = new THREE.Color(0x281e29);
    const bgEnd = new THREE.Color(0x3d2e4f);
    const bg = bgStart.lerp(bgEnd, t);
    this.scene.background = bg;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(bg);
    }
  }
}
