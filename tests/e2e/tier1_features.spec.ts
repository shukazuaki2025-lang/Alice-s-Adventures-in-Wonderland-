import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 1: Feature Coverage (Happy Path - Features 1 through 27)', () => {

  test('F01 & F14 & F24: Test harness initialization and canvas mounting', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // Canvas element must be present in DOM
    const canvas = page.locator('#render-canvas');
    await expect(canvas).toBeVisible();

    // Verify window.__game harness methods are exposed
    const state = await harness.getState();
    expect(state).toBeDefined();
    expect(state.state).toBe('S0_TITLE');
    expect(state.aliceScale).toBe(1.0);
    expect(state.inventory).toBeDefined();
    expect(state.flags).toBeDefined();
  });

  test('F18 & F21 & F22: S0-S7 State Machine transitions via goto()', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    const states = [
      'S0_TITLE',
      'S1_BANK',
      'S2_CHASE',
      'S3_FALL',
      'S4_PASSAGE',
      'S5_HALL',
      'S6_SMALL',
      'S7_CAKE',
      'END',
    ];

    for (const targetState of states) {
      await harness.goto(targetState);
      const snapshot = await harness.getState();
      expect(snapshot.state).toBe(targetState);
    }
  });

  test('F11 & F24: Inventory item injection and retrieval', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.addItem('prop_key_gold');
    await harness.addItem('prop_cake_eatme');

    const snapshot = await harness.getState();
    expect(snapshot.inventory.length).toBe(2);
    expect(snapshot.inventory[0]?.id).toBe('prop_key_gold');
    expect(snapshot.inventory[1]?.id).toBe('prop_cake_eatme');
  });

  test('F12 & F24: Alice scale modification via setScale()', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // Set scale to small mode (0.254m / 1.20m = ~0.2117)
    await harness.setScale(0.254);
    let snapshot = await harness.getState();
    expect(snapshot.aliceScale).toBe(0.254);

    // Set scale to giant mode (2.90m)
    await harness.setScale(2.90);
    snapshot = await harness.getState();
    expect(snapshot.aliceScale).toBe(2.90);
  });

  test('F05 & F24: State flags getter and setter operations', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.setFlag('keyTriesOnDoors', 2);
    const value = await harness.getFlag('keyTriesOnDoors');
    expect(value).toBe(2);

    await harness.setFlag('curtainRevealed', true);
    const boolValue = await harness.getFlag('curtainRevealed');
    expect(boolValue).toBe(true);
  });

  test('F23: /making-of showcase page accessibility', async ({ page }) => {
    await page.goto('/making-of.html');
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).toBeDefined();
    
    // Verify document loaded without fatal error
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('F13: /viewer.html model viewer page accessibility', async ({ page }) => {
    await page.goto('/viewer.html');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
