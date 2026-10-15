import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Alice's Adventures in Wonderland - Chapter 1
 * Dual-backend opaque-box E2E testing framework with headless Chromium
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Run sequentially for state machine stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to prevent port/state conflicts
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.PW_NO_VIDEO ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      // behavioural + integration specs (what CI runs): half-resolution, no MSAA (see GameHarnessHelper.openGame)
      name: 'chromium',
      testIgnore: /visual_parity\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Lets sandboxes without a Playwright-managed browser point at a system Chromium (PW_CHROMIUM_PATH).
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-webgpu',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
    {
      // full-quality picture capture for `npm run gate` (tools/quality-gate.mjs): slow on a software GPU, so not part of CI
      name: 'gate',
      testMatch: /visual_parity\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-webgpu',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
