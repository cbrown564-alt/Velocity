import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || '4173');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // Production-only specs build and serve `dist`; they have dedicated configs
  // (`playwright.production.config.ts`, `playwright.performance.config.ts`) and
  // must not run against this dev server, where `/assets/*` bundles don't exist.
  testIgnore: ['**/production-smoke.spec.ts', '**/performance-dashboard.spec.ts'],
  timeout: 120000,
  retries: process.env.CI ? 1 : 0,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npm run dev -- --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
