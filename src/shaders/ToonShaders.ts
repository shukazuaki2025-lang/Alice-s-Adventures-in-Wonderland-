import * as THREE from 'three';

/**
 * Victorian Picture-Book 3-Tone Toon Ramp Shader
 */
export function createToonMaterial(
  color: THREE.ColorRepresentation = 0xe0d4c3,
  options: { side?: THREE.Side; emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}
): THREE.MeshToonMaterial {
  // 3-tone grayscale luminance ramp texture (shadow, midtone, highlight)
  const data = new Uint8Array([
    115, 115, 115, 255,
    185, 185, 185, 255,
    235, 235, 235, 255,
    255, 255, 255, 255,
  ]);
  const gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;

  const baseColor = new THREE.Color(color);
  return new THREE.MeshToonMaterial({
    color: baseColor,
    gradientMap: gradientMap,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive !== undefined ? new THREE.Color(options.emissive) : baseColor,
    emissiveIntensity: options.emissiveIntensity ?? 0.18,
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
