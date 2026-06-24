import { test, expect } from '@playwright/test';

async function clearBrowserStorage(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {}
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {}
        }
      }
    } catch {}
  });
}

async function reachDashboardWithExample(page: import('@playwright/test').Page) {
  await clearBrowserStorage(page);
  await page.reload();

  const tableView = page.getByRole('button', { name: 'Table view' });
  if (await tableView.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  const loadExample = page.getByRole('button', { name: /Load Example/i });
  await expect(loadExample).toBeVisible({ timeout: 60000 });
  await loadExample.click();
  await expect(tableView).toBeVisible({ timeout: 120000 });
}

async function buildGenderRegionCrosstab(page: import('@playwright/test').Page) {
  if (await page.getByText('Ready for Analysis').isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: /product sat Good starting point/i }).click().catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Reset' }).click().catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.getByRole('button', { name: /^gender$/i }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^region$/i }).first().click();
  await page.waitForTimeout(2500);
}

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
  await buildGenderRegionCrosstab(page);

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
  await buildGenderRegionCrosstab(page);

  await page.locator('button[title="Return to Workspace"]').click();
  await expect(page.getByText(/Recent Datasets|Welcome to Velocity/i)).toBeVisible({ timeout: 30000 });

  await page.reload();
  await expect(page.getByText(/Recent Datasets|Welcome to Velocity/i)).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Table view' })).toHaveCount(0);
});
