import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { GameHarnessHelper } from './helpers/gameHarness';
import { METRICS_SRC } from '../../tools/lib/image-metrics.mjs';

/**
 * Captures REAL rendered frames (canvas pixels, no UI overlay) of every chapter state through genuine input-driven
 * progression, measures their painterly-richness statistics (tools/lib/image-metrics.mjs) and writes
 *   docs/devlog/gate/visual-metrics.json   +   docs/devlog/gate/screens/*.png
 * tools/quality-gate.mjs compares the numbers with docs/review/gate-thresholds.json ("scenes", "aliceViews").
 * This spec only measures and saves; it deliberately asserts nothing so the gate can show every failure at once.
 */
const OUT = path.join(process.cwd(), 'docs/devlog/gate');
const SCREENS = path.join(OUT, 'screens');

async function grab(page: import('@playwright/test').Page, name: string): Promise<Record<string, number>> {
  await page.waitForTimeout(500);
  const dataUrl: string = await page.evaluate(() => {
    const c = document.getElementById('render-canvas') as HTMLCanvasElement;
    return c.toDataURL('image/png');
  });
  fs.mkdirSync(SCREENS, { recursive: true });
  fs.writeFileSync(path.join(SCREENS, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await page.addScriptTag({ content: METRICS_SRC }).catch(() => {});
  const m: Record<string, number> = await page.evaluate(async (u) => (window as any).measure(u, null), dataUrl);
  const stats: { calls: number; triangles: number } = await page.evaluate(() => (window as any).__game.getRenderStats());
  return { ...m, drawCalls: stats.calls, triangles: stats.triangles };
}

test('Visual parity capture across the chapter', async ({ page }) => {
  test.setTimeout(900_000);
  const metrics: Record<string, Record<string, number>> = {};
  const h = new GameHarnessHelper(page);
  await h.openGame('/?test=1&forceWebGL=1&scale=1&msaa=4');   // the gate measures the full-quality picture
  await h.playToS1Bank();
  await page.waitForFunction(() => (window as any).__game.getAliceAnimation().clips.length >= 15, undefined, { timeout: 30000 });
  await h.movePlayerTo(3.2, -1.0);
  await h.fastForward(3.5); // lets the chapter card and dialogue fade
  await page.waitForTimeout(800);
  metrics.S1_BANK = await grab(page, 's1_bank');

  // orbit to look back across the meadow at the oak and the river (real drag)
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(380, 330, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  metrics.S1_BANK_orbit = await grab(page, 's1_bank_orbit');

  await h.playToS3Fall();
  await h.fastForward(18);
  metrics.S3_FALL = await grab(page, 's3_fall');

  await h.playToS4Passage();
  await h.fastForward(1.5);
  metrics.S4_PASSAGE = await grab(page, 's4_passage');

  await h.playToS5Hall();
  await h.fastForward(1.5);
  metrics.S5_HALL = await grab(page, 's5_hall');

  await h.playToS6Small();
  await h.fastForward(1.5);
  metrics.S6_SMALL = await grab(page, 's6_small');

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'visual-metrics.json'), JSON.stringify({ capturedAt: new Date().toISOString(), scenes: metrics }, null, 2));
});

async function captureViews(
  page: import('@playwright/test').Page,
  views: Record<string, string>,
  prefix: string,
): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  await page.setViewportSize({ width: 900, height: 1000 });
  for (const [name, q] of Object.entries(views)) {
    await page.goto(`/viewer.html?ui=0&${q}`);
    await page.waitForFunction(() => (window as any).__viewer, undefined, { timeout: 30000 });
    await page.evaluate(() => (window as any).__viewer.ready);
    await page.waitForTimeout(400);
    const dataUrl: string = await page.evaluate(() => (document.getElementById('viewer-canvas') as HTMLCanvasElement).toDataURL('image/png'));
    fs.mkdirSync(SCREENS, { recursive: true });
    fs.writeFileSync(path.join(SCREENS, `${prefix}_${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    await page.addScriptTag({ content: METRICS_SRC }).catch(() => {});
    out[name] = await page.evaluate(async (u) => (window as any).measure(u, null), dataUrl);
  }
  return out;
}

function mergeMetrics(patch: Record<string, unknown>): void {
  const file = path.join(OUT, 'visual-metrics.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify({ ...prev, ...patch }, null, 2));
}

test('Alice model views (viewer, same toon + ink pipeline as the game)', async ({ page }) => {
  test.setTimeout(300_000);
  const aliceViews = await captureViews(page, {
    front: 'model=chr_alice&clip=Alice_Idle&p=0.1&yaw=0&pitch=3&dist=3.4&ty=0.6&fov=32',
    threeQuarter: 'model=chr_alice&clip=Alice_Idle&p=0.1&yaw=38&pitch=6&dist=3.4&ty=0.6&fov=32',
    face: 'model=chr_alice&clip=Alice_Idle&p=0.1&yaw=14&pitch=3&dist=1.0&ty=1.0&fov=30',
    walk: 'model=chr_alice&clip=Alice_Walk&p=0.3&yaw=60&pitch=4&dist=3.4&ty=0.6&fov=32',
  }, 'alice');
  mergeMetrics({ aliceViews });
});

test('NPC model views (sister, White Rabbit)', async ({ page }) => {
  test.setTimeout(300_000);
  const npcViews = await captureViews(page, {
    sister: 'model=chr_sister&clip=Sister_ReadIdle&p=0.2&yaw=25&pitch=8&dist=2.6&ty=0.45&fov=32',
    rabbit: 'model=chr_rabbit&yaw=25&pitch=6&dist=2.2&ty=0.38&fov=32',
  }, 'npc');
  mergeMetrics({ npcViews });
});
