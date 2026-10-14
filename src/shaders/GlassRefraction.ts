import * as THREE from 'three';

/**
 * Solid Glass Table Material (M_Glass_Table)
 * Enforces optical transparency alpha <= 0.25 and refractive Fresnel edge (INV-02).
 */
export function createGlassTableMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.20, // alpha <= 0.25 constraint strictly satisfied
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.92, // High optical transmission
    ior: 1.5,           // Glass index of refraction
    thickness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.5,
    side: THREE.DoubleSide,
  });
}
