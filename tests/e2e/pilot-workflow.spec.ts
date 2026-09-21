import { test, expect } from '@playwright/test';
import {
  buildExampleCrosstab,
  expectDatasetLoaded,
  openDatasetFromWorkspaceSearch,
  uploadSavAndReachDashboard,
} from './helpers/visualPolish';
import path from 'path';

const sleepSavFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test('pilot workflow: upload, crosstab, export PPTX, reopen, event log', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  const opfsSupported = await page.evaluate(async () => {
    try {
      if (!(self as any).isSecureContext) return false;
      if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });

  test.skip(!opfsSupported, 'OPFS not supported in this environment');

  await expect(page.getByText(/Turn a client survey file into an editable PowerPoint deck/i)).toBeVisible({
    timeout: 60000,
  });

  await uploadSavAndReachDashboard(page, sleepSavFixture);
  await expectDatasetLoaded(page, 'sleep.sav', { rowCount: 271 });

  await buildExampleCrosstab(page);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('export-modal-review')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('export-modal-review').click();
  await expect(page.getByTestId('export-preview-lane')).toBeVisible({ timeout: 10000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.getByTestId('export-modal-submit').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pptx$/);

  const homeButton = page.locator('button[title="Return to Workspace"]');
  await expect(homeButton).toBeVisible({ timeout: 30000 });
  await homeButton.click();
  await expect(page.getByTestId('pilot-event-log-download')).toBeVisible({ timeout: 30000 });

  const eventNames = await page.evaluate(() => {
    const raw = localStorage.getItem('velocity-pilot-events');
    if (!raw) return [];
    const events = JSON.parse(raw) as Array<{ name: string }>;
    return events.map((e) => e.name);
  });

  expect(eventNames).toContain('file_selected');
  expect(eventNames).toContain('canvas_ready');
  expect(eventNames).toContain('first_crosstab');
  expect(eventNames).toContain('pptx_exported');

  await openDatasetFromWorkspaceSearch(page, 'sleep.sav');
  await expectDatasetLoaded(page, 'sleep.sav', { rowCount: 271, timeoutMs: 120000 });

  const afterReopen = await page.evaluate(() => {
    const raw = localStorage.getItem('velocity-pilot-events');
    if (!raw) return [];
    const events = JSON.parse(raw) as Array<{ name: string }>;
    return events.map((e) => e.name);
  });
  expect(afterReopen).toContain('workspace_reopened');
});
