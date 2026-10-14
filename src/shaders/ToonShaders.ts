import * as THREE from 'three';

/**
 * Victorian Picture-Book 3-Tone Toon Ramp Shader
 */
export function createToonMaterial(color: THREE.ColorRepresentation = 0xe0d4c3): THREE.MeshToonMaterial {
  // 3-tone gradient map texture (highlight, midtone, shadow)
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  
  // Victorian warm tone gradient
  ctx.fillStyle = '#2B2420'; // Shadow ink tone
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#C8B097'; // Midtone
  ctx.fillRect(1, 0, 2, 1);
  ctx.fillStyle = '#F5EFE6'; // Highlight tone
  ctx.fillRect(3, 0, 1, 1);

  const gradientMap = new THREE.CanvasTexture(canvas);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;

  return new THREE.MeshToonMaterial({
    color: color,
    gradientMap: gradientMap,
  });
}
