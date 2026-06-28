import { test, expect } from '@playwright/test';
import path from 'path';

const savFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test('Export Session completes and downloads a session file for sleep.sav', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2500);

  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 60000 });
  await fileInput.setInputFiles(savFixture);

  const surveyQuestions = page.getByText(/Survey Questions/i);
  const metadataLoaded = page.getByText('Metadata Loaded');

  await expect
    .poll(
      async () => {
        if (await surveyQuestions.isVisible().catch(() => false)) return 'dashboard';
        if (await metadataLoaded.isVisible().catch(() => false)) return 'metadata';
        return 'pending';
      },
      { timeout: 120000 },
    )
    .not.toBe('pending');

  if (await metadataLoaded.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Load Full Data' }).click();
    await expect(surveyQuestions).toBeVisible({ timeout: 120000 });
  }

  await page.getByTitle('Export portable session').click();
  await expect(page.getByRole('button', { name: /Download \.velocity/i })).toBeVisible({ timeout: 10000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /Download \.velocity/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^sleep-\d{4}-\d{2}-\d{2}\.velocity(\.gz)?$/);
});
