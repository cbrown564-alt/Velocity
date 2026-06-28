import { test, expect } from '@playwright/test';

/**
 * Phase 4 Task 2 — crosstab row virtualization, verified in a real browser.
 *
 * jsdom unit tests cover the flatten/window math and the windowed/non-windowed
 * DataTable branches, but they cannot exercise real layout, scrolling, or the
 * sticky header. This test uploads an in-memory CSV with a high-cardinality
 * `city` column (180 distinct values), builds a `city × region` crosstab so the
 * table has 180 rows (well above VIRTUALIZE_ROW_THRESHOLD = 100), and asserts:
 *
 *   - far fewer than 180 rows are actually in the DOM (windowed),
 *   - a spacer <tr> carries the off-screen rows' height,
 *   - scrolling shifts which rows are in the DOM (real scroll-driven windowing),
 *   - the sticky header and pinned Total row survive the scroll.
 */

const DISTINCT_CITIES = 180;
const REGIONS = ['North', 'South', 'East', 'West'];

/** Build a CSV whose `city` column has DISTINCT_CITIES values (3 rows each). */
function buildLargeCsv(): string {
  const lines = ['city,region,score'];
  for (let i = 0; i < DISTINCT_CITIES; i++) {
    const city = `City_${String(i).padStart(3, '0')}`;
    for (let j = 0; j < 3; j++) {
      const region = REGIONS[(i + j) % REGIONS.length];
      const score = (i * 7 + j * 13) % 100;
      lines.push(`${city},${region},${score}`);
    }
  }
  return lines.join('\n');
}

async function clearBrowserStorage(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {
      // best-effort
    }
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error entries() is an async iterator
        for await (const [name] of root.entries()) {
          await root.removeEntry(name, { recursive: true }).catch(() => {});
        }
      }
    } catch {
      // OPFS not guaranteed
    }
  });
}

test('crosstab rows virtualize for large tables (scroll-driven windowing)', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page);
  await page.reload();

  // Upload an in-memory CSV (no committed fixture needed) and reach the dashboard.
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 60000 });
  await fileInput.setInputFiles({
    name: 'large_table.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(buildLargeCsv(), 'utf8'),
  });

  // Build a city × region crosstab: first variable becomes rows, second columns.
  const cityBtn = page.getByRole('button', { name: /^city$/i }).first();
  await expect(cityBtn).toBeVisible({ timeout: 120000 });
  await cityBtn.click();
  await page.waitForTimeout(1000);

  const regionBtn = page.getByRole('button', { name: /^region$/i }).first();
  await expect(regionBtn).toBeVisible({ timeout: 10000 });
  await regionBtn.click();
  await page.waitForTimeout(2500);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });

  const scrollRegion = page.getByTestId('crosstab-scroll-region');
  await expect(scrollRegion).toBeVisible();

  const dataRows = page.locator('tbody tr.data-row-interactive');

  // Windowed: the DOM holds far fewer than the 180 logical rows.
  const renderedBefore = await dataRows.count();
  expect(renderedBefore).toBeGreaterThan(0);
  expect(renderedBefore).toBeLessThan(120);

  // A spacer row preserves the scroll height of the off-screen rows.
  expect(await page.locator('tbody tr[aria-hidden]').count()).toBeGreaterThan(0);

  // The pinned Total row is rendered.
  await expect(page.locator('.total-row-label')).toHaveText('Total');

  // The scroll container is genuinely taller than its viewport (rows exist below).
  const { scrollHeight, clientHeight } = await scrollRegion.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight + 100);

  // Capture the first rendered row label, then scroll down.
  const firstLabelBefore = (await dataRows.first().locator('td').first().textContent())?.trim();
  await scrollRegion.evaluate((el) => el.scrollTo({ top: Math.round(el.scrollHeight / 2) }));
  await page.waitForTimeout(400);

  // The window moved with the scroll: a different row is now first in the DOM.
  const firstLabelAfter = (await dataRows.first().locator('td').first().textContent())?.trim();
  expect(firstLabelAfter).toBeTruthy();
  expect(firstLabelAfter).not.toEqual(firstLabelBefore);

  // Sticky header and Total row survive the scroll.
  await expect(page.locator('thead th').first()).toBeVisible();
  await expect(page.locator('.total-row-label')).toHaveText('Total');
});
