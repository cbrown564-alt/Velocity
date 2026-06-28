import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PRODUCTION_PORT || '4175');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'production-smoke.spec.ts',
  timeout: 120000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npm run build && npm run preview -- --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
