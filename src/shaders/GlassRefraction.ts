import * as THREE from 'three';

/**
 * Solid glass for in-world objects (the glass table, bottles, jars, the miniature box): alpha <= 0.25 (INV-02), a bright clear-coat
 * highlight and a cool fresnel rim so it reads as thick glass.
 *
 * Deliberately NOT `transmission`: three.js renders every opaque object a second time into a transmission buffer as soon as one
 * transmissive material is visible, which doubled the hall's draw calls (174 vs the 150 budget, CLAUDE.md §6). The refractive
 * material (`createRefractiveGlassMaterial`) is kept for isolated close-ups such as the 3D item inspector.
 */
export function createGlassTableMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6f4,
    transparent: true,
    opacity: 0.2, // alpha <= 0.25 constraint strictly satisfied
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.name = 'M_Glass_Table';
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      {
        float glassFres = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 2.2 );
        outgoingLight += vec3( 0.62, 0.86, 0.9 ) * glassFres * 0.55;
        diffuseColor.a = min( diffuseColor.a + glassFres * 0.05, 0.25 );
      }
      #include <opaque_fragment>`
    );
  };
  mat.customProgramCacheKey = () => 'victorian-solid-glass-v1';
  return mat;
}
