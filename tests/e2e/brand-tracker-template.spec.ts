import { test, expect } from '@playwright/test';
import { clearBrowserStorage, expectDatasetLoaded, waitForDashboardReady } from './helpers/visualPolish';

/**
 * DESIGN-CONV-E: "Start from template" → 3-slide brand tracker funnel skeleton.
 */
test('start from template: 3-slide awareness/consideration/preference skeleton', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page);
  await page.reload();

  const startFresh = page.getByRole('button', { name: 'Start Fresh' });
  if (await startFresh.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startFresh.click();
  }

  await expect(page.getByTestId('workspace-start-template')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('workspace-start-template').click();

  await waitForDashboardReady(page, 120000);
  await expectDatasetLoaded(page, 'brandtracker_w4.sav', { rowCount: 1200 });

  await expect(page.getByTestId('story-rail-slide-1')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('story-rail-slide-2')).toBeVisible();
  await expect(page.getByTestId('story-rail-slide-3')).toBeVisible();
  await expect(page.getByTestId('story-rail-slide-1')).toContainText(/Awareness/i);
  await expect(page.getByTestId('story-rail-slide-2')).toContainText(/Consideration/i);
  await expect(page.getByTestId('story-rail-slide-3')).toContainText(/Preference/i);
  await expect(page.getByTestId('story-rail-slide-4')).toHaveCount(0);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 60000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
});
