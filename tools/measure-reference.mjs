#!/usr/bin/env node
/**
 * Measure a reference image (e.g. a key-art still from the benchmark game) with the same "painterly richness"
 * statistics the quality gate applies to our own frames, and write the numbers to a JSON file.
 *
 *   node tools/measure-reference.mjs <out.json> <name>=<image>[@x,y,w,h] [<name>=<image>[@x,y,w,h] ...]
 *
 * Only the derived numbers are committed to the repo (docs/art/benchmark/); the reference image itself is third-party
 * artwork and is never copied into the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { measureFiles } from './lib/image-metrics.mjs';

const [out, ...specs] = process.argv.slice(2);
if (!out || specs.length === 0) {
  console.error('usage: node tools/measure-reference.mjs <out.json> <name>=<image>[@x,y,w,h] ...');
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const result = {};
  for (const spec of specs) {
    const [name, rest] = spec.split('=');
    const [file, crop] = rest.split('@');
    const c = crop ? crop.split(',').map(Number) : null;
    const cropObj = c ? { x: c[0], y: c[1], w: c[2], h: c[3] } : undefined;
    const m = await measureFiles(browser, [file], cropObj ? { [file]: cropObj } : {});
    result[name] = { ...m[file], crop: c ?? 'full' };
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
