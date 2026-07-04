import { expect, test } from '@playwright/test';
import path from 'path';
import { buildExampleCrosstab, expectDatasetLoaded, uploadSavAndReachDashboard } from './helpers/visualPolish';

const sleepSavFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test('SAV upload exercises Arrow→DuckDB ingestion in a real browser', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));

  const engineReady = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for analysis engine')), 60000);
    page.on('console', (message) => {
      if (message.text().includes('[enginePersistenceBridge] Engine ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  const response = await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  await engineReady;

  const coopHeader = response?.headers()['cross-origin-opener-policy'];
  const coepHeader = response?.headers()['cross-origin-embedder-policy'];
  const crossOriginIsolated = await page.evaluate(() => self.crossOriginIsolated);

  await testInfo.attach('cross-origin-isolation.json', {
    body: JSON.stringify({ coopHeader, coepHeader, crossOriginIsolated }, null, 2),
    contentType: 'application/json',
  });

  // Production hosts should send COOP/COEP for the DuckDB coi (pthread) bundle.
  // Dev server may run the eh bundle without isolation; insertArrowTable still runs on that path.
  if (crossOriginIsolated) {
    expect(coopHeader).toBeTruthy();
    expect(coepHeader).toBeTruthy();
  }

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });

  await uploadSavAndReachDashboard(page, sleepSavFixture);

  // workerIngestion.ts insertArrowTable path: full SAV load must land rows in DuckDB.
  await expectDatasetLoaded(page, 'sleep.sav', { rowCount: 271 });

  await buildExampleCrosstab(page);

  await expect(page.getByText(/Couldn't run analysis|Binder Error|Arrow insertion failed/i)).toHaveCount(0);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });

  expect(pageErrors).toEqual([]);
  expect(consoleMessages.some((message) => message.includes('Worker runtime error'))).toBe(false);
  expect(consoleMessages.some((message) => message.includes('Arrow insertion failed'))).toBe(false);
});
