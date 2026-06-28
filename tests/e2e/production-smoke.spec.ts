import { expect, test } from '@playwright/test';

test('production build initializes the analysis worker and DuckDB assets', async ({ page, baseURL }, testInfo) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const workerAssetResponses: Array<{ status: number; url: string }> = [];
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
    if (url.includes('analysisWorker') || url.includes('duckdb-')) {
      workerAssetResponses.push({ status: response.status(), url });
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await engineReady;

  const bodyText = await page.locator('body').innerText();
  const startupTiming = {
    workerReadyMs: Date.now() - startedAt,
    resources: await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => ({
          name: entry.name,
          duration: Math.round(entry.duration),
          transferSize: 'transferSize' in entry ? (entry as PerformanceResourceTiming).transferSize : null,
        }))
        .filter((entry) => entry.name.includes('analysisWorker') || entry.name.includes('duckdb-')),
    ),
  };

  await testInfo.attach('production-startup-resources.json', {
    body: JSON.stringify(
      {
        ...startupTiming,
        workerAssetResponses,
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
});
