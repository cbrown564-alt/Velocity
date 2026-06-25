import { test, expect } from '@playwright/test';
import {
  VP_THEMES,
  applyTheme,
  assertOpfsSupported,
  buildGenderRegionCrosstab,
  crosstabTable,
  reachDashboardWithExample,
  waitForStableCrosstab,
} from './helpers/visualPolish';

test.describe('Visual polish — crosstab table theme regression', () => {
  test.beforeEach(async ({ page, context }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await context.addInitScript(() => {
      Object.defineProperty(window.matchMedia('(prefers-reduced-motion: reduce)'), 'matches', {
        get: () => true,
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('gender×region table matches baseline on all three themes', async ({ page }) => {
    await page.goto('/');
    test.skip(!(await assertOpfsSupported(page)), 'OPFS not supported in this environment');

    await reachDashboardWithExample(page);
    await buildGenderRegionCrosstab(page);
    await waitForStableCrosstab(page);

    for (const [slug, label] of VP_THEMES) {
      await applyTheme(page, label);
      await waitForStableCrosstab(page);

      const table = crosstabTable(page);
      await expect(table).toBeVisible();
      await expect(table).toHaveScreenshot(`crosstab-table-theme-${slug}.png`, {
        animations: 'disabled',
      });
    }
  });
});
