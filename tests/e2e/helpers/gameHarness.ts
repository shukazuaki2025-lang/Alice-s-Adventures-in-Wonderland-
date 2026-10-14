import { Page, expect } from '@playwright/test';

export interface GameStateSnapshot {
  state: string;
  aliceScale: number;
  inventory: Array<{ id: string; name: string; description?: string; icon?: string }>;
  flags: Record<string, boolean | number | string>;
  playerPosition?: { x: number; y: number; z: number };
  cameraPosition?: { x: number; y: number; z: number };
}

export class GameHarnessHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the game with ?test=1&forceWebGL=1 and waits for window.__game to be registered.
   */
  async openGame(path = '/?test=1&forceWebGL=1'): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');

    await this.page.waitForFunction(() => typeof (window as any).__game !== 'undefined', {
      timeout: 15000,
    });
  }

  /**
   * Read-only state inspection via window.__game
   */
  async getState(): Promise<GameStateSnapshot> {
    return await this.page.evaluate(() => (window as any).__game.getState());
  }

  async getFlag(flag: string): Promise<boolean | number | string | undefined> {
    return await this.page.evaluate((f) => (window as any).__game.getFlag(f), flag);
  }

  async getFlags(): Promise<Record<string, unknown>> {
    return await this.page.evaluate(() => (window as any).__game.getFlags());
  }

  async getInventory(): Promise<Array<{ id: string; name: string }>> {
    return await this.page.evaluate(() => (window as any).__game.getInventory());
  }

  async getPlayerTransform(): Promise<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }> {
    return await this.page.evaluate(() => (window as any).__game.getPlayerTransform());
  }

  async getInteractables(): Promise<string[]> {
    return await this.page.evaluate(() => (window as any).__game.getInteractables());
  }

  async getSceneMetrics(): Promise<{ spawns: number; triggers: number; cameras: number }> {
    return await this.page.evaluate(() => (window as any).__game.getSceneMetrics());
  }

  /**
   * Simulation acceleration and player locomotion helpers
   */
  async setTimeScale(n: number): Promise<void> {
    await this.page.evaluate((scale) => (window as any).__game.setTimeScale(scale), n);
  }

  async fastForward(seconds: number): Promise<void> {
    await this.page.evaluate((sec) => (window as any).__game.fastForward(sec), seconds);
  }

  async movePlayerTo(x: number, z: number): Promise<void> {
    await this.page.evaluate(
      ({ px, pz }) => (window as any).__game.movePlayerTo(px, pz),
      { px: x, pz: z }
    );
  }

  async lookAtBottleSide(side: 'front' | 'back'): Promise<void> {
    await this.page.evaluate((s) => (window as any).__game.lookAtBottleSide(s), side);
  }

  /**
   * Genuine user input actions
   */
  async clickElement(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async holdKey(key: string, durationMs: number): Promise<void> {
    await this.page.keyboard.down(key);
    await this.page.waitForTimeout(durationMs);
    await this.page.keyboard.up(key);
  }

  /**
   * Polls until the game state reaches the expected state
   */
  async waitForState(expectedState: string, timeoutMs = 10000): Promise<void> {
    await expect
      .poll(
        async () => {
          const state = await this.getState();
          return state.state;
        },
        { timeout: timeoutMs }
      )
      .toBe(expectedState);
  }

  /**
   * Polls until a specific flag equals the expected value
   */
  async waitForFlag(flag: string, expectedValue: unknown, timeoutMs = 10000): Promise<void> {
    await expect
      .poll(
        async () => {
          return await this.getFlag(flag);
        },
        { timeout: timeoutMs }
      )
      .toBe(expectedValue);
  }

  /**
   * Genuine input-driven progression helpers (no state/flag mutation backdoors)
   */
  async playToS1Bank(): Promise<void> {
    const current = (await this.getState()).state;
    if (current === 'S0_TITLE') {
      await this.clickElement('#btn-start-journey');
      await this.waitForState('S1_BANK');
    }
  }

  async playToS2Chase(): Promise<void> {
    await this.playToS1Bank();
    if ((await this.getState()).state === 'S1_BANK') {
      // Walk to first daisy and pick it
      await this.movePlayerTo(3.6, -1.2);
      await this.pressKey('KeyE');
      // Walk to second daisy and pick it -> triggers C1 cutscene
      await this.movePlayerTo(5.2, 1.1);
      await this.pressKey('KeyE');
      await this.fastForward(9);
      await this.waitForState('S2_CHASE');
    }
  }

  async playToS3Fall(): Promise<void> {
    await this.playToS2Chase();
    if ((await this.getState()).state === 'S2_CHASE') {
      // Approach rabbit hole and press E -> triggers C2 cutscene
      await this.movePlayerTo(14.0, -2.0);
      await this.pressKey('KeyE');
      await this.fastForward(7);
      await this.waitForState('S3_FALL');
    }
  }

  async playToS4Passage(options: { storeJar?: boolean; curtsey?: boolean } = {}): Promise<void> {
    await this.playToS3Fall();
    if ((await this.getState()).state === 'S3_FALL') {
      await this.fastForward(16);
      if (options.storeJar !== false) {
        // Pick up marmalade jar
        await this.movePlayerTo(0.75, 0.25);
        await this.pressKey('KeyE');
        // Attempt drop (blocked per INV-07)
        await this.pressKey('KeyG');
        // Return jar to cupboard
        await this.movePlayerTo(-0.75, 0.25);
        await this.pressKey('KeyE');
      }
      if (options.curtsey !== false) {
        await this.pressKey('KeyC');
      }
      // Advance through rest of 88s fall + C3 cutscene (5s)
      await this.fastForward(75);
      await this.fastForward(6);
      await this.waitForState('S4_PASSAGE');
    }
  }

  async playToS5Hall(options: { storeJar?: boolean; curtsey?: boolean } = {}): Promise<void> {
    await this.playToS4Passage(options);
    if ((await this.getState()).state === 'S4_PASSAGE') {
      // Walk down passage to exit and press E -> triggers C4 (6s)
      await this.movePlayerTo(18.0, 0);
      await this.pressKey('KeyE');
      await this.fastForward(7);
      await this.waitForState('S5_HALL');
    }
  }

  async playToS6Small(): Promise<void> {
    await this.playToS5Hall();
    if ((await this.getState()).state === 'S5_HALL') {
      // 1. Pick up gold key on glass table
      await this.movePlayerTo(0.92, -0.6);
      await this.pressKey('KeyE');
      // 2. Try 2 locked doors
      await this.movePlayerTo(-8.0, -3.4);
      await this.pressKey('KeyE');
      await this.movePlayerTo(-3.0, -3.4);
      await this.pressKey('KeyE');
      // 3. Open low crimson curtain
      await this.movePlayerTo(-0.8, -3.32);
      await this.pressKey('KeyE');
      // 4. Unlock & peek through 15-inch little door -> C5 (7s)
      await this.movePlayerTo(-0.8, -3.4);
      await this.pressKey('KeyE');
      await this.fastForward(8);
      // 5. Pick up DRINK ME bottle at glass table (auto-returns key per INV-03 and opens 3D inspector)
      await this.movePlayerTo(0.76, -0.54);
      await this.pressKey('KeyE');
      // 6. Inspect front & back labels in 3D inspector (INV-05)
      await this.lookAtBottleSide('front');
      await this.lookAtBottleSide('back');
      // 7. Click Drink button -> triggers C6 (6s) + 2.5s shrink to 0.2117
      await this.clickElement('#btn-inspect-drink');
      await this.fastForward(7);
      await this.waitForState('S6_SMALL');
    }
  }

  async playToS7Cake(): Promise<void> {
    await this.playToS6Small();
    if ((await this.getState()).state === 'S6_SMALL') {
      // Try climbing slippery glass table leg twice -> triggers C7 (5s)
      await this.movePlayerTo(0.85, -0.6);
      await this.pressKey('KeyE');
      await this.pressKey('KeyE');
      await this.fastForward(6);
      await this.waitForState('S7_CAKE');
    }
  }

  async playToEnd(): Promise<void> {
    await this.playToS7Cake();
    if ((await this.getState()).state === 'S7_CAKE') {
      // Open glass box under table & eat EAT ME cake -> triggers C8 (10s)
      await this.movePlayerTo(0.88, -0.62);
      await this.pressKey('KeyE');
      await this.fastForward(11);
      await this.waitForState('END');
    }
  }
}
