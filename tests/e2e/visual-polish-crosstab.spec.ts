import { test, expect } from '@playwright/test';
import { assertOpfsSupported, buildExampleCrosstab, reachDashboardWithExample } from './helpers/visualPolish';

test('P1 crosstab render gate — sex x marital status with trust anchor', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  test.skip(!(await assertOpfsSupported(page)), 'OPFS not supported in this environment');

  await reachDashboardWithExample(page);
  await buildExampleCrosstab(page);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);

  const pctCells = page.locator('text=/\\d+\\.\\d%/');
  await expect(pctCells.first()).toBeVisible({ timeout: 30000 });

  const frame = page.locator('.analysis-frame').filter({ has: table });
  await expect(frame).toBeVisible();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /hooks|DataTable/i.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(500);
  expect(consoleErrors).toEqual([]);
});
