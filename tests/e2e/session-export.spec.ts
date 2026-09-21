import { test, expect } from '@playwright/test';
import path from 'path';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { VelocitySessionFile } from '../../src/core/session/sessionTypes';
import { openOverflowMenu, uploadSavAndReachDashboard } from './helpers/visualPolish';

const savFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test('session export and import preserve analysis and show unresolved slide references', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2500);

  await uploadSavAndReachDashboard(page, savFixture);

  await openOverflowMenu(page);
  await page.getByRole('menuitem', { name: 'Export Session' }).click();
  await expect(page.getByRole('button', { name: /Download \.velocity/i })).toBeVisible({ timeout: 10000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /Download \.velocity/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^sleep-\d{4}-\d{2}-\d{2}\.velocity(\.gz)?$/);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Session download is unavailable');
  const bytes = readFileSync(downloadPath);
  const json = download.suggestedFilename().endsWith('.gz') ? gunzipSync(bytes) : bytes;
  const session = JSON.parse(json.toString('utf8')) as VelocitySessionFile;
  session.slides[0].analysisState.rowVars.push('removed-question');

  await expect(page.getByRole('button', { name: 'Close export modal' })).toBeHidden();
  await openOverflowMenu(page);
  await page.getByRole('menuitem', { name: 'Import Session' }).click();
  const sessionChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select .velocity file' }).click();
  await (
    await sessionChooser
  ).setFiles({
    name: 'review.velocity',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(session)),
  });
  const savChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload .sav file' }).click();
  await (await savChooser).setFiles(savFixture);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const summary = page.getByTestId('session-import-summary');
  await expect(summary).toBeVisible({ timeout: 60000 });
  await expect(summary).toContainText('removed-question');
  await expect(summary).toContainText('Affects slides 1');
  await expect(page.getByTestId('story-rail')).toHaveAttribute('data-rail-expanded', 'true');
  await expect(page.locator('table')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss import summary' }).click();
  await expect(summary).toHaveCount(0);
});
