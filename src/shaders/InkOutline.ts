import * as THREE from 'three';

/**
 * Ink Outline Material (#2B2420) using inverted hull rendering.
 * Uses MeshBasicMaterial + onBeforeCompile so both regular Mesh and SkinnedMesh / MorphTargets work seamlessly.
 */
export function createInkOutlineMaterial(
  color: THREE.ColorRepresentation = 0x2b2420,
  thickness: number = 0.0026
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.BackSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness };
    shader.vertexShader = `uniform float outlineThickness;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      // MeshBasicMaterial only declares objectNormal for skinned / env-mapped meshes; static meshes use the raw attribute
      #ifdef USE_SKINNING
        vec3 outlineNormal = normalize( objectNormal );
      #else
        vec3 outlineNormal = normalize( normal );
      #endif
      transformed += outlineNormal * outlineThickness;
      #include <project_vertex>
      `
    );
  };
  return mat;
}

/**
 * Helper to add an ink outline mesh wrapper around an existing mesh/group.
 * Automatically skips M_Glass_* and transparent meshes.
 */
export function applyInkOutline(
  root: THREE.Object3D,
  color: THREE.ColorRepresentation = 0x2b2420,
  thickness: number = 0.0026
): void {
  const outlineMat = createInkOutlineMaterial(color, thickness);
  const meshesToProcess: THREE.Mesh[] = [];

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.name.endsWith('_ink_outline') || mesh.userData?.hasInkOutline) return;

      const mat = mesh.material;
      let isTransparent = false;
      let isGlass = false;
      // Fine facial parts (eyes, lids, lips, brows, mouth) are drawn by their painted textures; a hull would swamp them.
      const matNames = Array.isArray(mat) ? mat.map((m) => m.name) : [mat?.name ?? ''];
      if (matNames.some((n) => /^M_(Alice|Sister)_(Eye|Lid|Lips|Mouth|Brow)/.test(n))) return;

      if (Array.isArray(mat)) {
        isTransparent = mat.some((m) => m.transparent && m.opacity < 0.95);
        isGlass = mat.some((m) => m.name?.startsWith('M_Glass_'));
      } else if (mat) {
        isTransparent = mat.transparent === true && (mat as THREE.Material).opacity < 0.95;
        isGlass = Boolean(mat.name?.startsWith('M_Glass_'));
      }

      if (!isTransparent && !isGlass) {
        meshesToProcess.push(mesh);
      }
    }
  });

  for (const mesh of meshesToProcess) {
    mesh.userData.hasInkOutline = true;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinned = mesh as THREE.SkinnedMesh;
      const outlineSkinned = new THREE.SkinnedMesh(skinned.geometry, outlineMat);
      outlineSkinned.name = `${skinned.name}_ink_outline`;
      outlineSkinned.castShadow = false;
      outlineSkinned.receiveShadow = false;
      if (skinned.skeleton) {
        outlineSkinned.bind(skinned.skeleton, skinned.bindMatrix);
      }
      if (skinned.morphTargetDictionary && skinned.morphTargetInfluences) {
        outlineSkinned.morphTargetDictionary = skinned.morphTargetDictionary;
        outlineSkinned.morphTargetInfluences = skinned.morphTargetInfluences;
      }
      if (skinned.parent) {
        skinned.parent.add(outlineSkinned);
      }
    } else {
      const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
      outlineMesh.name = `${mesh.name}_ink_outline`;
      outlineMesh.castShadow = false;
      outlineMesh.receiveShadow = false;
      mesh.add(outlineMesh);
    }
  }
}
