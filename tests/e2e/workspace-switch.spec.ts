import { test, expect } from '@playwright/test';
import path from 'path';

const smallSavFixture = path.resolve(process.cwd(), 'test_data/fixtures/test_small.sav');
const sleepSavFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

async function uploadSavAndReachDashboard(page: import('@playwright/test').Page, fixturePath: string) {
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 60000 });
  await fileInput.setInputFiles(fixturePath);

  const surveyQuestions = page.getByText(/Survey Questions/);
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
}

async function returnToWorkspace(page: import('@playwright/test').Page) {
  const homeButton = page.locator('button[title="Return to Workspace"]');
  await expect(homeButton).toBeVisible({ timeout: 30000 });
  await homeButton.click();
  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 30000 });
}

async function openDatasetFromWorkspace(page: import('@playwright/test').Page, fileName: string) {
  await page.getByRole('button', { name: 'All Datasets' }).click();
  await page.getByPlaceholder('Search datasets...').fill(fileName);
  await page.getByRole('heading', { name: fileName }).dblclick();
  await expect(page.getByText(/Survey Questions/)).toBeVisible({ timeout: 120000 });
}

/** Assert DuckDB schema matches UI variables after a workspace dataset switch. */
async function expectCrosstabRenders(page: import('@playwright/test').Page, rowVar: RegExp, colVar: RegExp) {
  await page.getByRole('button', { name: rowVar }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: colVar }).first().click();
  await page.waitForTimeout(3000);

  await expect(page.getByText(/Couldn't run analysis|Binder Error/i)).toHaveCount(0);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=/n=\\d+/').first()).toBeVisible({ timeout: 30000 });
}

test('workspace switches between stored datasets without re-upload', async ({ page }) => {
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

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });

  await uploadSavAndReachDashboard(page, sleepSavFixture);
  await expect(page.getByText('sleep.sav (271 rows)')).toBeVisible({ timeout: 30000 });
  await returnToWorkspace(page);

  await uploadSavAndReachDashboard(page, smallSavFixture);
  await returnToWorkspace(page);

  await expect(page.getByText('sleep.sav')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('test_small.sav')).toBeVisible({ timeout: 30000 });
  await expect
    .poll(
      async () => {
        return page.evaluate(async () => {
          const raw = localStorage.getItem('velocity-state');
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          const datasets = parsed?.state?.workspace?.datasets ?? [];
          const sleep = datasets.find((entry: any) => entry.fileName === 'sleep.sav');
          if (!sleep?.opfsFileKey) return false;

          const root = await navigator.storage.getDirectory();
          const uploaded = await root.getDirectoryHandle('uploaded_sav');
          await uploaded.getFileHandle(sleep.opfsFileKey);
          return true;
        });
      },
      { timeout: 30000 },
    )
    .toBe(true);

  await openDatasetFromWorkspace(page, 'sleep.sav');
  await expect(page.getByText('sleep.sav (271 rows)')).toBeVisible({ timeout: 30000 });

  // Regression: DuckDB must reload sleep.sav schema after switching away and back.
  await expectCrosstabRenders(page, /^sex$/i, /^marital status$/i);
});
