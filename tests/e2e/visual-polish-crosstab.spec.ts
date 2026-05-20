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

  const restore = page.getByRole('button', { name: 'Restore Session' });
  if (await restore.isVisible({ timeout: 3000 }).catch(() => false)) {
    await restore.click();
    await expect(tableView).toBeVisible({ timeout: 120000 });
    return;
  }

  const loadExample = page.getByRole('button', { name: /Load Example/i });
  await expect(loadExample).toBeVisible({ timeout: 60000 });
  await loadExample.click();
  await expect(tableView).toBeVisible({ timeout: 120000 });
}

test('P1 crosstab render gate — gender x region with trust anchor', async ({ page }) => {
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

  if (await page.getByText('Ready for Analysis').isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: /gender Good starting point/i }).click();
    await page.waitForTimeout(1200);
  }

  const regionBtn = page.getByRole('button', { name: /^region$/i });
  if (await regionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await regionBtn.click();
    await page.waitForTimeout(2500);
  }

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);

  const pctCells = page.locator('text=/\\d+\\.\\d%/');
  await expect(pctCells.first()).toBeVisible({ timeout: 30000 });

  const nCells = page.locator('text=/n=\\d+/');
  await expect(nCells.first()).toBeVisible({ timeout: 30000 });

  const frame = page.locator('.analysis-frame').filter({ has: table });
  await expect(frame).toBeVisible();

  await expect(page.getByTestId('story-shelf-suggestion')).toBeVisible({ timeout: 8000 });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /hooks|DataTable/i.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(500);
  expect(consoleErrors).toEqual([]);
});
