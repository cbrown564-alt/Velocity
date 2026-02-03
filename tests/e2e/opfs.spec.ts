import { test, expect } from '@playwright/test';
import path from 'path';

const savFixture = path.resolve(process.cwd(), 'test_small.sav');

test('OPFS persists dataset across reloads', async ({ page }) => {
  await page.goto('/');

  const opfsSupported = await page.evaluate(async () => {
    try {
      if (!(self as any).isSecureContext) return false;
      if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });

  test.skip(!opfsSupported, 'OPFS not supported in this environment');

  await page.setInputFiles('input[type="file"]', savFixture);

  await expect(page.getByText('Survey Questions')).toBeVisible({ timeout: 120000 });

  await page.reload();

  const restoreButton = page.getByRole('button', { name: 'Restore Session' });
  if (await restoreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await restoreButton.click();
  }

  await expect(page.getByText('Survey Questions')).toBeVisible({ timeout: 120000 });
});
