import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 3: Cross-Feature Combinations & Puzzle Invariants (INV-01 to INV-07)', () => {
  test('INV-01: Curtain cannot be opened before keyTriesOnDoors >= 2', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS5Hall();

    // Pick up gold key
    await harness.movePlayerTo(0.92, -0.6);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('keyTaken')).toBe(true);

    // Try opening curtain immediately (keyTriesOnDoors == 0) -> must remain false
    await harness.movePlayerTo(-0.8, -3.32);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('curtainFound')).toBe(false);

    // Try 1 locked door (keyTriesOnDoors == 1) -> curtain still blocked
    await harness.movePlayerTo(-8.0, -3.4);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('keyTriesOnDoors')).toBe(1);
    await harness.movePlayerTo(-0.8, -3.32);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('curtainFound')).toBe(false);

    // Try 2nd locked door (keyTriesOnDoors == 2) -> curtain unlocks
    await harness.movePlayerTo(-3.0, -3.4);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('keyTriesOnDoors')).toBe(2);
    await harness.movePlayerTo(-0.8, -3.32);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('curtainFound')).toBe(true);
  });

  test('INV-03 & INV-05: Picking up bottle auto-returns key to table & requires 2-sided 3D inspection before drinking', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS5Hall();

    // Pick up gold key, try 2 doors, open curtain, peek little door
    await harness.movePlayerTo(0.92, -0.6);
    await harness.pressKey('KeyE');
    await harness.movePlayerTo(-8.0, -3.4);
    await harness.pressKey('KeyE');
    await harness.movePlayerTo(-3.0, -3.4);
    await harness.pressKey('KeyE');
    await harness.movePlayerTo(-0.8, -3.32);
    await harness.pressKey('KeyE');
    await harness.movePlayerTo(-0.8, -3.4);
    await harness.pressKey('KeyE');
    await harness.fastForward(8);
    expect(await harness.getFlag('peekDone')).toBe(true);

    // Pick up bottle on glass table -> INV-03: gold_key removed from inventory and returned to table
    await harness.movePlayerTo(0.76, -0.54);
    await harness.pressKey('KeyE');

    const inv = await harness.getInventory();
    expect(inv.some((i) => i.id === 'gold_key')).toBe(false);
    expect(inv.some((i) => i.id === 'drink_me_bottle')).toBe(true);
    expect(await harness.getFlag('keyReturnedToTable')).toBe(true);
    expect(await harness.getFlag('keyOnTable')).toBe(true);

    // INV-05: Inspecting only front label leaves Drink button disabled
    await harness.lookAtBottleSide('front');
    expect(await harness.getFlag('bottleInspectedFront')).toBe(true);
    expect(await harness.getFlag('drinkButtonUnlocked')).toBe(false);
    await expect(page.locator('#btn-inspect-drink')).toBeDisabled();

    // Inspecting back label unlocks Drink button
    await harness.lookAtBottleSide('back');
    expect(await harness.getFlag('bottleInspectedBack')).toBe(true);
    expect(await harness.getFlag('drinkButtonUnlocked')).toBe(true);
    await expect(page.locator('#btn-inspect-drink')).toBeEnabled();
  });

  test('INV-06: Cutscene 1.0s Escape skip parity equals watching to completion', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS1Bank();

    // Trigger C1 by picking 2 daisies
    await harness.movePlayerTo(3.6, -1.2);
    await harness.pressKey('KeyE');
    await harness.movePlayerTo(5.2, 1.1);
    await harness.pressKey('KeyE');

    // Hold Escape for 1.1s to skip C1
    await harness.holdKey('Escape', 1100);
    await harness.waitForState('S2_CHASE');
    expect(await harness.getFlag('chaseStarted')).toBe(true);
  });

  test('INV-07: Marmalade Jar cannot be dropped mid-air during S3_FALL and C3 never gifts jarStored', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await harness.playToS3Fall();

    await harness.fastForward(16);
    await harness.movePlayerTo(0.75, 0.25);
    await harness.pressKey('KeyE');
    expect(await harness.getFlag('jarTaken')).toBe(true);

    // Attempt to drop jar with G -> blocked per INV-07
    await harness.pressKey('KeyG');
    expect(await harness.getFlag('jarDropBlocked')).toBe(true);
    expect(await harness.getFlag('jarStored')).toBe(false);

    // Finish fall without returning jar to cupboard -> C3 must NOT gift jarStored=true (B-04)
    await harness.fastForward(80);
    await harness.waitForState('S4_PASSAGE');
    expect(await harness.getFlag('jarStored')).toBe(false);
  });
});
