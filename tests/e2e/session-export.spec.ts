import { test, expect } from '@playwright/test';
import path from 'path';
import { uploadSavAndReachDashboard } from './helpers/visualPolish';

const savFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test('Export Session completes and downloads a session file for sleep.sav', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2500);

  await uploadSavAndReachDashboard(page, savFixture);

  await page.getByTitle('Export portable session').click();
  await expect(page.getByRole('button', { name: /Download \.velocity/i })).toBeVisible({ timeout: 10000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /Download \.velocity/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^sleep-\d{4}-\d{2}-\d{2}\.velocity(\.gz)?$/);
});
