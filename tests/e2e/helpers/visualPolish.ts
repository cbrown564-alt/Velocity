import path from 'path';
import { expect, type Page } from '@playwright/test';

/** Bundled sleep.sav for e2e that must preserve sex×marital visual baselines. */
export const SLEEP_SAV_FIXTURE = path.resolve(process.cwd(), 'test_data/sleep.sav');

/** Dashboard sentinel after dataset load — replaces deleted "Survey Questions" sidebar heading. */
export function dashboardReadyLocator(page: Page) {
  return page.getByRole('button', { name: 'Table view' });
}

/** Wait until upload finishes and the analysis dashboard is interactive. */
export async function waitForDashboardReady(page: Page, timeoutMs = 120000) {
  const tableView = dashboardReadyLocator(page);
  const metadataLoaded = page.getByText('Metadata Loaded');

  await expect
    .poll(
      async () => {
        if (await tableView.isVisible().catch(() => false)) return 'dashboard';
        if (await metadataLoaded.isVisible().catch(() => false)) return 'metadata';
        return 'pending';
      },
      { timeout: timeoutMs },
    )
    .not.toBe('pending');

  if (await metadataLoaded.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Load Full Data' }).click();
    await expect(tableView).toBeVisible({ timeout: timeoutMs });
  }
}

/** Assert the active dataset is loaded in dashboard chrome (breadcrumb / subtitle). */
export async function expectDatasetLoaded(
  page: Page,
  fileName: string,
  options?: { rowCount?: number; timeoutMs?: number },
) {
  const timeout = options?.timeoutMs ?? 30000;
  await expect(page.getByText(fileName, { exact: false }).first()).toBeVisible({ timeout });
  if (options?.rowCount != null) {
    const formatted = options.rowCount.toLocaleString('en-US');
    const escaped = formatted.replace(/,/g, ',?');
    await expect(page.getByText(new RegExp(`N\\s*=\\s*${escaped}\\b`, 'i')).first()).toBeVisible({ timeout });
  }
}

/** Upload a file and wait for the dashboard (palette/rail IA). */
export async function uploadSavAndReachDashboard(page: Page, fixturePath: string, options?: { timeoutMs?: number }) {
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: options?.timeoutMs ?? 60000 });
  await fileInput.setInputFiles(fixturePath);
  await waitForDashboardReady(page, options?.timeoutMs ?? 120000);
}

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
    } catch {
      // Best-effort activation seeding for stable e2e.
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
  const tableView = page.getByRole('button', { name: 'Table view' });
  if (await tableView.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  const startFresh = page.getByRole('button', { name: 'Start Fresh' });
  if (await startFresh.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForTimeout(500);
  }

  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 120000 });

  await fileInput.setInputFiles(file);
  await waitForDashboardReady(page, 180000);
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

  const loadExample = page.getByRole('button', { name: /try the brand tracker example/i });
  await expect(loadExample).toBeVisible({ timeout: 60000 });
  await loadExample.click();
  await expect(tableView).toBeVisible({ timeout: 120000 });
}

