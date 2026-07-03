import { test, expect } from '@playwright/test';
import path from 'path';
import { clearBrowserStorage, uploadFileAndReachDashboard } from './helpers/visualPolish';

/**
 * Brand tracker workflow smoke (PILOT-DEMO-4 / Phase D).
 *
 * Loads the primary Load Example (brandtracker_w4.sav) and confirms the
 * funnel-relevant first crosstab (brand preference x attitudinal segment) is
 * applied automatically, per docs/workstreams/deck_native/10_brand_tracker_demo_plan.md §6.
 */
const brandTrackerFixture = path.resolve(process.cwd(), 'public/examples/brandtracker_w4.sav');

test('brand tracker workflow: load example, auto funnel-relevant first crosstab', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page, { seedActivation: true });
  await page.reload();

  await uploadFileAndReachDashboard(page, brandTrackerFixture);

  await expect(page.getByText(/brandtracker_w4\.sav \(1200 rows\)/)).toBeVisible({ timeout: 60000 });

  // The one-time auto-first-crosstab picks brand preference x segment for the
  // tracker file, so a computed table with a segment banner appears without any
  // manual variable selection.
  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 60000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 60000 });

  // The Growth attitudinal segment is one of the banner columns for the funnel cut
  // (rendered uppercase via CSS, so match case-insensitively).
  await expect(page.getByText(/growth/i).first()).toBeVisible({ timeout: 60000 });
});
