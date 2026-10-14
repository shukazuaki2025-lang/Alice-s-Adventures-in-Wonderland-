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

const PAINT_CACHE_KEY = 'victorian-watercolour-toon-v3';

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
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vPaintP;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPaintP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
      varying vec3 vPaintP;
      uniform float uWash;
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
        float w1 = pNoise( vPaintP * 0.55 );
        float w2 = pNoise( vPaintP * 1.9 + 7.3 );
        float w3 = pNoise( vPaintP * 6.0 + 3.1 );
        float tone = ( w1 - 0.5 ) * 0.9 + ( w2 - 0.5 ) * 0.6 + ( w3 - 0.5 ) * 0.35;
        float hueN = pNoise( vPaintP * 0.38 + 11.0 ) - 0.5;
        vec3 warmT = vec3( 1.07, 1.01, 0.88 );
        vec3 coolT = vec3( 0.90, 0.99, 1.10 );
        vec3 tint = mix( coolT, warmT, clamp( hueN * 2.4 + 0.5, 0.0, 1.0 ) );
        diffuseColor.rgb *= ( 1.0 + tone * 0.34 * uWash ) * mix( vec3( 1.0 ), tint, clamp( uWash, 0.0, 1.0 ) * 0.9 );
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