/** Upload sleep.sav for specs that depend on sex×marital baselines (visual regression). */
export async function reachDashboardWithSleepExample(page: Page) {
  await clearBrowserStorage(page, { seedActivation: true });
  await page.reload();

  const tableView = page.getByRole('button', { name: 'Table view' });
  if (await tableView.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  const startFresh = page.getByRole('button', { name: 'Start Fresh' });
  if (await startFresh.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startFresh.click();
    await expect(tableView.or(page.getByTestId('workspace-empty-state'))).toBeVisible({ timeout: 120000 });
  }

  await uploadFileAndReachDashboard(page, SLEEP_SAV_FIXTURE);
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

/** Open the insert palette (⌘K) from the dashboard toolbar. */
export async function openInsertPalette(page: Page) {
  const insertBtn = page.getByRole('button', { name: /insert/i });
  if (await insertBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await insertBtn.click();
  } else {
    await page.keyboard.press('Control+KeyK');
  }
  await expect(page.getByPlaceholder('Find a variable…')).toBeVisible({ timeout: 10000 });
}

/** Insert a variable via palette grammar: ↵ columns, ⌥↵ rows, ⇧↵ filter. */
export async function insertVariableFromPalette(
  page: Page,
  query: string,
  target: 'rows' | 'columns' | 'filter' = 'columns',
) {
  await openInsertPalette(page);
  const input = page.getByPlaceholder('Find a variable…');
  await input.fill(query);
  await page.waitForTimeout(350);
  if (target === 'rows') {
    await page.keyboard.press('Alt+Enter');
  } else if (target === 'filter') {
    await page.keyboard.press('Shift+Enter');
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(900);
}

/** Wait until the active slide finishes a crosstab recomputation. */
export async function waitForAnalysisIdle(page: Page, timeoutMs = 120000) {
  const updating = page.getByText('Updating analysis results');
  if (await updating.isVisible().catch(() => false)) {
    await expect(updating).toBeHidden({ timeout: timeoutMs });
  }
}

/** Build or confirm the sleep.sav example crosstab (sex × marital status). */
export async function buildExampleCrosstab(page: Page) {
  const table = page.locator('table');
  const pctCell = page.locator('text=/\\d+\\.\\d%/').first();

  await waitForAnalysisIdle(page);

  const hasComputedCrosstab = async () =>
    (await table.isVisible({ timeout: 5000 }).catch(() => false)) &&
    (await pctCell.isVisible({ timeout: 5000 }).catch(() => false));

  // Brand tracker Load Example auto-applies brand preference × segment; accept any computed table.
  if (await hasComputedCrosstab()) {
    const headers = await table
      .locator('th')
      .allTextContents()
      .catch(() => []);
    const joined = headers.join(' ').toLowerCase();
    if (/single|married|divorced|widowed/.test(joined)) return;
    if (/growth|core|value|brand|segment|prefer/.test(joined)) return;
  }

  if (await hasComputedCrosstab()) {
    return;
  }

  await insertVariableFromPalette(page, 'sex', 'rows');
  await insertVariableFromPalette(page, 'marital', 'columns');

  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(table.locator('tbody tr')).not.toHaveCount(0);
  await expect(pctCell).toBeVisible({ timeout: 30000 });
}

export async function openOverflowMenu(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menu', { name: 'More actions' })).toBeVisible({ timeout: 5000 });
}

/** Reset the active slide recipe to an empty state (clears auto-first-crosstab). */
export async function resetActiveSlideRecipe(page: Page) {
  await openOverflowMenu(page);
  await page.getByRole('menuitem', { name: 'Reset' }).click();
  await page.waitForTimeout(600);
}

/** @deprecated Use buildExampleCrosstab — sleep.sav replaced mock_data.csv in e2e. */
export const buildGenderRegionCrosstab = buildExampleCrosstab;

export async function waitForStableCrosstab(page: Page) {
  await ensureCorrectionNone(page);

  const footer = page.locator('.statistics-status-bar, [class*="statistics"]').first();
  await expect(footer).toBeVisible({ timeout: 15000 });

  await page.waitForTimeout(400);
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
  await expect
    .poll(
      async () => {
        const stillBooting = await page
          .getByText(
            /Starting analysis engine|Restoring local workspace|Initializing Analysis Engine|Preparing workspace/i,
          )
          .isVisible()
          .catch(() => false);
        if (stillBooting) return false;

        const onWorkspace =
          (await page
            .getByText('Velocity Workspace')
            .isVisible()
            .catch(() => false)) ||
          (await page
            .getByRole('heading', { name: 'Recent Datasets' })
            .isVisible()
            .catch(() => false));
        const onDashboard = await page
          .getByRole('button', { name: 'Table view' })
          .isVisible()
          .catch(() => false);
        return onWorkspace && !onDashboard;
      },
      { timeout: 180000 },
    )
    .toBe(true);

  await expect(
    page.getByRole('heading', { name: /brandtracker_w4\.sav|sleep\.sav|Recent Datasets/i }).first(),
  ).toBeVisible({
    timeout: 60000,
  });
}

export async function waitForRestorationPromptOrWorkspace(page: Page) {
  await expect
    .poll(
      async () => {
        if (
          await page
            .getByRole('button', { name: 'Start Fresh' })
            .isVisible()
            .catch(() => false)
        )
          return true;
        if (
          await page
            .getByRole('button', { name: 'Restore Session' })
            .isVisible()
            .catch(() => false)
        )
          return true;
        if (
          await page
            .getByTestId('workspace-empty-state')
            .isVisible()
            .catch(() => false)
        )
          return true;
        return false;
      },
      { timeout: 120000 },
    )
    .toBe(true);
}

export async function ensureWorkspaceLibraryAfterReload(page: Page) {
  await expect
    .poll(
      async () => {
        const stillBooting = await page
          .getByText(
            /Starting analysis engine|Restoring local workspace|Initializing Analysis Engine|Preparing workspace/i,
          )
          .isVisible()
          .catch(() => false);
        if (stillBooting) return 'booting';

        if (
          await page
            .getByText('Velocity Workspace')
            .isVisible()
            .catch(() => false)
        )
          return 'workspace';
        if (
          await page
            .getByRole('heading', { name: 'Recent Datasets' })
            .isVisible()
            .catch(() => false)
        ) {
          return 'workspace';
        }
        if (
          await page
            .getByRole('button', { name: 'Table view' })
            .isVisible()
            .catch(() => false)
        ) {
          return 'dashboard';
        }
        return 'pending';
      },
      { timeout: 180000 },
    )
    .toMatch(/workspace|dashboard/);

  if (
    await page
      .getByRole('button', { name: 'Table view' })
      .isVisible()
      .catch(() => false)
  ) {
    await page.locator('button[title="Return to Workspace"]').click();
  }

  await expectWorkspaceLibraryVisible(page);
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
