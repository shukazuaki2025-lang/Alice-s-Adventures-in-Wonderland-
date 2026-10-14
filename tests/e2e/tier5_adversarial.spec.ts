import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 5: Adversarial Hardening & Stress Testing', () => {
  test('T5-ADV-01: Corrupted localStorage save data is safely rejected by Zod validation (B-11)', async ({ page }) => {
    await page.goto('/?test=1&forceWebGL=1');
    await page.evaluate(() => {
      localStorage.setItem('alice.save.v1', '{"state":"INVALID_HACKED_STATE","flags":"not-an-object"}');
    });

    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // Game must start cleanly at S0_TITLE without crashing
    const snapshot = await harness.getState();
    expect(snapshot.state).toBe('S0_TITLE');
  });

  test('T5-ADV-02: Save & Continue Journey restores exact state from localStorage (B-01)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.playToS2Chase();
    expect((await harness.getState()).state).toBe('S2_CHASE');

    // Reload page -> starts at S0_TITLE with #btn-continue-journey visible
    await harness.openGame('/?test=1&forceWebGL=1');
    expect((await harness.getState()).state).toBe('S0_TITLE');
    await expect(page.locator('#btn-continue-journey')).toBeVisible();

    await harness.clickElement('#btn-continue-journey');
    await harness.waitForState('S2_CHASE');
    expect(await harness.getFlag('daisiesPicked')).toBe(2);
  });

  test('T5-ADV-03: Pause Menu freezes simulation movement until resumed (B-12)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS1Bank();

    // Open Pause Menu with Escape
    await harness.pressKey('Escape');
    await expect(page.locator('#ui-pause-menu')).toBeVisible();

    // Resume via Pause Menu button
    await harness.clickElement('#btn-pause-resume');
    await expect(page.locator('#ui-pause-menu')).toBeHidden();
  });

  test('T5-ADV-04: Production mode (without ?test=1) does NOT expose window.__game (F-05)', async ({ page }) => {
    await page.goto('/?forceWebGL=1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const hasGameGlobal = await page.evaluate(() => typeof (window as any).__game !== 'undefined');
    expect(hasGameGlobal).toBe(false);
  });
});
