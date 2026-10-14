import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine } from '../../src/game/StateMachine.ts';
import { PuzzleManager } from '../../src/game/PuzzleManager.ts';

test('M4 & M5 Core Engine & State Machine Unit Verification', async (t) => {
  await t.test('S0-S7 State Machine transitions', () => {
    const sm = new StateMachine();
    const states = [
      'S0_TITLE', 'S1_BANK', 'S2_CHASE', 'S3_FALL',
      'S4_PASSAGE', 'S5_HALL', 'S6_SMALL', 'S7_CAKE', 'END'
    ];
    
    // We can just verify it holds states and transitions correctly
    for (const s of states) {
      sm.goto(s);
      assert.equal(sm.currentState, s);
    }
  });

  await t.test('INV-01: Curtain Access Lock invariant', () => {
    const sm = new StateMachine();
    const pm = new PuzzleManager(sm);
    
    assert.equal(pm.canAccessCurtain(), false);
    sm.setFlag('keyTriesOnDoors', 1);
    assert.equal(pm.canAccessCurtain(), false);
    
    sm.setFlag('keyTriesOnDoors', 2);
    assert.equal(pm.canAccessCurtain(), true);
  });

  await t.test('INV-03: Key Auto-Return on bottle pickup', () => {
    const sm = new StateMachine();
    const pm = new PuzzleManager(sm);
    
    pm.addItem('gold_key');
    assert.equal(pm.getInventory().some(i => i.id === 'gold_key'), true);
    
    pm.addItem('drink_me_bottle');
    assert.equal(pm.getInventory().some(i => i.id === 'gold_key'), false);
    assert.equal(sm.getFlag('keyReturnedToTable'), true);
  });

  await t.test('INV-05: Bottle 3D Inspection 2-sided label verification', () => {
    const sm = new StateMachine();
    const pm = new PuzzleManager(sm);
    
    assert.equal(pm.canDrinkBottle(), false);
    sm.setFlag('bottleInspectedFront', true);
    assert.equal(pm.canDrinkBottle(), false);
    sm.setFlag('bottleInspectedBack', true);
    assert.equal(pm.canDrinkBottle(), true);
  });

  await t.test('INV-07: Marmalade Jar No-Drop', () => {
    const sm = new StateMachine();
    const pm = new PuzzleManager(sm);
    
    sm.setFlag('jarStored', false);
    assert.equal(pm.tryDropJar(), false);
    assert.equal(sm.getFlag('jarDropBlocked'), true);
    
    sm.setFlag('jarStored', true);
    assert.equal(pm.tryDropJar(), true);
  });
  
  await t.test('Stuck Hint System Boundaries (60s vs 120s)', () => {
    const sm = new StateMachine();
    const pm = new PuzzleManager(sm);
    sm.currentState = 'S1_BANK';
    
    pm.update(59);
    assert.equal(sm.getFlag('stuckHintTier'), 0);
    
    pm.update(1);
    assert.equal(sm.getFlag('stuckHintTier'), 1);
    
    pm.update(60);
    assert.equal(sm.getFlag('stuckHintTier'), 2);
  });
});
