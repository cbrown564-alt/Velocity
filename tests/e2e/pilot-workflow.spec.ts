import { test, expect } from '@playwright/test';
import path from 'path';

const sleepSavFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

async function uploadSavAndReachDashboard(page: import('@playwright/test').Page) {
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 60000 });
  await fileInput.setInputFiles(sleepSavFixture);

  const surveyQuestions = page.getByText(/Survey Questions/);
  const metadataLoaded = page.getByText('Metadata Loaded');

  await expect.poll(async () => {
    if (await surveyQuestions.isVisible().catch(() => false)) return 'dashboard';
    if (await metadataLoaded.isVisible().catch(() => false)) return 'metadata';
    return 'pending';
  }, { timeout: 120000 }).not.toBe('pending');

  if (await metadataLoaded.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Load Full Data' }).click();
    await expect(surveyQuestions).toBeVisible({ timeout: 120000 });
  }
}

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

  await expect(page.getByTestId('pilot-environment-banner')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/never leaves this device/i)).toBeVisible();

  await uploadSavAndReachDashboard(page);
  await expect(page.getByText('sleep.sav (271 rows)')).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: /^sex$/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /marital status/i }).first().click();
  await page.waitForTimeout(3000);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('export-modal-submit')).toBeVisible({ timeout: 10000 });

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

  await page.getByRole('button', { name: 'All Datasets' }).click();
  await page.getByPlaceholder('Search datasets...').fill('sleep.sav');
  await page.getByRole('heading', { name: 'sleep.sav' }).dblclick();
  await expect(page.getByText('sleep.sav (271 rows)')).toBeVisible({ timeout: 120000 });

  const afterReopen = await page.evaluate(() => {
    const raw = localStorage.getItem('velocity-pilot-events');
    if (!raw) return [];
    const events = JSON.parse(raw) as Array<{ name: string }>;
    return events.map((e) => e.name);
  });
  expect(afterReopen).toContain('workspace_reopened');
});
