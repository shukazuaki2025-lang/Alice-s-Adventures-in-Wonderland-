import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 4: Real-World Application Scenario (Full Chapter 1 Walkthrough S0-S7)', () => {
  test('T4-W01: Complete input-driven Chapter 1 playthrough S0_TITLE -> END with zero console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // S0_TITLE -> S1_BANK -> S2_CHASE -> S3_FALL -> S4_PASSAGE -> S5_HALL -> S6_SMALL -> S7_CAKE -> END
    await harness.playToEnd();

    const finalState = await harness.getState();
    expect(finalState.state).toBe('END');
    expect(await harness.getFlag('jarStored')).toBe(true);
    expect(await harness.getFlag('curtsey')).toBe(true);
    expect(await harness.getFlag('keyReturnedToTable')).toBe(true);
    expect(await harness.getFlag('cakeEaten')).toBe(true);

    // Chapter I Complete modal must be visible
    await expect(page.locator('#ui-chapter-complete')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
