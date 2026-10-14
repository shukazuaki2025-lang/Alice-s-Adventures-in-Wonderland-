import { Page, expect } from '@playwright/test';

export interface GameStateSnapshot {
  state: string;
  aliceScale: number;
  inventory: Array<{ id: string; name: string }>;
  flags: Record<string, boolean | number | string>;
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

    // Wait until window.__game is available on window
    await this.page.waitForFunction(() => typeof (window as any).__game !== 'undefined', {
      timeout: 15000,
    });
  }

  /**
   * Retrieves the current game state snapshot via window.__game.getState()
   */
  async getState(): Promise<GameStateSnapshot> {
    return await this.page.evaluate(() => (window as any).__game.getState());
  }

  /**
   * Invokes window.__game.goto(state)
   */
  async goto(state: string): Promise<void> {
    await this.page.evaluate((s) => (window as any).__game.goto(s), state);
  }

  /**
   * Invokes window.__game.setFlag(flag, value)
   */
  async setFlag(flag: string, value: boolean | number | string): Promise<void> {
    await this.page.evaluate(
      ({ f, v }) => (window as any).__game.setFlag(f, v),
      { f: flag, v: value }
    );
  }

  /**
   * Invokes window.__game.getFlag(flag)
   */
  async getFlag(flag: string): Promise<boolean | number | string | undefined> {
    return await this.page.evaluate((f) => (window as any).__game.getFlag(f), flag);
  }

  /**
   * Invokes window.__game.addItem(itemId)
   */
  async addItem(itemId: string): Promise<void> {
    await this.page.evaluate((id) => (window as any).__game.addItem(id), itemId);
  }

  /**
   * Invokes window.__game.setScale(scale)
   */
  async setScale(scale: number): Promise<void> {
    await this.page.evaluate((s) => (window as any).__game.setScale(s), scale);
  }

  /**
   * Invokes window.__game.triggerInteraction(id)
   */
  async triggerInteraction(id: string): Promise<void> {
    await this.page.evaluate((i) => (window as any).__game.triggerInteraction(i), id);
  }

  /**
   * Polls until the game state reaches the expected state
   */
  async waitForState(expectedState: string, timeoutMs = 10000): Promise<void> {
    await expect
      .poll(async () => {
        const state = await this.getState();
        return state.state;
      }, { timeout: timeoutMs })
      .toBe(expectedState);
  }

  /**
   * Polls until a specific flag equals the expected value
   */
  async waitForFlag(flag: string, expectedValue: unknown, timeoutMs = 10000): Promise<void> {
    await expect
      .poll(async () => {
        return await this.getFlag(flag);
      }, { timeout: timeoutMs })
      .toBe(expectedValue);
  }
}
