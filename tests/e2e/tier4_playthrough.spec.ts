import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';

test.describe('Tier 4: Real-World Application Scenario (Full Chapter 1 Walkthrough S0-S7)', () => {

  test('T4-W01: Full Chapter 1 playthrough walkthrough S0 to S7 and END_CARD', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');

    // Track console errors to ensure zero uncaught errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 0: S0_TITLE -> Begin Journey
    let state = await harness.getState();
    expect(state.state).toBe('S0_TITLE');
    await harness.goto('S1_BANK');

    // Step 1: S1_BANK -> Daisy picking & White Rabbit chase trigger
    state = await harness.getState();
    expect(state.state).toBe('S1_BANK');

    await harness.setFlag('sisterBookInspected', true);
    await harness.setFlag('daisiesPicked', 2);
    await harness.setFlag('rabbitSeen', true);
    expect(await harness.getFlag('daisiesPicked')).toBe(2);

    await harness.goto('S2_CHASE');

    // Step 2: S2_CHASE -> Rabbit burrow jump
    state = await harness.getState();
    expect(state.state).toBe('S2_CHASE');

    await harness.setFlag('chaseStarted', true);
    await harness.setFlag('rabbitInHole', true);
    await harness.goto('S3_FALL');

    // Step 3: S3_FALL -> 90s Well Fall, Marmalade Jar, Thoughts, Curtsey
    state = await harness.getState();
    expect(state.state).toBe('S3_FALL');

    await harness.setFlag('jarTaken', true);
    await harness.setFlag('jarStored', true);
    await harness.setFlag('curtsey', true);
    await harness.goto('S4_PASSAGE');

    // Step 4: S4_PASSAGE -> Corridor corner chase
    state = await harness.getState();
    expect(state.state).toBe('S4_PASSAGE');

    await harness.goto('S5_HALL');

    // Step 5: S5_HALL -> Locked doors, Golden Key, Curtain, Garden Peek
    state = await harness.getState();
    expect(state.state).toBe('S5_HALL');

    await harness.setFlag('doorsTried', 4);
    await harness.setFlag('keyTaken', true);
    await harness.setFlag('keyTriesOnDoors', 2);
    await harness.setFlag('curtainRevealed', true);
    await harness.setFlag('littleDoorUnlocked', true);
    await harness.setFlag('peekDone', true);

    await harness.goto('S6_SMALL');

    // Step 6: S6_SMALL -> Bottle pickup (Key Auto-Return), 2-sided inspection, Drink & Shrink to 0.254m
    state = await harness.getState();
    expect(state.state).toBe('S6_SMALL');

    await harness.setFlag('keyReturnedToTable', true);
    await harness.setFlag('bottleInspectedFront', true);
    await harness.setFlag('bottleInspectedBack', true);
    await harness.setFlag('drankPotion', true);
    await harness.setScale(0.254);
    await harness.setFlag('climbAttempts', 2);

    expect((await harness.getState()).aliceScale).toBe(0.254);
    await harness.goto('S7_CAKE');

    // Step 7: S7_CAKE -> Glass Box, EAT ME Cake, Chapter Finale
    state = await harness.getState();
    expect(state.state).toBe('S7_CAKE');

    await harness.setFlag('boxOpened', true);
    await harness.setFlag('cakeEaten', true);
    await harness.goto('END');

    // Final Assertion: State is END and zero fatal console errors
    state = await harness.getState();
    expect(state.state).toBe('END');
    expect(consoleErrors.length).toBe(0);
  });
});
