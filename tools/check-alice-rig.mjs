#!/usr/bin/env node
/**
 * Structural + motion quality checks for public/assets/models/chr_alice.glb.
 * These are the objective, non-gameable parts of the "Alice must not be stiff / ugly" acceptance criteria:
 *  - proportions (1.20 m, head ≈ 1:4.5), a real skeleton (no stacked bones), face rig (blend shapes), painted textures
 *  - every required clip exists and actually MOVES: amplitude floors per bone, anti-phase legs in the gait, seamless loops
 * Thresholds live in docs/review/gate-thresholds.json ("alice"); run `npm test` or `node tools/check-alice-rig.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  readGlb, skinJointNames, nodeWorldPositions, readAnimations, maxRotationDeg, translationRange, rotationCorrelation, rotationCorrelationLag, loopClosureDeg, meshBounds, imageInfo,
} from './lib/glb.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const THRESHOLDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/review/gate-thresholds.json'), 'utf8')).alice;
const FILE = process.env.ALICE_GLB || path.join(ROOT, 'public/assets/models/chr_alice.glb');

export function analyze(file = FILE) {
  const glb = readGlb(file);
  const T = THRESHOLDS;
  const joints = skinJointNames(glb);
  const world = nodeWorldPositions(glb);
  const all = meshBounds(glb);
  const head = meshBounds(glb, 'Alice_Head');
  const anims = readAnimations(glb);
  const byName = Object.fromEntries(anims.map((a) => [a.name, a]));
  const images = imageInfo(glb);
  const textures = images.length;
  const texturePixels = images.reduce((s, im) => s + im.width * im.height, 0);
  const stacked = [];
  const deform = joints.filter((j) => !/^(Root|SOCKET_)/.test(j));
  for (let i = 0; i < deform.length; i++) for (let k = i + 1; k < deform.length; k++) {
    const a = world.get(deform[i]), b = world.get(deform[k]);
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.001) stacked.push(`${deform[i]}~${deform[k]}`);
  }
  const morphs = new Set();
  for (const m of glb.json.meshes) (m.extras?.targetNames || []).forEach((n) => morphs.add(n));
  return { glb, joints, world, all, head, anims, byName, textures, texturePixels, images, stacked, morphs, T };
}

const A = analyze();
const { T } = A;

test('Alice proportions & budget', async (t) => {
  await t.test(`height is ${T.height} m ± ${T.heightTol}`, () => {
    assert.ok(Math.abs(A.all.size[1] - T.height) <= T.heightTol, `height ${A.all.size[1].toFixed(3)} m`);
  });
  await t.test('head-to-body ratio is a storybook 1:4–1:5', () => {
    const ratio = A.all.size[1] / A.head.size[1];
    assert.ok(ratio >= T.headRatio[0] && ratio <= T.headRatio[1], `1:${ratio.toFixed(2)}`);
  });
  await t.test('triangle + file budgets', () => {
    assert.ok(A.all.tris >= T.trisMin && A.all.tris <= T.trisMax, `${A.all.tris} tris`);
    assert.ok(A.glb.bytes <= T.maxBytes, `${(A.glb.bytes / 1e6).toFixed(2)} MB`);
  });
  await t.test('painted textures are embedded (no flat-colour dolls)', () => {
    assert.ok(A.textures >= T.minTextures, `${A.textures} textures`);
    assert.ok(A.texturePixels >= T.minTexturePixels, `${(A.texturePixels / 1e6).toFixed(2)} Mpx of texture`);
    const mats = A.glb.json.materials.map((m) => m.name);
    for (const required of T.materials) assert.ok(mats.includes(required), `missing material ${required}`);
    const textured = A.glb.json.materials.filter((m) => m.pbrMetallicRoughness?.baseColorTexture).length;
    assert.ok(textured >= T.minTexturedMaterials, `${textured} textured materials`);
  });
});

test('Alice skeleton is real', async (t) => {
  await t.test(`>= ${T.minBones} deforming joints, sockets present`, () => {
    assert.ok(A.joints.length >= T.minBones, `${A.joints.length} joints`);
    assert.ok(A.joints.includes('SOCKET_HandR') && A.joints.includes('SOCKET_HandL'));
    for (const j of T.requiredBones) assert.ok(A.joints.includes(j), `missing bone ${j}`);
  });
  await t.test('no two deforming bones share a position (the old rig stacked 45 bones at one point)', () => {
    assert.equal(A.stacked.length, 0, `stacked: ${A.stacked.slice(0, 5).join(', ')}`);
  });
  await t.test('skeleton spans the body: feet near the floor, head near the top', () => {
    const foot = A.world.get('Foot_L'), headB = A.world.get('Head');
    assert.ok(foot.y < 0.15 && headB.y > 0.85, `foot ${foot.y.toFixed(2)} head ${headB.y.toFixed(2)}`);
  });
  await t.test('face blend shapes', () => {
    for (const m of T.morphs) assert.ok(A.morphs.has(m), `missing morph target ${m}`);
  });
});

test('Alice animation set is complete and actually moves', async (t) => {
  await t.test('all required clips exist with sane durations', () => {
    for (const [name, [lo, hi]] of Object.entries(T.clips)) {
      const a = A.byName[name];
      assert.ok(a, `missing clip ${name}`);
      assert.ok(a.duration >= lo && a.duration <= hi, `${name} lasts ${a.duration.toFixed(2)} s (expected ${lo}–${hi})`);
    }
  });
  await t.test('looping clips close seamlessly', () => {
    for (const name of T.loops) {
      const worst = loopClosureDeg(A.byName[name]);
      assert.ok(worst <= T.loopToleranceDeg, `${name}: first/last pose differ by ${worst.toFixed(2)}°`);
    }
  });
  await t.test('walk cycle: legs swing, knees bend, arms swing, pelvis bobs — and the legs are in anti-phase', () => {
    const w = A.byName.Alice_Walk;
    for (const side of ['L', 'R']) {
      assert.ok(maxRotationDeg(w, `Thigh_${side}`) >= T.walk.thighDeg, `Thigh_${side} ${maxRotationDeg(w, `Thigh_${side}`).toFixed(1)}°`);
      assert.ok(maxRotationDeg(w, `Calf_${side}`) >= T.walk.kneeDeg, `Calf_${side} ${maxRotationDeg(w, `Calf_${side}`).toFixed(1)}°`);
      assert.ok(maxRotationDeg(w, `UpperArm_${side}`) >= T.walk.armDeg, `UpperArm_${side} ${maxRotationDeg(w, `UpperArm_${side}`).toFixed(1)}°`);
    }
    const bob = translationRange(w, 'Hips');
    assert.ok(Math.max(...bob) >= T.walk.pelvisBob, `pelvis moves ${Math.max(...bob).toFixed(4)} m`);
    const corr = rotationCorrelation(w, 'Thigh_L', 'Thigh_R');
    assert.ok(corr <= T.walk.antiPhaseCorr, `thigh correlation ${corr.toFixed(2)}`);
    const half = rotationCorrelationLag(w, 'Thigh_L', 'Thigh_R', 0.5);
    assert.ok(half >= T.walk.halfCycleMatch, `right leg is not the left leg shifted by half a cycle (match ${half.toFixed(2)})`);
    assert.ok(maxRotationDeg(w, 'Spine') >= 1.5 && maxRotationDeg(w, 'Head') >= 1.0, 'torso/head counter-motion');
    assert.ok(maxRotationDeg(w, 'HairB_C_2') >= 1.5 || maxRotationDeg(w, 'HairB_L_2') >= 1.5, 'hair follow-through');
  });
  await t.test('run cycle is a bigger, bouncier version of the walk', () => {
    const r = A.byName.Alice_Run, w = A.byName.Alice_Walk;
    for (const side of ['L', 'R']) {
      assert.ok(maxRotationDeg(r, `Thigh_${side}`) >= T.run.thighDeg);
      assert.ok(maxRotationDeg(r, `Calf_${side}`) >= T.run.kneeDeg);
      assert.ok(maxRotationDeg(r, `UpperArm_${side}`) >= maxRotationDeg(w, `UpperArm_${side}`));
    }
    assert.ok(r.duration < w.duration, 'running cadence is faster');
  });
  await t.test('idle breathes (many bones, small but non-zero motion)', () => {
    const idle = A.byName.Alice_Idle;
    const moving = new Set(idle.channels.filter((c) => c.path === 'rotation' && maxRotationDeg(idle, c.node) > 0.3).map((c) => c.node));
    assert.ok(moving.size >= T.idle.movingBones, `${moving.size} bones move`);
  });
  await t.test('every story clip is a real performance, not a constant', () => {
    for (const name of T.storyClips) {
      const a = A.byName[name];
      const rule = { ...T.story, ...(T.story.overrides?.[name] || {}) };
      const moving = a.channels.filter((c) => c.path === 'rotation' && maxRotationDeg(a, c.node) >= rule.boneDeg);
      const nodes = new Set(moving.map((c) => c.node));
      assert.ok(nodes.size >= rule.movingBones, `${name}: only ${nodes.size} bones move ≥ ${rule.boneDeg}°`);
    }
  });
});
