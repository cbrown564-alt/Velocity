import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || '4173');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 120000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
