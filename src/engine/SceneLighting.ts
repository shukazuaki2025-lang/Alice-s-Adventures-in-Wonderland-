import * as THREE from 'three';
import { GameStateID as GameState } from '../core/types';
import { GradeParams, NEUTRAL_GRADE, lerpGrade } from '../shaders/PaperGrain';
import { setHeightLight } from '../shaders/ToonShaders';

/**
 * Colour grade of each world, applied by the final post pass (src/shaders/PaperGrain.ts).
 * Every one is a split-tone: lights lean toward warm paper-amber, shadows toward cool violet-teal, so there are always two
 * temperatures in play; the underground grades hold saturation back (the brick/earth palette is already hot) and open the
 * contrast so lamp pools read against deep soft shadow.
 */
export const GRADE_DAY: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.90, 0.94, 1.10],
  highlightTint: [1.05, 1.01, 0.93],
  lift: [0.008, 0.01, 0.025],
  contrast: 0.30,
  saturation: 0.96,
  satCompress: 0.12,
  vignette: 0.20,
  vignetteTint: [0.68, 0.64, 0.82],
  clarity: 0.58,
  clarityBroad: 0.40,
  bloom: 0.14,
  bloomTint: [1.0, 0.9, 0.7],
  bloomThreshold: 0.9,
  granulation: 0.05,
  mottle: 0.08,
};

export const GRADE_WELL: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.84, 0.92, 1.18],
  highlightTint: [1.08, 1.01, 0.90],
  lift: [0.02, 0.028, 0.055],
  contrast: 0.45,
  saturation: 0.72,
  satCompress: 0.42,
  vignette: 0.26,
  vignetteTint: [0.55, 0.52, 0.76],
  exposure: 1.48,
  clarity: 0.92,
  clarityBroad: 0.62,
  bloom: 0.14,
  bloomTint: [1.0, 0.82, 0.55],
  bloomThreshold: 0.88,
  granulation: 0.06,
  mottle: 0.14,
};

export const GRADE_WELL_TWILIGHT: GradeParams = {
  ...GRADE_WELL,
  shadowTint: [0.86, 0.90, 1.18],
  highlightTint: [1.02, 0.98, 1.0],
  bloomTint: [0.85, 0.68, 0.95],
  vignetteTint: [0.5, 0.44, 0.7],
};

export const GRADE_PASSAGE: GradeParams = {
  ...GRADE_WELL,
  exposure: 1.45,
  vignette: 0.22,
  contrast: 0.44,
  saturation: 0.76,
  satCompress: 0.35,
  clarity: 1.05,
  clarityBroad: 0.70,
  bloom: 0.12,
};

