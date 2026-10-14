import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

test.describe('E2E Screenshot Artifact Capture & Pixel Integrity Verification', () => {
  const outputDir = path.join(process.cwd(), 'docs/devlog/screens/e2e');

  test.beforeAll(() => {
    fs.mkdirSync(outputDir, { recursive: true });
  });

  test('Capture genuine input-driven screenshots across S0-END and verify unique MD5 hashes', async ({ page }) => {
    // one long, genuinely input-driven playthrough rendered by software GL on CI: give it room (it takes ~65-90 s)
    test.setTimeout(300_000);
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await page.waitForTimeout(600);

    // 1. S0 Title Screen
    await page.screenshot({ path: path.join(outputDir, 's0_title.png') });

    // 2. S1 Riverbank Meadow (after clicking Start Journey and walking toward daisies)
    await harness.playToS1Bank();
    await harness.movePlayerTo(3.2, -1.0);
    await harness.fastForward(1.5);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outputDir, 's1_bank_meadow.png') });

    // 3. S3 Well Shaft Fall
    await harness.playToS3Fall();
    await harness.fastForward(18);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outputDir, 's3_well_fall.png') });

    // 4. S5 Great Hall of Doors
    await harness.playToS5Hall();
    await harness.fastForward(1.0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outputDir, 's5_great_hall.png') });

    // 5. Garden Peek (C5 / little door unlocked)
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
    await harness.fastForward(3.5);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outputDir, 'garden_peek.png') });
    await harness.fastForward(5.0);

    // 6. 3D Item Inspector Overlay (DRINK ME bottle)
    await harness.movePlayerTo(0.76, -0.54);
    await harness.pressKey('KeyE');
    await harness.lookAtBottleSide('front');
    await harness.lookAtBottleSide('back');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outputDir, 'item_inspector.png') });

    // Drink bottle -> S6_SMALL -> S7_CAKE -> END
    await harness.clickElement('#btn-inspect-drink');
    await harness.fastForward(7);
    await harness.waitForState('S6_SMALL');
    await harness.playToEnd();
    await page.waitForTimeout(400);

    // 7. Chapter 1 Finale End Card
    await page.screenshot({ path: path.join(outputDir, 'chapter1_finale.png') });

    const files = [
      's0_title.png',
      's1_bank_meadow.png',
      's3_well_fall.png',
      's5_great_hall.png',
      'garden_peek.png',
      'item_inspector.png',
      'chapter1_finale.png',
    ];

    const hashes = new Set<string>();
    for (const f of files) {
      const filePath = path.join(outputDir, f);
      expect(fs.existsSync(filePath)).toBe(true);
      const buf = fs.readFileSync(filePath);
      expect(buf.length).toBeGreaterThan(5000);
      const md5 = crypto.createHash('md5').update(buf).digest('hex');
      hashes.add(md5);
    }

    // F-03: Every single screenshot must have a distinct MD5 hash
    expect(hashes.size).toBe(files.length);
  });
});
