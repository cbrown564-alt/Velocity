import { expect, type Page } from '@playwright/test';

export const VP_THEMES = [
  ['sm', 'Soft Machine'],
  ['mc', 'Mission Control'],
  ['lg', 'Liquid Glass'],
] as const;

export type ThemeSlug = (typeof VP_THEMES)[number][0];

export async function clearBrowserStorage(
  page: Page,
  options?: {
    /** Skip Workshop Door first-run UI for upload-only specs. */
    seedActivation?: boolean;
  },
) {
  await page.evaluate(async (seedActivation) => {
    try {
      localStorage.clear();
    } catch {
      // Best-effort browser storage cleanup.
    }
    try {
      if (seedActivation) {
        localStorage.setItem(
          'velocity-pilot-events',
          JSON.stringify([
            {
              id: 'e2e-seed-file-selected',
              name: 'file_selected',
              at: new Date().toISOString(),
              elapsedMs: 0,
            },
          ]),
        );
      }
      localStorage.setItem('velocity-first-crosstab-tour-done', '1');
      localStorage.setItem('velocity-first-crosstab-tour-step-rows', '1');
      localStorage.setItem('velocity-first-crosstab-tour-step-columns', '1');
      localStorage.setItem('velocity-first-crosstab-tour-step-significance', '1');
      localStorage.setItem('velocity-focus-tip-seen', '1');
      localStorage.setItem('velocity-micro-tip-dismissed-focus', '1');
      localStorage.setItem('velocity-micro-tip-dismissed-export', '1');
      localStorage.setItem('velocity-micro-tip-dismissed-variable-manager', '1');
    } catch {
      // Best-effort onboarding flag seeding for stable e2e.
    }
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error - entries() returns an async iterator
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {
            // Ignore entries that are removed between listing and deletion.
          }
        }
      }
    } catch {
      // OPFS is not guaranteed in every browser used by this suite.
    }
  }, options?.seedActivation ?? false);
}

export async function uploadFileAndReachDashboard(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 120000 });
  await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeVisible({ timeout: 120000 });

  await fileInput.setInputFiles(file);

  const surveyQuestions = page.getByText(/Survey Questions/);
  const metadataLoaded = page.getByText('Metadata Loaded');

  await expect
    .poll(
      async () => {
        if (await surveyQuestions.isVisible().catch(() => false)) return 'dashboard';
        if (await metadataLoaded.isVisible().catch(() => false)) return 'metadata';
        return 'pending';
      },
      { timeout: 180000 },
    )
    .not.toBe('pending');

  if (await metadataLoaded.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Load Full Data' }).click();
    await expect(surveyQuestions).toBeVisible({ timeout: 120000 });
  }
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

  const loadExample = page.getByRole('button', {
    name: /walk through sleep study example|try sleep study example|load example/i,
  });
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

/** Build or confirm the sleep.sav example crosstab (sex × marital status). */
export async function buildExampleCrosstab(page: Page) {
  const table = page.locator('table');
  const pctCell = page.locator('text=/\\d+\\.\\d%/').first();
  if (
    (await table.isVisible({ timeout: 5000 }).catch(() => false)) &&
    (await pctCell.isVisible({ timeout: 5000 }).catch(() => false))
  ) {
    return;
  }

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
      .getByRole('button', { name: 'Reset' })
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
  }

  if (
    (await table.isVisible({ timeout: 2000 }).catch(() => false)) &&
    (await pctCell.isVisible({ timeout: 2000 }).catch(() => false))
  ) {
    return;
  }

  const sexBtn = page.getByRole('button', { name: /^sex$/i }).first();
  await expect(sexBtn).toBeVisible({ timeout: 30000 });
  await sexBtn.click();
  await page.waitForTimeout(1200);

  const maritalBtn = page.getByRole('button', { name: /marital status/i });
  await expect(maritalBtn).toBeVisible({ timeout: 10000 });
  await maritalBtn.click();
  await page.waitForTimeout(2500);

  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(pctCell).toBeVisible({ timeout: 30000 });
}

/** @deprecated Use buildExampleCrosstab — sleep.sav replaced mock_data.csv in e2e. */
export const buildGenderRegionCrosstab = buildExampleCrosstab;

export async function waitForStableCrosstab(page: Page) {
  await ensureCorrectionNone(page);

  const tour = page.getByTestId('first-crosstab-tour');
  if (await tour.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: /got it/i }).click();
    await expect(tour).toBeHidden({ timeout: 5000 });
  }

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
    .getByRole('button', { name: /Activate to switch to/i })
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

/** Workspace library chrome (not analysis dashboard). */
export async function expectWorkspaceLibraryVisible(page: Page) {
  await expect(page.getByText('Velocity Workspace')).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole('heading', { name: 'sleep.sav' })).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Table view' })).toHaveCount(0);
}

export async function waitForWorkspaceModePersisted(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem('velocity-state');
          if (!raw) return false;
          try {
            const parsed = JSON.parse(raw) as { state?: { isWorkspaceMode?: boolean } };
            return parsed.state?.isWorkspaceMode === true;
          } catch {
            return false;
          }
        }),
      { timeout: 30000 },
    )
    .toBe(true);
}
export async function openDatasetFromWorkspaceSearch(page: Page, fileName: string) {
  await page.getByRole('button', { name: 'All Datasets' }).click();
  await page.getByPlaceholder('Search datasets...').fill(fileName);
  const listItem = page.getByRole('button', { name: `Open dataset ${fileName}` });
  if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await listItem.dblclick();
    return;
  }
  await page.getByRole('heading', { name: fileName }).dblclick();
}
