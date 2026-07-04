import { test, expect } from '@playwright/test';
import path from 'path';
import {
  dashboardReadyLocator,
  uploadSavAndReachDashboard,
  waitForRestorationPromptOrWorkspace,
} from './helpers/visualPolish';

const savFixture = path.resolve(process.cwd(), 'test_data/fixtures/test_small.sav');

test('OPFS persists dataset across reloads', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

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

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });

  await uploadSavAndReachDashboard(page, savFixture);

  // Hub-and-spoke mode transition should preserve loaded state.
  await page.keyboard.press('d');
  await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30000 });
  await page.keyboard.press('d');
  await expect(page.getByRole('heading', { name: 'Variables' })).toBeHidden({ timeout: 30000 });
  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 30000 });

  await page.reload();

  const restoreButton = page.getByRole('button', { name: 'Restore Session' });
  if (await restoreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await restoreButton.click();
  }

  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 120000 });
});

test('Start Fresh clears persisted session after reload', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.dismiss());

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

  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 60000 });

  await uploadSavAndReachDashboard(page, savFixture);

  await page.evaluate(() => {
    localStorage.removeItem('velocity-state');
  });

  await page.reload();

  await waitForRestorationPromptOrWorkspace(page);

  const startFreshButton = page.getByRole('button', { name: 'Start Fresh' });
  await expect(startFreshButton).toBeVisible({ timeout: 30000 });
  await startFreshButton.click();

  await expect(page.getByTestId('workspace-empty-state')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Restore Session' })).toBeHidden({ timeout: 5000 });

  await page.reload();

  await expect(page.getByTestId('workspace-empty-state')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Restore Session' })).toBeHidden({ timeout: 5000 });
});

test('Reload smoke: app boots after reload', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {
      // Best-effort browser storage cleanup.
    }

    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error - entries() returns an async iterator
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {
            // Ignore delete errors
          }
        }
      }
    } catch {
      // Ignore OPFS cleanup failures
    }
  });

  await page.reload();

  await expect(page.getByText(/^Velocity$/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/client SAV to editable deck/i)).toBeVisible({ timeout: 30000 });
});
