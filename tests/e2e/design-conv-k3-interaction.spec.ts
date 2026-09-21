import { expect, test } from '@playwright/test';
import {
  SLEEP_SAV_FIXTURE,
  clearBrowserStorage,
  openOverflowMenu,
  uploadSavAndReachDashboard,
} from './helpers/visualPolish';

/**
 * DESIGN-CONV-K3 — overflow hit-testing and supported widths without force-click.
 */
test.describe('DESIGN-CONV-K3 interaction closure', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserStorage(page, { seedActivation: true });
  });

  for (const width of [1440, 1280, 1024] as const) {
    test(`overflow menu opens with normal clicks at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await uploadSavAndReachDashboard(page, SLEEP_SAV_FIXTURE);

      await openOverflowMenu(page);
      await expect(page.getByTestId('toolbar-overflow-menu')).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Variable Manager' })).toBeVisible();

      // Normal pointer click — no { force: true }.
      await page.getByRole('menuitem', { name: 'Variable Manager' }).click();
      await expect(page.getByTestId('toolbar-overflow-menu')).toHaveCount(0);
    });
  }
});