export const GRADE_HALL: GradeParams = {
  ...NEUTRAL_GRADE,
  shadowTint: [0.86, 0.93, 1.16],
  highlightTint: [1.07, 1.01, 0.91],
  lift: [0.015, 0.018, 0.04],
  contrast: 0.40,
  saturation: 0.78,
  satCompress: 0.32,
  vignette: 0.24,
  vignetteTint: [0.58, 0.52, 0.74],
  exposure: 1.36,
  clarity: 0.85,
  clarityBroad: 0.56,
  bloom: 0.14,
  bloomTint: [1.0, 0.82, 0.52],
  bloomThreshold: 0.9,
  granulation: 0.05,
  mottle: 0.12,
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
  private passageLights: THREE.PointLight[] = [];
  private wellAnchors: THREE.Vector3[] = [];
  private wellLampIntensity = 8.5;
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
      [-1.2, 4.0, -1.4],
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

    // Passage lanterns (S4_PASSAGE): moved onto the Blender LAMP_ anchors by setLampAnchors()
    for (const x of [-3, 2, 7, 12, 17]) {
      const lamp = new THREE.PointLight(0xffb86c, 4, 8, 2);
      lamp.position.set(x, 1.9, 0);
      lamp.visible = false;
      this.scene.add(lamp);
      this.passageLights.push(lamp);
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

  /** Put the real point lights on the lamps the Blender sets actually contain (LAMP_* empties). */
  public setLampAnchors(a: { well: THREE.Vector3[]; passage: THREE.Vector3[]; hall: THREE.Vector3[] }): void {
    this.wellAnchors = a.well.map((v) => v.clone());
    a.hall.forEach((p, i) => {
      const l = this.hallLamps[i];
      if (l) l.position.set(p.x, p.y - 0.15, p.z);
    });
    a.passage.forEach((p, i) => {
      const l = this.passageLights[i];
      if (l) l.position.set(p.x, p.y - 0.25, p.z);
    });
  }

  public applyStateLighting(state: GameState): void {
    // Reset sub-lights first
    this.wellLights.forEach((l) => (l.visible = false));
    this.hallLamps.forEach((l) => (l.visible = false));
    this.passageLights.forEach((l) => (l.visible = false));
    this.vistaLight.visible = false;

    const stainedLanternTints = [0xffcb74, 0x6cc8e8, 0xff9a74, 0x78d8a8, 0xd49eff, 0xffe088];

    switch (state) {
      case 'S0_TITLE':
      case 'S1_BANK':
      case 'S2_CHASE': {
        // warm afternoon sun, cool sky bounce from above, olive-gold bounce from the grass, lilac-cream haze in the distance
        this.scene.background = new THREE.Color(0xdfeef5);
        this.scene.fog = new THREE.FogExp2(0xdcd8e6, 0.010);
        setHeightLight([0.84, 0.88, 0.98], [1.14, 1.09, 0.98], 0.0, 4.2);
        this.ambientLight.color.setHex(0xfff2cc);
        this.ambientLight.intensity = 0.56;
        this.hemiLight.color.setHex(0xc4dcff);
        this.hemiLight.groundColor.setHex(0x6e7848);
        this.hemiLight.intensity = 0.82;
        this.sunLight.color.setHex(0xffeabd);
        this.sunLight.intensity = 1.55;
        this.sunOffset.set(18, 28, 14);
        this.sunLight.position.set(18, 28, 14);
        break;
      }

      case 'S3_FALL': {
        // stained-glass lantern pools against cool cerulean-violet shaft-light from above
        this.scene.background = new THREE.Color(0x281e29);
        this.scene.fog = new THREE.FogExp2(0x2c2442, 0.014);
        setHeightLight([0.48, 0.56, 0.84], [1.28, 1.18, 0.98], -4.2, 4.2);
        this.ambientLight.color.setHex(0x8898c8);
        this.ambientLight.intensity = 0.52;
        this.hemiLight.color.setHex(0x9ec4f8);
        this.hemiLight.groundColor.setHex(0x523858);
        this.hemiLight.intensity = 0.75;
        this.sunLight.color.setHex(0xffe4a8);
        this.sunLight.intensity = 1.25;
        this.sunOffset.set(3, 10, 4);
        this.sunLight.position.set(3, 10, 4);
        this.wellLights.forEach((l, i) => {
          l.color.setHex(stainedLanternTints[i % stainedLanternTints.length]);
          l.intensity = this.wellLampIntensity;
          l.distance = 8.5;
          l.decay = 1.8;
          l.visible = true;
        });
        break;
      }

      case 'S4_PASSAGE': {
        this.scene.background = new THREE.Color(0x262038);
        this.scene.fog = new THREE.FogExp2(0x2e2846, 0.011);
        setHeightLight([0.52, 0.62, 0.88], [1.26, 1.16, 0.96], 0.0, 2.3);
        this.ambientLight.color.setHex(0x8896c8);
        this.ambientLight.intensity = 0.54;
        this.hemiLight.color.setHex(0xffe4b8);
        this.hemiLight.groundColor.setHex(0x3a4868);
        this.hemiLight.intensity = 0.78;
        this.sunLight.color.setHex(0xffe29e);
        this.sunLight.intensity = 1.25;
        this.sunOffset.set(6, 8, 4);
        this.sunLight.position.set(6, 8, 4);
        this.passageLights.forEach((l, i) => {
          l.color.setHex(stainedLanternTints[(i + 1) % stainedLanternTints.length]);
          l.intensity = 6.5;
          l.distance = 10.5;
          l.decay = 1.8;
          l.visible = true;
        });
        break;
      }

      case 'S5_HALL':
      case 'S6_SMALL':
      case 'S7_CAKE':
      case 'END': {
        // amber & stained-glass chandelier pools on the ceiling and walls, cool cerulean-lilac air in between
        this.scene.background = new THREE.Color(0x322842);
        this.scene.fog = new THREE.FogExp2(0x42365c, 0.010);
        setHeightLight([0.62, 0.68, 0.92], [1.24, 1.14, 0.96], 0.0, 2.5);
        this.ambientLight.color.setHex(0x98a4d4);
        this.ambientLight.intensity = 0.48;
        this.hemiLight.color.setHex(0xffe8b8);
        this.hemiLight.groundColor.setHex(0x485278);
        this.hemiLight.intensity = 0.68;
        this.sunLight.color.setHex(0xffe4a0);
        this.sunLight.intensity = 1.20;
        this.sunOffset.set(4, 10, 5);
        this.sunLight.position.set(4, 10, 5);
        this.hallLamps.forEach((l, i) => {
          l.color.setHex(stainedLanternTints[i % stainedLanternTints.length]);
          l.intensity = 7.5;
          l.distance = 11.5;
          l.decay = 1.8;
          l.visible = true;
        });
        this.vistaLight.visible = true;
        break;
      }
    }
  }

  /**
   * S3: the real point lights ride on the lanterns of the scrolling shaft. Each frame the lanterns nearest to Alice (of the four
   * stacked 6 m segments) get the lights; every light's strength fades to zero at the distance of the first lantern left out, so
   * lanterns hand over smoothly as they stream past and nothing ever pops.
   */
  public updateWellLamps(scrollY: number, focus: THREE.Vector3): void {
    if (!this.wellAnchors.length) return;
    const cand: Array<[number, number, number, number]> = []; // x, y, z, distance to focus
    for (let k = 0; k < 4; k++) {
      for (const a of this.wellAnchors) {
        const y = a.y - 12 + 6 * k + scrollY;
        cand.push([a.x * 0.9, y, a.z * 0.9, Math.hypot(a.x - focus.x, y - focus.y, a.z - focus.z)]);
      }
    }
    cand.sort((p, q) => p[3] - q[3]);
    const n = this.wellLights.length;
    const dN = cand[Math.min(n, cand.length - 1)][3];
    for (let i = 0; i < n; i++) {
      const c = cand[i];
      const l = this.wellLights[i];
      l.position.set(c[0], c[1], c[2]);
      l.intensity = this.wellLampIntensity * Math.min(1, Math.max(0, (dN - c[3]) / (dN * 0.12)));
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
      this.scene.fog.color.set(0x3a2c4a).lerp(new THREE.Color(0x56457a), t);
    }
  }
}
