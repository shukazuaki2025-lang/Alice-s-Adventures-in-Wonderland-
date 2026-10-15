#!/usr/bin/env node
/**
 * Render screenshots of the model viewer (src/viewer) through headless Chromium.
 *
 *   node tools/viewer-shot.mjs <out.png> "<viewer query string>" [width] [height]
 *   node tools/viewer-shot.mjs --batch <batch.json>        // [{ out, query, width?, height? }, ...]
 *
 * Needs the dev server (npm run dev) on :5173 – set VIEWER_BASE to override.
 * Set PW_CHROMIUM_PATH to use a pre-installed Chromium instead of Playwright's download.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.VIEWER_BASE || 'http://localhost:5173';

export async function launch() {
  return chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
}

export async function shoot(browser, { out, query, width = 1000, height = 1000 }) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${BASE}/viewer.html?ui=0&${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__viewer, { timeout: 30000 });
  await page.evaluate(() => window.__viewer.ready);
  const loadError = await page.evaluate(() => window.__viewerError);
  if (loadError) throw new Error(`viewer failed to load model: ${loadError}`);
  await page.waitForTimeout(250);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await page.close();
  if (errors.length) console.warn(`[viewer-shot] ${out}: ${errors.slice(0, 3).join(' | ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const browser = await launch();
  try {
    if (args[0] === '--batch') {
      const list = JSON.parse(fs.readFileSync(args[1], 'utf8'));
      for (const job of list) await shoot(browser, job);
    } else {
      const [out, query, w, h] = args;
      await shoot(browser, { out, query: query || '', width: Number(w) || 1000, height: Number(h) || 1000 });
    }
  } finally {
    await browser.close();
  }
}
