import * as THREE from 'three';

let sharedGradientMap: THREE.DataTexture | null = null;

function getSharedGradientMap() {
  if (!sharedGradientMap) {
    // 3-tone gradient (shadow, midtone, highlight)
    // Shadow tone is warm purple (#4A3B4E) instead of near-black
    const data = new Uint8Array([
      74, 59, 78, 255,    // #4A3B4E
      185, 185, 185, 255,
      255, 255, 255, 255,
    ]);
    sharedGradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    sharedGradientMap.minFilter = THREE.NearestFilter;
    sharedGradientMap.magFilter = THREE.NearestFilter;
    sharedGradientMap.generateMipmaps = false;
    sharedGradientMap.needsUpdate = true;
  }
  return sharedGradientMap;
}

/**
 * Victorian Picture-Book 3-Tone Toon Ramp Shader
 */
export function createToonMaterial(
  color: THREE.ColorRepresentation = 0xe0d4c3,
  options: { side?: THREE.Side; emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}
): THREE.MeshToonMaterial {
  const baseColor = new THREE.Color(color);
  return new THREE.MeshToonMaterial({
    color: baseColor,
    gradientMap: getSharedGradientMap(),
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive !== undefined ? new THREE.Color(options.emissive) : baseColor,
    emissiveIntensity: options.emissiveIntensity ?? 0.18,
  });
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
  const hex = std.color ? std.color.getHex() : 0xe0d4c3;
  const toon = createToonMaterial(hex);
  toon.name = mat.name;
  if (mat.transparent || (std.opacity !== undefined && std.opacity < 1.0)) {
    toon.transparent = true;
    toon.opacity = std.opacity ?? 0.72;
  }
  return toon;
}

/**
 * Converts all Mesh materials in a hierarchy to 3-tone Victorian Toon materials,
 * preserving multi-material slot arrays and transparency.
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

