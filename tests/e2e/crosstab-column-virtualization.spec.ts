import { test, expect } from '@playwright/test';
import { clearBrowserStorage, insertVariableFromPalette, uploadFileAndReachDashboard } from './helpers/visualPolish';

/**
 * Phase 4 Task 3 — crosstab column (horizontal) virtualization, verified in a
 * real browser.
 *
 * jsdom unit tests cover the window math and the windowed/non-windowed DataTable
 * branches, but they cannot exercise real layout, horizontal scrolling, or the
 * fixed-width column track. This test uploads an in-memory CSV with a small
 * `region` row variable and a high-cardinality `wave` column variable (60
 * distinct values), builds a `region × wave` crosstab so the banner has 60
 * columns (well above VIRTUALIZE_COL_THRESHOLD = 30), and asserts:
 *
 *   - far fewer than 60 column headers are actually in the DOM (windowed),
 *   - a spacer <th> carries the off-screen columns' width,
 *   - the table is genuinely wider than its viewport (horizontal scroll),
 *   - scrolling right shifts which column is first in the DOM (real
 *     scroll-driven horizontal windowing),
 *   - the row-label header and the trailing Total header survive the scroll.
 */

const DISTINCT_WAVES = 60;
const REGIONS = ['North', 'South', 'East', 'West'];

/** Build a CSV whose `wave` column has DISTINCT_WAVES values (a wide banner). */
function buildWideCsv(): string {
  const lines = ['region,wave,score'];
  for (let w = 0; w < DISTINCT_WAVES; w++) {
    const wave = `Wave_${String(w).padStart(2, '0')}`;
    for (let r = 0; r < REGIONS.length; r++) {
      // A few rows per (region, wave) cell so every column is populated.
      for (let k = 0; k < 2; k++) {
        const score = (w * 7 + r * 13 + k) % 100;
        lines.push(`${REGIONS[r]},${wave},${score}`);
      }
    }
  }
  return lines.join('\n');
}

test('crosstab columns virtualize for wide banners (scroll-driven windowing)', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page, { seedActivation: true });
  await page.reload();

  await uploadFileAndReachDashboard(page, {
    name: 'wide_banner.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(buildWideCsv(), 'utf8'),
  });

  // Build a region × wave crosstab via insert palette (resident sidebar removed).
  await insertVariableFromPalette(page, 'region', 'rows');
  await insertVariableFromPalette(page, 'wave', 'columns');

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });

  const scrollRegion = page.getByTestId('crosstab-scroll-region');
  await expect(scrollRegion).toBeVisible();

  const colHeaders = page.locator('thead th[data-merge-axis="column"]');

  // Windowed: the DOM holds far fewer than the 60 logical columns.
  const renderedBefore = await colHeaders.count();
  expect(renderedBefore).toBeGreaterThan(0);
  expect(renderedBefore).toBeLessThan(40);

  // A spacer header preserves the scroll width of the off-screen columns.
  expect(await page.locator('thead th[aria-hidden]').count()).toBeGreaterThan(0);

  // The trailing Total header is rendered (never windowed).
  await expect(page.locator('thead th', { hasText: /^Total$/ }).first()).toBeVisible();

  // The scroll container is genuinely wider than its viewport (columns exist to the right).
  const { scrollWidth, clientWidth } = await scrollRegion.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth + 100);

  // Capture the first rendered column label, then scroll right.
  const firstColBefore = await colHeaders.first().getAttribute('data-merge-label');
  await scrollRegion.evaluate((el) => el.scrollTo({ left: Math.round(el.scrollWidth / 2) }));
  await page.waitForTimeout(400);

  // The window moved with the scroll: a different column is now first in the DOM.
  const firstColAfter = await colHeaders.first().getAttribute('data-merge-label');
  expect(firstColAfter).toBeTruthy();
  expect(firstColAfter).not.toEqual(firstColBefore);

  // Row-label header and Total header survive the horizontal scroll.
  await expect(page.locator('thead th').first()).toBeVisible();
  await expect(page.locator('thead th', { hasText: /^Total$/ }).first()).toBeVisible();
});
