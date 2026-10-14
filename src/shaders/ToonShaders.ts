import * as THREE from 'three';
import { createGlassTableMaterial } from './GlassRefraction';

let sharedGradientMap: THREE.DataTexture | null = null;

/**
 * Soft three-tone ramp: warm purple shadow -> paper mid-tone -> highlight, with a narrow *blended* terminator
 * (LinearFilter) instead of hard stair-steps so the light edge reads like a brushed wash rather than plastic.
 */
function getSharedGradientMap(): THREE.DataTexture {
  if (!sharedGradientMap) {
    const W = 32;
    const shadow = [74, 59, 78];       // #4A3B4E — warm purple, never black
    const mid = [190, 184, 178];
    const light = [255, 252, 246];
    const data = new Uint8Array(W * 4);
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / W;
      const t1 = smooth(0.30, 0.40, x);   // shadow -> mid
      const t2 = smooth(0.68, 0.80, x);   // mid -> light
      for (let c = 0; c < 3; c++) {
        const v = shadow[c] + (mid[c] - shadow[c]) * t1;
        data[i * 4 + c] = Math.round(v + (light[c] - v) * t2);
      }
      data[i * 4 + 3] = 255;
    }
    sharedGradientMap = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
    sharedGradientMap.minFilter = THREE.LinearFilter;
    sharedGradientMap.magFilter = THREE.LinearFilter;
    sharedGradientMap.generateMipmaps = false;
    sharedGradientMap.colorSpace = THREE.NoColorSpace;
    sharedGradientMap.needsUpdate = true;
  }
  return sharedGradientMap;
}

const PAINT_CACHE_KEY = 'victorian-watercolour-toon-v5';

/**
 * Scene-wide paint lighting shared by every toon material (one set of uniform objects, so SceneLighting can change them
 * live without touching materials):
 *  - a height-based light structure: surfaces high in the room / shaft take `heightHigh`, low ones `heightLow`, blended over
 *    `heightRange` (world Y metres). Lamps hang near ceilings and light leaks down a well from far above, so this is the cheap,
 *    painterly stand-in for the big soft value gradient a painter would lay over the whole picture
 *  - a global gain on the hand-laid tonal wash
 */
export const paintLight = {
  heightLow: { value: new THREE.Vector3(1, 1, 1) },
  heightHigh: { value: new THREE.Vector3(1, 1, 1) },
  heightRange: { value: new THREE.Vector2(0, 3) },
  washGain: { value: 1 },
};

export function setHeightLight(low: [number, number, number], high: [number, number, number], y0: number, y1: number): void {
  paintLight.heightLow.value.set(...low);
  paintLight.heightHigh.value.set(...high);
  paintLight.heightRange.value.set(y0, y1);
}

/**
 * How strongly a surface gets the hand-painted tonal wash (see applyPaintFinish). 0 = leave the colour exactly as painted
 * (faces, eyes, the canonical Alice / Rabbit palettes).
 */
export type WashKind = 'none' | 'light' | 'normal' | 'strong';
const WASH_AMOUNT: Record<WashKind, number> = { none: 0, light: 0.45, normal: 0.8, strong: 1.25 };

/** Surfaces that must keep their canonical painted colours (characters, faces, glass, eyes ...). */
const NO_WASH = /Alice|Sister|Rabbit|Dinah|Eye|Face|Skin|Hair|Lid|Mouth|Lips|Brow|Glass|Label|Portrait|Landscape|Map|Key_|Cork|Marmalade|Cake|Bottle|Water|Fire|Glow/;
const STRONG_WASH = /Ground|Terrain|Lawn|Earth|Hedge|Leaf|Moss|Foliage/;

export function washKindForMaterial(name: string): WashKind {
  if (!name) return 'normal';
  if (NO_WASH.test(name)) return 'none';
  if (STRONG_WASH.test(name)) return 'strong';
  if (/Brick|Stone|Flag|Wallpaper|Plaster|Parquet|Runner|Rug|Bark|Rock|Wood|Door/.test(name)) return 'normal';
  return 'light';
}

/**
 * Gouache / watercolour finishing on top of three's toon shading:
 *  - pigment pooling: the silhouette edge darkens and cools (wet edge of a wash)
 *  - a faint warm rim glow on the lit side
 *  - a hand-laid tonal wash: three octaves of low-frequency value noise in OBJECT space (so it stays glued to the wall /
 *    hill / floor, and scrolls with the well) shift each surface between warm-light and cool-dark by a few percent - the
 *    patchwork of overlapping washes that a flat texture repeated across a big surface lacks
 * Everything else (brush facets, paper tooth) comes from the painted textures and the screen-space PaperGrain pass.
 */
