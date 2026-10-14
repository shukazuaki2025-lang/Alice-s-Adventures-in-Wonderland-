import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 2: Boundary & Corner Cases (BVA & Edge Conditions)', () => {
  test('T2-B01: Alice scale factor transitions from normal (1.0) to small (0.2117) via bottle drink', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.playToS1Bank();
    let snapshot = await harness.getState();
    expect(snapshot.aliceScale).toBeCloseTo(1.0, 3);

    await harness.playToS6Small();
    snapshot = await harness.getState();
    expect(snapshot.aliceScale).toBeCloseTo(0.2117, 3);
    const sizeText = await page.locator('#ui-size-text').textContent();
    expect(sizeText).toContain('0.254 m');
  });

  test('T2-B02: Daisy deduplication in inventory (picking 2 daisies uses 1 slot)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.playToS2Chase();
    expect(await harness.getFlag('daisiesPicked')).toBe(2);
    const inv = await harness.getInventory();
    const daisyEntries = inv.filter((i) => i.id === 'daisy');
    expect(daisyEntries.length).toBe(1);
  });

  test('T2-B03: Slippery glass table leg climb boundary (2 attempts required in S6_SMALL)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.playToS6Small();
    expect(await harness.getFlag('climbAttempts')).toBe(0);

    await harness.movePlayerTo(0.85, -0.6);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('climbAttempts')).toBe(1);
    expect((await harness.getState()).state).toBe('S6_SMALL');

    await harness.pressKey('KeyE');
    expect(await harness.getFlag('climbAttempts')).toBe(2);
    await harness.fastForward(6);
    expect((await harness.getState()).state).toBe('S7_CAKE');
  });

  test('T2-B04: Window resize updates renderer canvas dimensions cleanly (C-05)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS1Bank();

    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(200);

    const dims = await page.evaluate(() => {
      const c = document.getElementById('render-canvas') as HTMLCanvasElement;
      return { w: c.clientWidth, h: c.clientHeight };
    });
    expect(dims.w).toBe(900);
    expect(dims.h).toBe(600);
  });

  test('T2-B05: Stuck hint timer boundaries (60s Tier 1 vs 120s Tier 2 via simulation stepping)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS2Chase();

    expect(await harness.getFlag('stuckHintTier')).toBe(0);

    await harness.fastForward(61);
    expect(await harness.getFlag('stuckHintTier')).toBe(1);

    await harness.fastForward(61);
    expect(await harness.getFlag('stuckHintTier')).toBe(2);
  });
});
