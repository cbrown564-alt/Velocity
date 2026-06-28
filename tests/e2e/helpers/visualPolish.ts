import { expect, type Page } from '@playwright/test';

export const VP_THEMES = [
  ['sm', 'Soft Machine'],
  ['mc', 'Mission Control'],
  ['lg', 'Liquid Glass'],
] as const;

export type ThemeSlug = (typeof VP_THEMES)[number][0];

export async function clearBrowserStorage(page: Page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {}
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error - entries() returns an async iterator
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {}
        }
      }
    } catch {}
  });
}

export async function reachDashboardWithExample(page: Page) {
  await clearBrowserStorage(page);
  await page.reload();

  const tableView = page.getByRole('button', { name: 'Table view' });
  if (await tableView.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  const restore = page.getByRole('button', { name: 'Restore Session' });
  if (await restore.isVisible({ timeout: 3000 }).catch(() => false)) {
    await restore.click();
    await expect(tableView).toBeVisible({ timeout: 120000 });
    return;
  }

  const loadExample = page.getByRole('button', { name: /Load Example/i });
  await expect(loadExample).toBeVisible({ timeout: 60000 });
  await loadExample.click();
  await expect(tableView).toBeVisible({ timeout: 120000 });
}

export async function ensureCorrectionNone(page: Page) {
  const correct = page
    .locator('select')
    .filter({ has: page.locator('option[value="none"]') })
    .first();
  if (await correct.isVisible({ timeout: 2000 }).catch(() => false)) {
    await correct.selectOption('none');
    await page.waitForTimeout(2500);
  }
}

export async function buildGenderRegionCrosstab(page: Page) {
  const reset = page.getByRole('button', { name: 'Reset' });
  if (await reset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reset.click();
    await page.waitForTimeout(600);
  }

  if (
    await page
      .getByText('Ready for Analysis')
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await page
      .getByRole('button', { name: /product sat Good starting point/i })
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
    await page
      .getByRole('button', { name: 'Reset' })
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
  }

  await page
    .getByRole('button', { name: /^gender$/i })
    .first()
    .click();
  await page.waitForTimeout(1200);

  const regionBtn = page.getByRole('button', { name: /^region$/i });
  await expect(regionBtn).toBeVisible({ timeout: 5000 });
  await regionBtn.click();
  await page.waitForTimeout(2500);

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });
}

export async function waitForStableCrosstab(page: Page) {
  await ensureCorrectionNone(page);

  const storyShelf = page.getByTestId('story-shelf-suggestion');
  if (await storyShelf.isVisible({ timeout: 8000 }).catch(() => false)) {
    await expect(storyShelf).toBeHidden({ timeout: 12000 });
  }

  const footer = page.locator('.analysis-frame .statistics-status-bar').first();
  await expect(footer).toBeVisible({ timeout: 15000 });

  await page.waitForTimeout(400);
}

export async function applyTheme(page: Page, label: string) {
  const themeList = page.locator('[role="listbox"][aria-label="Theme selection"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page
    .getByRole('button', { name: /Change theme/i })
    .first()
    .click({ force: true });
  await themeList.waitFor({ timeout: 5000 });
  await themeList.getByText(label, { exact: true }).click({ force: true });
  await page.waitForTimeout(900);
}

export function crosstabTable(page: Page) {
  return page.locator('.analysis-frame table').first();
}

export async function assertOpfsSupported(page: Page) {
  return page.evaluate(async () => {
    try {
      if (!(self as unknown as { isSecureContext?: boolean }).isSecureContext) return false;
      if (!navigator.storage?.getDirectory) return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });
}
