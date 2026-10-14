import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

/**
 * Real-input acceptance tests for the controls the user reported broken: mouse look, drag-orbit, wheel zoom,
 * camera-relative WASD, and character locomotion/animation. Every assertion is made through GENUINE mouse/keyboard events;
 * the harness is used read-only (getCameraState / getPlayerMotion / getAliceAnimation).
 *
 * Software rasterisers are slow, so everything polls on observable state instead of sleeping fixed times.
 */
type Cam = { yaw: number; pitch: number; zoom: number; distance: number; forward: { x: number; y: number; z: number }; position: { x: number; y: number; z: number } };

async function cam(page: import('@playwright/test').Page): Promise<Cam> {
  return page.evaluate(() => (window as any).__game.getCameraState());
}
async function motion(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as any).__game.getPlayerMotion());
}
async function anim(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as any).__game.getAliceAnimation());
}
async function settle(page: import('@playwright/test').Page): Promise<Cam> {
  let prev = await cam(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const cur = await cam(page);
    if (Math.abs(cur.yaw - prev.yaw) < 1e-4 && Math.abs(cur.pitch - prev.pitch) < 1e-4 && Math.abs(cur.zoom - prev.zoom) < 1e-4) return cur;
    prev = cur;
  }
  return prev;
}

test.describe('Controls: camera orbit, zoom, camera-relative movement, animation', () => {
  test.beforeEach(async ({ page }) => {
    const h = new GameHarnessHelper(page);
    await h.openGame('/?test=1&forceWebGL=1');
    await h.playToS1Bank();
    await page.waitForFunction(() => (window as any).__game.getAliceAnimation().clips.length >= 15, undefined, { timeout: 30000 });
    // let the title/chapter card fade so nothing overlays the canvas
    await page.waitForTimeout(500);
  });

  test('CTRL-01: holding the left button and dragging orbits the camera (right = turn right, down = look down)', async ({ page }) => {
    const before = await settle(page);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(800, 400, { steps: 10 });
    await page.mouse.up();
    const after = await settle(page);
    expect(after.yaw, 'dragging right must turn the camera right').toBeLessThan(before.yaw - 0.4);
    expect(after.pitch, 'dragging down must raise the camera (look further down)').toBeGreaterThan(before.pitch + 0.1);
    // distance to Alice is preserved by an orbit
    expect(Math.abs(after.distance - before.distance)).toBeLessThan(0.3);
  });

  test('CTRL-02: right-button drag orbits too, and a plain click does not move the camera', async ({ page }) => {
    const before = await settle(page);
    await page.mouse.click(640, 360);
    const clicked = await settle(page);
    expect(Math.abs(clicked.yaw - before.yaw)).toBeLessThan(0.01);
    await page.mouse.move(640, 360);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(520, 360, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    const after = await settle(page);
    expect(after.yaw, 'right-drag left turns the view left').toBeGreaterThan(before.yaw + 0.3);
  });

  test('CTRL-03: pitch is limited and the lens stays above the floor', async ({ page }) => {
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(640, 660, { steps: 12 });
    await page.mouse.move(640, 700, { steps: 6 });
    await page.mouse.up();
    const down = await settle(page);
    expect(down.pitch).toBeLessThanOrEqual((80 * Math.PI) / 180 + 1e-3);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(640, 20, { steps: 14 });
    await page.mouse.move(640, 0, { steps: 6 });
    await page.mouse.up();
    const up = await settle(page);
    expect(up.pitch).toBeGreaterThanOrEqual((-10 * Math.PI) / 180);
    expect(up.position.y).toBeGreaterThan(0.04);
  });

  test('CTRL-04: mouse wheel zooms smoothly within limits', async ({ page }) => {
    test.setTimeout(180_000); // wheel events wait for a frame; a software rasteriser can take seconds per frame
    const before = await settle(page);
    await page.mouse.move(640, 360);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -200);
    const closer = await settle(page);
    expect(closer.distance).toBeLessThan(before.distance * 0.85);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 2000); // far beyond the limit: must clamp
    const far = await settle(page);
    expect(far.distance).toBeGreaterThan(before.distance * 1.4);
    expect(far.zoom).toBeLessThanOrEqual(1.91);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -4000);
    const near = await settle(page);
    expect(near.zoom).toBeGreaterThanOrEqual(0.44);
  });

  test('CTRL-05: W walks away from the camera after orbiting (camera-relative), Alice faces her heading', async ({ page }) => {
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(520, 360, { steps: 10 }); // orbit ~ +30° to the left
    await page.mouse.up();
    const c = await settle(page);
    const start = await page.evaluate(() => (window as any).__game.getState().playerPosition);
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await motion(page)).speed, { timeout: 20000 }).toBeGreaterThan(0.6);
    await expect
      .poll(async () => {
        const p = (await page.evaluate(() => (window as any).__game.getState().playerPosition)) as { x: number; z: number };
        return Math.hypot(p.x - start.x, p.z - start.z);
      }, { timeout: 30000 })
      .toBeGreaterThan(0.7);
    await page.keyboard.up('KeyW');
    const end = await page.evaluate(() => (window as any).__game.getState().playerPosition);
    const dx = end.x - start.x, dz = end.z - start.z, len = Math.hypot(dx, dz);
    const dot = (dx * c.forward.x + dz * c.forward.z) / len;
    expect(dot, 'movement direction must equal the camera forward direction').toBeGreaterThan(0.97);
    const m = await motion(page);
    // Alice's facing converges to the heading of travel (yaw = atan2(x, z))
    const heading = Math.atan2(dx, dz);
    const diff = Math.abs(Math.atan2(Math.sin(m.facing - heading), Math.cos(m.facing - heading)));
    expect(diff).toBeLessThan(0.25);
  });

  test('CTRL-06: animation follows motion — idle at rest, walk while moving, run with Shift, idle again after stopping', async ({ page }) => {
    expect((await anim(page)).active).toBe('Alice_Idle');
    await page.keyboard.down('KeyD');
    await expect.poll(async () => (await anim(page)).active, { timeout: 20000 }).toBe('Alice_Walk');
    const walking = await anim(page);
    expect(walking.weights.walk).toBeGreaterThan(0.6);
    expect(walking.walkTimeScale).toBeGreaterThan(0.5);
    await page.keyboard.down('ShiftLeft');
    await expect.poll(async () => (await motion(page)).running, { timeout: 20000 }).toBe(true);
    await expect.poll(async () => (await anim(page)).active, { timeout: 20000 }).toBe('Alice_Run');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyD');
    await expect.poll(async () => (await anim(page)).active, { timeout: 20000 }).toBe('Alice_Idle');
  });

  test('CTRL-07: the legs really alternate while walking (feet are not skating in place)', async ({ page }) => {
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await anim(page)).active, { timeout: 20000 }).toBe('Alice_Walk');
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const l = await page.evaluate(() => (window as any).__game.getAliceBoneWorld('Foot_L'));
      const r = await page.evaluate(() => (window as any).__game.getAliceBoneWorld('Foot_R'));
      if (l && r) samples.push(l.y - r.y);
      await page.waitForTimeout(80);
    }
    await page.keyboard.up('KeyW');
    expect(samples.length).toBeGreaterThan(15);
    expect(Math.max(...samples) - Math.min(...samples), 'one foot must rise above the other during the stride').toBeGreaterThan(0.025);
  });

  test('CTRL-08: releasing focus never leaves Alice walking (stuck-key protection)', async ({ page }) => {
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await motion(page)).speed, { timeout: 20000 }).toBeGreaterThan(0.5);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await motion(page)).speed, { timeout: 20000 }).toBeLessThan(0.05);
    await page.keyboard.up('KeyW');
  });
});