function applyPaintFinish(material: THREE.MeshToonMaterial, wash: WashKind = 'normal'): void {
  const amount = WASH_AMOUNT[wash];
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWash = { value: amount };
    shader.uniforms.uWashGain = paintLight.washGain;
    shader.uniforms.uHeightLow = paintLight.heightLow;
    shader.uniforms.uHeightHigh = paintLight.heightHigh;
    shader.uniforms.uHeightRange = paintLight.heightRange;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vPaintP;\nvarying vec3 vPaintN;\nvarying float vPaintY;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPaintP = position;\n\tvPaintN = normal;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvPaintY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
      varying vec3 vPaintP;
      varying vec3 vPaintN;
      varying float vPaintY;
      uniform float uWash;
      uniform float uWashGain;
      uniform vec3 uHeightLow;
      uniform vec3 uHeightHigh;
      uniform vec2 uHeightRange;
      float pHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
      float pNoise( vec3 x ) {
        vec3 i = floor( x ); vec3 f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( mix( pHash( i ), pHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( pHash( i + vec3( 0, 1, 0 ) ), pHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                    mix( mix( pHash( i + vec3( 0, 0, 1 ) ), pHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( pHash( i + vec3( 0, 1, 1 ) ), pHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
      }
      void main() {`
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
      #include <map_fragment>
      if ( uWash > 0.0 ) {
        float wa = uWash * uWashGain;
        // 1. tonal wash: overlapping light / dark washes at four scales
        float w1 = pNoise( vPaintP * 0.55 );
        float w2 = pNoise( vPaintP * 1.9 + 7.3 );
        float w3 = pNoise( vPaintP * 6.0 + 3.1 );
        float w4 = pNoise( vPaintP * 17.0 + 19.0 );
        float tone = ( w1 - 0.5 ) * 0.9 + ( w2 - 0.5 ) * 0.6 + ( w3 - 0.5 ) * 0.35 + ( w4 - 0.5 ) * 0.2;
        // 2. pigment drift: every pigment (here the three channels) pools and thins on its own, so a wash wanders between
        //    blue-green / yellow-green, sienna / rose ... instead of staying one hue
        vec3 pig = vec3( pNoise( vPaintP * 0.5 + 3.0 ), pNoise( vPaintP * 0.5 + 41.0 ), pNoise( vPaintP * 0.5 + 77.0 ) )
                 + 0.55 * vec3( pNoise( vPaintP * 2.1 + 13.0 ), pNoise( vPaintP * 2.1 + 59.0 ), pNoise( vPaintP * 2.1 + 91.0 ) );
        pig -= vec3( 0.775 );
        vec3 wc = diffuseColor.rgb * ( 1.0 + tone * 0.30 * wa ) * ( 1.0 + pig * 0.62 * min( wa, 1.3 ) );
        float chromaN = pNoise( vPaintP * 0.9 + 23.0 ) - 0.5;
        float wl = dot( wc, vec3( 0.2126, 0.7152, 0.0722 ) );
        wc = mix( vec3( wl ), wc, 1.0 + chromaN * 0.5 * min( wa, 1.2 ) );
        // 3. dry-brush streaks: long strokes (floors: along x; walls: vertical) with a soft bristle cross-grain
        vec3 an = abs( vPaintN );
        vec2 bp = an.y > 0.75 ? vec2( vPaintP.x * 0.9 + vPaintP.z * 0.4, vPaintP.z * 19.0 - vPaintP.x * 5.0 )
                              : vec2( vPaintP.y * 1.1, ( vPaintP.x + vPaintP.z ) * 19.0 );
        float stroke = pNoise( vec3( bp.x, bp.y, 5.0 ) ) + 0.5 * pNoise( vec3( bp.x * 2.0, bp.y * 2.3, 9.0 ) ) - 0.75;
        wc *= 1.0 + stroke * 0.16 * min( wa, 1.2 );
        diffuseColor.rgb = wc;
      }`
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
      {
        vec3 paintView = normalize( vViewPosition );
        float paintFres = pow( 1.0 - clamp( dot( normalize( normal ), paintView ), 0.0, 1.0 ), 2.4 );
        // wet-edge pooling: darker, cooler, slightly purple
        outgoingLight = mix( outgoingLight, outgoingLight * vec3( 0.70, 0.64, 0.76 ), paintFres * 0.60 );
        // warm rim from the sun side
        outgoingLight += vec3( 1.0, 0.84, 0.58 ) * paintFres * 0.07;
        // soft height structure: lit from above, deeper and cooler below
        outgoingLight *= mix( uHeightLow, uHeightHigh, smoothstep( uHeightRange.x, uHeightRange.y, vPaintY ) );
      }
      #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => PAINT_CACHE_KEY;
}

/**
 * Victorian Picture-Book toon material. Pass `map` to keep painted albedo textures from GLB assets.
 */
export function createToonMaterial(
  color: THREE.ColorRepresentation = 0xe0d4c3,
  options: {
    side?: THREE.Side;
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    map?: THREE.Texture | null;
    wash?: WashKind;
  } = {}
): THREE.MeshToonMaterial {
  const hasMap = Boolean(options.map);
  const baseColor = new THREE.Color(hasMap ? 0xffffff : color);
  const mat = new THREE.MeshToonMaterial({
    color: baseColor,
    map: options.map ?? null,
    gradientMap: getSharedGradientMap(),
    side: options.side ?? THREE.FrontSide,
    // a small self-lit floor so shadows stay warm and never go muddy; reuse the albedo map so it stays textured
    emissive: hasMap ? new THREE.Color(0xffffff) : options.emissive !== undefined ? new THREE.Color(options.emissive) : baseColor.clone(),
    emissiveMap: hasMap ? options.map! : null,
    emissiveIntensity: options.emissiveIntensity ?? (hasMap ? 0.16 : 0.18),
  });
  applyPaintFinish(mat, options.wash ?? 'normal');
  return mat;
}

/**
 * Refractive glass material for the glass table
 */
export function createRefractiveGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.95,
    ior: 1.5,
    thickness: 0.1,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    name: 'M_Glass_Refractive'
  });
}

/**
 * Adds subtle Victorian walnut-ink (#2B2420) edge lines to a mesh
 */
export function addInkOutline(mesh: THREE.Mesh, thresholdAngle = 25): void {
  try {
    const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2420 });
    const lineSegments = new THREE.LineSegments(edges, lineMat);
    lineSegments.name = `${mesh.name}_ink_outline`;
    mesh.add(lineSegments);
  } catch {
    // Ignore geometry outline errors on non-indexed primitives
  }
}

function toToonMatSlot(mat: THREE.Material): THREE.Material {
  const std = mat as THREE.MeshStandardMaterial;
  if (std.name && std.name.includes('Glass')) {
    return createGlassTableMaterial();      // in-world glass is cheap (no transmission pass); see GlassRefraction.ts
  }
  const map = std.map ?? null;
  // Painted eyes must stay crisp: no light/shadow ramp on the catch-lights.
  if (std.name && std.name.startsWith('M_Alice_Eye') && map) {
    const unlit = new THREE.MeshBasicMaterial({ map, name: mat.name });
    unlit.toneMapped = false;
    return unlit;
  }
  const hex = std.color ? std.color.getHex() : 0xe0d4c3;
  const toon = createToonMaterial(hex, { map, side: std.side, wash: washKindForMaterial(std.name) });
  if (map) {
    map.anisotropy = 4;
    map.needsUpdate = true;
  } else if (std.color) {
    // flat-colour GLB materials keep their own factor
    toon.color.copy(std.color);
    toon.emissive.copy(std.color);
  }
  toon.name = mat.name;
  // authored glow (lamp glass, fire, windows) survives the conversion
  if (std.emissive && std.emissive.r + std.emissive.g + std.emissive.b > 0.05) {
    toon.emissive.copy(std.emissive);
    toon.emissiveIntensity = 1.0;
    // tells LightGlows (src/world/LightGlows.ts) where this scene's lamps, fires and doorways of light are
    toon.userData.glow = { color: (std.color ?? std.emissive).getHex() };
  }
  if (mat.transparent || (std.opacity !== undefined && std.opacity < 1.0)) {
    toon.transparent = true;
    toon.opacity = std.opacity ?? 0.72;
  }
  return toon;
}

/**
 * Converts all Mesh materials in a hierarchy to 3-tone Victorian Toon materials,
 * preserving multi-material slot arrays, painted textures and transparency.
 */
export function convertMaterialsToToon(root: THREE.Object3D): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => toToonMatSlot(m));
      } else if (mesh.material) {
        mesh.material = toToonMatSlot(mesh.material);
      }
    }
  });
}
