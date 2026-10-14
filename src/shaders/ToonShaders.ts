import * as THREE from 'three';

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

const PAINT_CACHE_KEY = 'victorian-watercolour-toon-v2';

/**
 * Gouache / watercolour finishing on top of three's toon shading:
 *  - pigment pooling: the silhouette edge darkens and cools (wet edge of a wash)
 *  - a faint warm rim glow on the lit side
 * Everything else (brush facets, paper tooth) comes from the painted textures and the screen-space PaperGrain pass.
 */
function applyPaintFinish(material: THREE.MeshToonMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
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
  applyPaintFinish(mat);
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
    return createRefractiveGlassMaterial();
  }
  const map = std.map ?? null;
  // Painted eyes must stay crisp: no light/shadow ramp on the catch-lights.
  if (std.name && std.name.startsWith('M_Alice_Eye') && map) {
    const unlit = new THREE.MeshBasicMaterial({ map, name: mat.name });
    unlit.toneMapped = false;
    return unlit;
  }
  const hex = std.color ? std.color.getHex() : 0xe0d4c3;
  const toon = createToonMaterial(hex, { map });
  if (map) {
    map.anisotropy = 4;
    map.needsUpdate = true;
  } else if (std.color) {
    // flat-colour GLB materials keep their own factor
    toon.color.copy(std.color);
    toon.emissive.copy(std.color);
  }
  toon.name = mat.name;
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
