import { test, expect } from '@playwright/test';
import { GameHarnessHelper } from './helpers/gameHarness';
import fs from 'fs';
import path from 'path';

test.describe('E2E Screenshot Artifact Capture', () => {
  const outputDir = path.join(process.cwd(), 'docs/devlog/screens/e2e');

  test.beforeAll(() => {
    fs.mkdirSync(outputDir, { recursive: true });
  });

  test('Capture non-blank screenshots across S0-S7 gameplay states', async ({ page }) => {
    const harness = new GameHarnessHelper(page);
    await harness.openGame('/?test=1&forceWebGL=1');
    await page.waitForTimeout(1000);

    // 1. S0 Title Screen
    await page.screenshot({ path: path.join(outputDir, 's0_title.png') });

    // 2. S1 Riverbank Meadow
    await harness.goto('S1_BANK');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 's1_bank_meadow.png') });

    // 3. S3 Well Shaft Fall
    await harness.goto('S3_FALL');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 's3_well_fall.png') });

    // 4. S5 Great Hall
    await harness.goto('S5_HALL');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 's5_great_hall.png') });

    // 5. Item Inspector Overlay
    await harness.addItem('prop_key_gold');
    await harness.addItem('prop_bottle_drinkme');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 'item_inspector.png') });

    // 6. Garden Peek Cutscene (C5)
    await harness.setFlag('peekDone', true);
    await harness.setFlag('littleDoorOpened', true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 'garden_peek.png') });

    // 7. Chapter Finale End Card (S7)
    await harness.goto('END');
    await harness.setFlag('chapterCompleted', true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 'chapter1_finale.png') });

    // Verify screenshot files exist and are > 0 bytes
    const files = [
      's0_title.png',
      's1_bank_meadow.png',
      's3_well_fall.png',
      's5_great_hall.png',
      'item_inspector.png',
      'garden_peek.png',
      'chapter1_finale.png',
    ];

    for (const f of files) {
      const filePath = path.join(outputDir, f);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });
});
