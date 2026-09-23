import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  buildExampleCrosstab,
  clearBrowserStorage,
  openDatasetFromWorkspaceSearch,
  uploadFileAndReachDashboard,
  waitForAnalysisIdle,
} from './helpers/visualPolish';

const evidenceDir = path.resolve(process.cwd(), 'docs/assets/researcher-journey/screenshots');
const capture = process.env.CAPTURE_JOURNEY === '1';

async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`) });
}

test('brand tracker: inspect, recover search, switch view, reopen the saved result and initiate export', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page, { seedActivation: true });
  await page.reload();
  await shot(page, '01-first-use-1440');

  await uploadFileAndReachDashboard(page, path.resolve('public/examples/brandtracker_w4.sav'));
  await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
  await waitForAnalysisIdle(page);
  await expect(page.locator('table').getByText('Growth', { exact: false }).first()).toBeVisible();
  const originalTable = await page.locator('table').innerText();
  await shot(page, '02-brand-table-1440');

  await page.getByRole('button', { name: 'Insert ⌘K', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Find a variable' });
  await search.fill('no-such-question-zz');
  await expect(page.getByText('No matching variables.')).toBeVisible();
  await shot(page, '03-search-empty-1440');
  await search.fill('brand');
  await expect(page.getByTestId('palette-selection-detail')).toContainText('Selected question');
  await expect(page.getByTestId('palette-selection-detail')).toContainText('Add to columns');
  await shot(page, '04-brand-selection-1440');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Chart view' }).click();
  await shot(page, '05-brand-chart-1440');
  await page.getByRole('button', { name: 'Table view' }).click();
  await expect(page.locator('table')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('desktop-recommendation-banner')).toHaveCount(0);
  await shot(page, '05a-brand-table-1280');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('recipe-inspector-toggle').click();
  await expect(page.getByText('Applied').first()).toBeVisible();
  await shot(page, '06-brand-recipe-1440');

  await page.locator('button[title="Return to Workspace"]').click();
  await shot(page, '07-workspace-reopen-1440');
  await openDatasetFromWorkspaceSearch(page, 'brandtracker_w4.sav');
  await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
  await waitForAnalysisIdle(page);
  await expect.poll(async () => page.locator('table').innerText(), { timeout: 60000 }).toBe(originalTable);
  await shot(page, '08-brand-reopened-1440');
  await page.getByTestId('recipe-inspector-toggle').click();
  await expect(page.getByText('Applied').first()).toBeVisible();

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('export-modal-review')).toBeVisible();
  await shot(page, '09-export-review-1440');
  await page.getByTestId('export-modal-review').click();
  await expect(page.getByTestId('export-preview-lane')).toBeVisible();
  await shot(page, '10-export-preview-1440');
});

test('second dataset: empty and populated table and chart at a narrower desktop viewport', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());
  await clearBrowserStorage(page, { seedActivation: true });
  await page.reload();
  await shot(page, '11-first-use-1024');
  await uploadFileAndReachDashboard(page, path.resolve('test_data/sleep.sav'));
  await buildExampleCrosstab(page);
  await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
  await shot(page, '12-sleep-table-1024');
  await page.getByRole('button', { name: 'Chart view' }).click();
  await shot(page, '13-sleep-chart-1024');
  await page.getByRole('button', { name: 'Table view' }).click();
  await page.getByRole('button', { name: '+ New slide', exact: true }).click();
  await expect(page.getByTestId('empty-slide-state')).toBeVisible();
  await shot(page, '14-empty-slide-1024');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('radio', { name: /All Slides \(2\)/ })).toBeVisible();
  await page.getByText('All Slides (2)', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /All Slides \(2\)/ })).toBeChecked();
  await expect(page.getByTestId('export-review-list')).toContainText(
    'New Slide: add at least one row variable before export.',
  );
  await page.getByTestId('export-review-list').scrollIntoViewIfNeeded();
  await shot(page, '15-two-slide-export-1024');
});
