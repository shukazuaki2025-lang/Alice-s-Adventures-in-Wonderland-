import * as THREE from 'three';

/**
 * Ink Outline Material (#2B2420) using inverted hull rendering
 */
export function createInkOutlineMaterial(thickness: number = 0.02): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineThickness: { value: thickness },
      outlineColor: { value: new THREE.Color(0x2b2420) },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 norm = normalize(normalMatrix * normal);
        vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
        pos += norm * outlineThickness;
        gl_Position = projectionMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

/**
 * Helper to add an ink outline mesh wrapper around an existing mesh
 */
export function applyInkOutline(mesh: THREE.Mesh, thickness: number = 0.015): THREE.Mesh {
  const outlineMaterial = createInkOutlineMaterial(thickness);
  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterial);
  mesh.add(outlineMesh);
  return outlineMesh;
}
