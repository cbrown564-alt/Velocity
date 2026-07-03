import { test, expect } from '@playwright/test';
import {
  assertOpfsSupported,
  buildExampleCrosstab,
  crosstabTable,
  reachDashboardWithSleepExample,
  waitForStableCrosstab,
} from './helpers/visualPolish';

test.describe('Visual polish — crosstab table regression', () => {
  test.beforeEach(async ({ page, context }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await context.addInitScript(() => {
      Object.defineProperty(window.matchMedia('(prefers-reduced-motion: reduce)'), 'matches', {
        get: () => true,
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('sex×marital status table matches baseline', async ({ page }) => {
    await page.goto('/');
    test.skip(!(await assertOpfsSupported(page)), 'OPFS not supported in this environment');

    await reachDashboardWithSleepExample(page);
    await buildExampleCrosstab(page);
    await waitForStableCrosstab(page);

    const table = crosstabTable(page);
    await expect(table).toBeVisible();
    await expect(table).toHaveScreenshot('crosstab-table-velocity.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.05,
    });
  });
});
