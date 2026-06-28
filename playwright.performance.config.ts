import { defineConfig } from '@playwright/test';

/**
 * Phase 5 Task 1 — production-browser performance dashboard.
 *
 * Mirrors `playwright.production.config.ts`: it builds `dist` and serves it with
 * `vite preview` so the dashboard measures the *production* bundle a pilot user
 * actually loads, not the Vite dev server. The single dashboard spec drives the
 * full pilot path (cold start -> upload -> first crosstab -> export modal) and
 * writes `validation/performance_dashboard_latest.json`.
 *
 * Run with: npm run benchmark:perf
 */

const port = Number(process.env.PLAYWRIGHT_PERFORMANCE_PORT || '4177');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'performance-dashboard.spec.ts',
  timeout: 180000,
  // A dashboard reading is a single-sample wall-clock measurement; retries would
  // silently replace a slow sample, so do not retry.
  retries: 0,
  workers: 1,
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
