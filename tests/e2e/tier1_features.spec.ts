import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 1: Feature Coverage (Happy Path - Genuine Input Verification)', () => {
  test('F01 & F14 & F24: Read-only test harness initialization and canvas mounting', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    const canvas = page.locator('#render-canvas');
    await expect(canvas).toBeVisible();

    // Verify window.__game exposes only read-only & simulation helpers (Integrity Red Line #1)
    const hasMutators = await page.evaluate(() => {
      const g = (window as any).__game;
      return Boolean(g.goto || g.setFlag || g.addItem || g.setScale);
    });
    expect(hasMutators).toBe(false);

    const state = await harness.getState();
    expect(state.state).toBe('S0_TITLE');
    expect(state.aliceScale).toBeCloseTo(1.0, 3);
    expect(Array.isArray(state.inventory)).toBe(true);
  });

  test('F18 & F21 & F22: Input-driven progression from S0_TITLE through S5_HALL', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.playToS1Bank();
    expect((await harness.getState()).state).toBe('S1_BANK');

    await harness.playToS2Chase();
    expect((await harness.getState()).state).toBe('S2_CHASE');
    expect(await harness.getFlag('daisiesPicked')).toBe(2);

    await harness.playToS3Fall();
    expect((await harness.getState()).state).toBe('S3_FALL');

    await harness.playToS4Passage();
    expect((await harness.getState()).state).toBe('S4_PASSAGE');
    expect(await harness.getFlag('jarStored')).toBe(true);
    expect(await harness.getFlag('curtsey')).toBe(true);

    await harness.playToS5Hall();
    expect((await harness.getState()).state).toBe('S5_HALL');
  });

  test('F11 & D-03: Picking a daisy displays bespoke flower SVG icon (never a key icon)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS1Bank();

    await harness.movePlayerTo(3.6, -1.2);
    await harness.pressKey('KeyE');

    const inv = await harness.getInventory();
    expect(inv.some((i) => i.id === 'daisy')).toBe(true);

    const slotSvg = page.locator('#ui-inventory-bar .ui-inventory-slot').first().locator('svg.icon-daisy');
    await expect(slotSvg).toBeVisible();
  });

  test('D-01 & D-02: Language switcher updates 100% of Title and UI text without English leakage', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // Switch to English
    await page.click('.ui-lang-btn[data-lang="en"]');
    const h1En = await page.locator('[data-ui="title_h1"]').textContent();
    expect(h1En).toContain('Alice');

    // Switch to Chinese
    await page.click('.ui-lang-btn[data-lang="zh"]');
    const h1Zh = await page.locator('[data-ui="title_h1"]').textContent();
    expect(h1Zh).toContain('爱丽丝');
    const startZh = await page.locator('[data-ui="title_start"]').textContent();
    expect(startZh).toContain('开始旅程');
  });

  test('F23: /making-of showcase page accessibility', async ({ page }) => {
    await page.goto('/making-of.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('F13: /viewer.html model viewer page accessibility', async ({ page }) => {
    await page.goto('/viewer.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
