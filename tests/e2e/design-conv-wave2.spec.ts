import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SLEEP_SAV_FIXTURE, waitForDashboardReady } from './helpers/visualPolish';

test('upload handoff, palette dismissal, recent pins and keyboard rail expansion', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dataset-upload-input').setInputFiles({
    name: 'client-survey.sav',
    mimeType: 'application/octet-stream',
    buffer: readFileSync(SLEEP_SAV_FIXTURE),
  });
  await waitForDashboardReady(page);
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(page.getByTestId('palette-onboarding-ghost')).toBeVisible();
  await page.getByRole('textbox', { name: 'Find a variable' }).fill('sex');
  await page.keyboard.press('Alt+Enter');
  await expect(palette).toHaveCount(0);
  await expect(page.getByTestId('recent-variable-strip')).toBeVisible();
  const pin = page.getByRole('button', { name: /^Pin / }).first();
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Unpin / }).first()).toBeVisible();

  const expand = page.getByRole('button', { name: 'Expand deck outline' });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('story-rail')).toHaveAttribute('data-rail-expanded', 'true');
  await page.getByRole('button', { name: 'Insert ⌘K', exact: true }).click();
  await expect(palette).toBeVisible();
  await expect(page.getByTestId('palette-onboarding-ghost')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: '/tmp/velocity-wave2-canvas.png', fullPage: true });
});
