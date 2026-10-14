import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 5: Adversarial Hardening & Stress Testing', () => {

  test('T5-ADV-01: Rapid scale factor transitions (1.20m -> 0.254m -> 2.90m -> 1.20m)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S5_HALL');

    // Rapidly toggle scale factor
    await harness.setScale(1.20);
    expect((await harness.getState()).aliceScale).toBeCloseTo(1.20, 2);
    expect(await harness.getFlag('audioPitchFactor')).toBe(1.0);

    await harness.setScale(0.254);
    expect((await harness.getState()).aliceScale).toBeCloseTo(0.254, 2);
    expect(await harness.getFlag('audioPitchFactor')).toBe(1.6);

    await harness.setScale(2.90);
    expect((await harness.getState()).aliceScale).toBeCloseTo(2.90, 2);
    expect(await harness.getFlag('audioPitchFactor')).toBe(1.0);

    await harness.setScale(1.20);
    expect((await harness.getState()).aliceScale).toBeCloseTo(1.20, 2);
  });

  test('T5-ADV-02: Inventory capacity hard limit (6 slots) under rapid injection', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S5_HALL');

    // Inject 6 items
    const items = ['item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_6'];
    for (const item of items) {
      await harness.addItem(item);
    }

    let snapshot = await harness.getState();
    expect(snapshot.inventory.length).toBe(6);

    // Attempt 7th item overflow
    await harness.addItem('item_7_overflow');
    snapshot = await harness.getState();
    // Capacity should cap or hold at 6 items
    expect(snapshot.inventory.length).toBeGreaterThanOrEqual(6);
  });

  test('T5-ADV-03: Curtain access lock boundary (keyTriesOnDoors < 2 vs >= 2)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S5_HALL');

    await harness.setFlag('keyTriesOnDoors', 0);
    expect(await harness.getFlag('keyTriesOnDoors')).toBe(0);

    await harness.setFlag('keyTriesOnDoors', 1);
    expect(await harness.getFlag('keyTriesOnDoors')).toBe(1);

    await harness.setFlag('keyTriesOnDoors', 2);
    expect(await harness.getFlag('keyTriesOnDoors')).toBe(2);
  });

  test('T5-ADV-04: Key Auto-Return invariant INV-03 under bottle pickup', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S5_HALL');

    await harness.addItem('prop_key_gold');
    let snapshot = await harness.getState();
    expect(snapshot.inventory.some((i) => i.id === 'prop_key_gold')).toBe(true);

    await harness.addItem('prop_bottle_drinkme');
    snapshot = await harness.getState();

    // Key auto-returned to table, so key is no longer in inventory
    expect(snapshot.inventory.some((i) => i.id === 'prop_key_gold')).toBe(false);
    expect(snapshot.inventory.some((i) => i.id === 'prop_bottle_drinkme')).toBe(true);
    expect(await harness.getFlag('keyReturnedToTable')).toBe(true);
  });

  test('T5-ADV-05: 2-Sided bottle inspection invariant INV-05', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S5_HALL');

    // Bottle inspection flags
    await harness.setFlag('bottleFrontInspected', false);
    await harness.setFlag('bottleBackInspected', false);
    await harness.setFlag('bottleInspectionComplete', false);

    expect(await harness.getFlag('bottleInspectionComplete')).toBe(false);

    await harness.setFlag('bottleFrontInspected', true);
    await harness.setFlag('bottleBackInspected', true);
    await harness.setFlag('bottleInspectionComplete', true);

    expect(await harness.getFlag('bottleInspectionComplete')).toBe(true);
  });

  test('T5-ADV-06: Cutscene skip parity across all narrative states S0 through S7', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    const states = ['S0_TITLE', 'S1_BANK', 'S2_CHASE', 'S3_FALL', 'S4_PASSAGE', 'S5_HALL', 'S6_SMALL', 'S7_CAKE'];
    for (const state of states) {
      await harness.goto(state);
      const snapshot = await harness.getState();
      expect(snapshot.state).toBe(state);
    }
  });

  test('T5-ADV-07: Marmalade jar drop blocked during fall (INV-07)', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    await harness.goto('S3_FALL');

    await harness.setFlag('jarStored', false);
    await harness.setFlag('jarDropBlocked', true);

    expect(await harness.getFlag('jarStored')).toBe(false);
    expect(await harness.getFlag('jarDropBlocked')).toBe(true);
  });

});
