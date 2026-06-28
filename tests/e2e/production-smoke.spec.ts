import { expect, test } from '@playwright/test';
import { STARTUP_JS_TRANSFER_BUDGET_BYTES, formatBytes } from './helpers/performanceBudget';

test('production build initializes the analysis worker and DuckDB assets', async ({ page, baseURL }, testInfo) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const workerAssetResponses: Array<{ status: number; url: string }> = [];
  const startupAssetResponses: Array<{ status: number; url: string }> = [];
  const appOrigin = new URL(baseURL ?? 'http://127.0.0.1:4175').origin;
  const startedAt = Date.now();

  const engineReady = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for production engine readiness'));
    }, 60000);

    page.on('console', (message) => {
      const text = `${message.type()}: ${message.text()}`;
      consoleMessages.push(text);
      if (text.includes('[enginePersistenceBridge] Engine ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/assets/')) {
      startupAssetResponses.push({ status: response.status(), url });
    }
    if (url.includes('analysisWorker') || url.includes('duckdb-')) {
      workerAssetResponses.push({ status: response.status(), url });
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await engineReady;

  const bodyText = await page.locator('body').innerText();
  const allResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry): entry is PerformanceResourceTiming => entry.entryType === 'resource')
      .map((entry) => ({
        name: entry.name,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
      })),
  );

  // First-load payload budget (Phase 5 Task 4): same-origin startup JS bytes
  // fetched before any dataset upload. This is the stable byte guard that the
  // performance dashboard also applies; it catches a category regression such as
  // re-bundling the export-vendor chunk onto the cold-start path.
  const startupJsAssets = allResources.filter(
    (entry) =>
      new URL(entry.name).origin === appOrigin && entry.name.includes('/assets/') && entry.name.includes('.js'),
  );
  const startupJsTransferBytes = startupJsAssets.reduce((sum, entry) => sum + entry.transferSize, 0);

  const startupTiming = {
    workerReadyMs: Date.now() - startedAt,
    startupJsTransferBytes,
    startupJsTransferBudgetBytes: STARTUP_JS_TRANSFER_BUDGET_BYTES,
    startupJsAssets: startupJsAssets
      .map((entry) => ({ name: new URL(entry.name).pathname, transferSize: entry.transferSize }))
      .sort((a, b) => b.transferSize - a.transferSize),
    resources: allResources.filter((entry) => entry.name.includes('analysisWorker') || entry.name.includes('duckdb-')),
  };

  await testInfo.attach('production-startup-resources.json', {
    body: JSON.stringify(
      {
        ...startupTiming,
        workerAssetResponses,
        startupAssetResponses,
        consoleMessages,
        pageErrors,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  expect(pageErrors).toEqual([]);
  expect(consoleMessages.some((message) => message.includes('Worker runtime error'))).toBe(false);
  expect(bodyText).not.toContain('Worker runtime error');

  expect(workerAssetResponses.some((response) => response.url.includes('analysisWorker'))).toBe(true);
  expect(workerAssetResponses.some((response) => response.url.includes('duckdb-browser'))).toBe(true);
  expect(workerAssetResponses.some((response) => response.url.includes('.wasm'))).toBe(true);
  expect(workerAssetResponses.every((response) => response.status === 200)).toBe(true);
  expect(workerAssetResponses.every((response) => new URL(response.url).origin === appOrigin)).toBe(true);
  expect(startupAssetResponses.some((response) => response.url.includes('export-vendor'))).toBe(false);

  expect(startupJsAssets.length, 'startup should fetch main-thread JS assets').toBeGreaterThan(0);
  expect(
    startupJsTransferBytes,
    `startup JS ${formatBytes(startupJsTransferBytes)} exceeds first-load budget ${formatBytes(STARTUP_JS_TRANSFER_BUDGET_BYTES)}`,
  ).toBeLessThanOrEqual(STARTUP_JS_TRANSFER_BUDGET_BYTES);
});
