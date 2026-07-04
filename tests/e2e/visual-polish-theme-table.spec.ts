import { test, expect } from '@playwright/test';
import {
  assertOpfsSupported,
  buildExampleCrosstab,
  crosstabTable,
  reachDashboardWithSleepExample,
  waitForStableCrosstab,
} from './helpers/visualPolish';

test.describe('Visual polish — crosstab table regression', { tag: '@visual' }, () => {
  test.beforeEach(async ({ page, context }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await context.addInitScript(() => {
      Object.defineProperty(window.matchMedia('(prefers-reduced-motion: reduce)'), 'matches', {
        get: () => true,
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('sex×marital status table renders with computed percentages', async ({ page }) => {
    await page.goto('/');
    test.skip(!(await assertOpfsSupported(page)), 'OPFS not supported in this environment');

    await reachDashboardWithSleepExample(page);
    await buildExampleCrosstab(page);
    await waitForStableCrosstab(page);

    const table = crosstabTable(page);
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).not.toHaveCount(0);

    const pctCells = table.locator('text=/\\d+\\.\\d%/');
    await expect(pctCells.first()).toBeVisible({ timeout: 30000 });
    expect(await pctCells.count()).toBeGreaterThan(3);

    await expect(table.getByText(/sex|marital/i).first()).toBeVisible();
  });
});
