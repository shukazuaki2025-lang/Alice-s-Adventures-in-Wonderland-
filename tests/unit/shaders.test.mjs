import test from 'node:test';
import assert from 'node:assert/strict';
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillRect: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(1024) }),
          putImageData: () => {}
        })
      };
    }
    return {};
  }
};

import * as THREE from 'three';
import { createToonMaterial, createRefractiveGlassMaterial } from '../../src/shaders/ToonShaders.js';
import { applyInkOutline } from '../../src/shaders/InkOutline.js';
import { createPaperGrainOverlayMaterial } from '../../src/shaders/PaperGrain.js';
import { SceneLightingManager } from '../../src/engine/SceneLighting.js';

test('ToonShaders', async (t) => {
  await t.test('createToonMaterial uses warm purple shadow ramp and caches DataTexture', () => {
    const mat1 = createToonMaterial(0xff0000);
    const mat2 = createToonMaterial(0x00ff00);
    
    assert.strictEqual(mat1.gradientMap, mat2.gradientMap, 'gradientMap should be cached and shared');
    
    const data = mat1.gradientMap.image.data;
    assert.deepEqual(Array.from(data.slice(0, 4)), [74, 59, 78, 255], 'Shadow tone should be warm purple #4A3B4E');
  });

  await t.test('createRefractiveGlassMaterial properties', () => {
    const glass = createRefractiveGlassMaterial();
    assert.equal(glass.name, 'M_Glass_Refractive');
    assert.equal(glass.transmission, 0.95);
    assert.equal(glass.transparent, true);
    assert.equal(glass.ior, 1.5);
  });
});

test('InkOutline', async (t) => {
  await t.test('applyInkOutline supports THREE.Mesh', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'TestMesh';
    
    applyInkOutline(mesh);
    
    const outline = mesh.children.find(c => c.name === 'TestMesh_ink_outline');
    assert.ok(outline, 'Outline mesh should be added as a child');
    assert.equal(mesh.userData.hasInkOutline, true);
  });

  await t.test('applyInkOutline supports THREE.SkinnedMesh and preserves morph targets', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const skinnedMesh = new THREE.SkinnedMesh(geom, mat);
    skinnedMesh.name = 'TestSkinnedMesh';
    const skeleton = new THREE.Skeleton([]);
    skinnedMesh.bind(skeleton);
    skinnedMesh.morphTargetDictionary = { 'smile': 0 };
    skinnedMesh.morphTargetInfluences = [0.5];
    
    const root = new THREE.Group();
    root.add(skinnedMesh);
    
    applyInkOutline(root);
    
    const outline = root.children.find(c => c.name === 'TestSkinnedMesh_ink_outline');
    assert.ok(outline, 'Outline should be added as a sibling SkinnedMesh');
    assert.equal(outline.isSkinnedMesh, true);
    assert.equal(outline.skeleton, skeleton, 'Skeleton should be preserved');
    assert.deepEqual(outline.morphTargetDictionary, skinnedMesh.morphTargetDictionary, 'Morph targets should be preserved');
    assert.deepEqual(outline.morphTargetInfluences, skinnedMesh.morphTargetInfluences, 'Morph target influences should be preserved');
  });

  await t.test('applyInkOutline skips transparent and glass materials', () => {
    const root = new THREE.Group();
    
    const transMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 });
    const meshTrans = new THREE.Mesh(new THREE.BoxGeometry(), transMat);
    root.add(meshTrans);
    
    const glassMat = new THREE.MeshBasicMaterial({ name: 'M_Glass_Window' });
    const meshGlass = new THREE.Mesh(new THREE.BoxGeometry(), glassMat);
    root.add(meshGlass);
    
    applyInkOutline(root);
    
    assert.equal(meshTrans.children.length, 0);
    assert.equal(meshGlass.children.length, 0);
  });
});

test('PaperGrainShader', async (t) => {
  await t.test('createPaperGrainOverlayMaterial uniforms and properties', () => {
    const mat = createPaperGrainOverlayMaterial();
    assert.ok(mat.uniforms.tDiffuse);
    assert.ok(mat.uniforms.tPaper);
    assert.equal(mat.uniforms.opacity.value, 0.15);
    assert.equal(mat.uniforms.vignetteRadius.value, 1.5);
    assert.ok(mat.uniforms.colorGrade);
    assert.equal(mat.depthTest, false);
    assert.equal(mat.depthWrite, false);
  });
});

test('SceneLightingManager', async (t) => {
  await t.test('applyStateLighting for S3_FALL', () => {
    const scene = new THREE.Scene();
    const mgr = new SceneLightingManager(scene);
    mgr.applyStateLighting('S3_FALL');
    
    // Check fog and background
    assert.equal(scene.background.getHex(), 0x281e29);
    
    // wellLights should be visible
    const anyWellLightVisible = mgr['wellLights'].some(l => l.visible);
    assert.ok(anyWellLightVisible, 'Well lights should be visible in S3_FALL');
  });

  await t.test('setS3Progress to 75s triggers lavender twilight', () => {
    const scene = new THREE.Scene();
    const mgr = new SceneLightingManager(scene);
    mgr.applyStateLighting('S3_FALL');
    
    mgr.setS3Progress(80); // max t = 1.0 (80 - 70) / 10
    assert.equal(scene.background.getHex(), 0x3d2e4f, 'Background should interpolate to lavender twilight');
  });
});
