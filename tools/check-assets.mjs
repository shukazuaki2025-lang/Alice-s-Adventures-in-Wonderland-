#!/usr/bin/env node
/**
 * Model-quality floor for every GLB the game ships (docs/review/gate-thresholds.json → "models", "budget").
 * This is what stops a character, prop or environment from being "a few primitives with a flat colour":
 * each file must carry real geometry, painted (textured) materials, and the animations the game plays.
 *
 *   node tools/check-assets.mjs            # prints a table, exits 1 if any model is below the bar
 *
 * Not part of `npm test` (CI) on purpose: it describes the *target* that the follow-up work has to reach and is enforced
 * by `npm run gate`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readGlb, meshBounds, imageInfo } from './lib/glb.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MODELS = path.join(ROOT, 'public/assets/models');

export function loadThresholds() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/review/gate-thresholds.json'), 'utf8'));
}

/** @returns {{ rows: Array<{ id: string, ok: boolean, detail: string }>, ok: boolean }} */
export function checkModels(T = loadThresholds()) {
  const rows = [];
  let total = 0;
  for (const f of fs.readdirSync(MODELS).filter((x) => x.endsWith('.glb'))) total += fs.statSync(path.join(MODELS, f)).size;
  rows.push({
    id: 'models:budget',
    ok: total <= T.budget.maxTotalModelBytes,
    detail: `${(total / 1e6).toFixed(1)} MB of GLB (limit ${(T.budget.maxTotalModelBytes / 1e6).toFixed(0)} MB)`,
  });
  for (const [name, req] of Object.entries(T.models)) {
    const file = path.join(MODELS, `${name}.glb`);
    if (!fs.existsSync(file)) {
      rows.push({ id: `model:${name}`, ok: false, detail: 'file missing' });
      continue;
    }
    const glb = readGlb(file);
    const b = meshBounds(glb);
    const images = imageInfo(glb);
    const px = images.reduce((s, im) => s + im.width * im.height, 0);
    const mats = glb.json.materials || [];
    // glass is replaced by the refractive shader at load time, so it does not need a painted map
    const paintable = mats.filter((m) => !/^M_Glass_/.test(m.name || ''));
    const textured = paintable.filter((m) => m.pbrMetallicRoughness?.baseColorTexture).length;
    const anims = new Set((glb.json.animations || []).map((a) => a.name));
    const fails = [];
    if (b.tris < req.minTris) fails.push(`${b.tris} tris < ${req.minTris}`);
    if (textured < req.minTexturedMaterials) fails.push(`${textured} painted materials < ${req.minTexturedMaterials}`);
    if (px < req.minTexturePixels) fails.push(`${(px / 1e6).toFixed(2)} Mpx texture < ${(req.minTexturePixels / 1e6).toFixed(2)}`);
    if (glb.bytes > req.maxBytes) fails.push(`${(glb.bytes / 1e6).toFixed(2)} MB > ${(req.maxBytes / 1e6).toFixed(0)} MB`);
    for (const a of req.requiredAnimations || []) if (!anims.has(a)) fails.push(`missing animation ${a}`);
    rows.push({
      id: `model:${name}`,
      ok: fails.length === 0,
      detail: fails.length ? fails.join('; ') : `${b.tris} tris, ${textured} painted mats, ${(px / 1e6).toFixed(1)} Mpx`,
    });
  }
  return { rows, ok: rows.every((r) => r.ok) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, ok } = checkModels();
  for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(28)} ${r.detail}`);
  process.exit(ok ? 0 : 1);
}
