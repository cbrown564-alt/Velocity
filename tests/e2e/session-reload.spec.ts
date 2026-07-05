import { test, expect } from '@playwright/test';
import {
  buildExampleCrosstab,
  ensureWorkspaceLibraryAfterReload,
  expectWorkspaceLibraryVisible,
  reachDashboardWithExample,
  waitForWorkspaceModePersisted,
} from './helpers/visualPolish';

test('reload restores dashboard without workspace overlay blocking controls', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  const opfsSupported = await page.evaluate(async () => {
    try {
      if (!(self as unknown as { isSecureContext?: boolean }).isSecureContext) return false;
      if (!navigator.storage?.getDirectory) return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });
  test.skip(!opfsSupported, 'OPFS not supported in this environment');

  await reachDashboardWithExample(page);
  await buildExampleCrosstab(page);

  await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Search datasets/i)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Table view' })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Search datasets/i)).toHaveCount(0);

  const tableView = page.getByRole('button', { name: 'Table view' });
  await tableView.click();
  await expect(tableView).toHaveAttribute('aria-pressed', 'true');

  await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
});

test('reload keeps workspace when user returned before refresh', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  const opfsSupported = await page.evaluate(async () => {
    try {
      if (!(self as unknown as { isSecureContext?: boolean }).isSecureContext) return false;
      if (!navigator.storage?.getDirectory) return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });
  test.skip(!opfsSupported, 'OPFS not supported in this environment');

  await reachDashboardWithExample(page);
  await buildExampleCrosstab(page);

  await page.locator('button[title="Return to Workspace"]').click();
  await expectWorkspaceLibraryVisible(page);
  await waitForWorkspaceModePersisted(page);

  await page.reload();
  await ensureWorkspaceLibraryAfterReload(page);
});
