/**
 * One-off UI workflow screenshot audit for pilot-readiness review.
 * Run: node scripts/ui-workflow-screenshot-audit.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.SCREENSHOT_OUT || '/opt/cursor/artifacts/screenshots/ui-workflow-audit';
const PORT = Number(process.env.PLAYWRIGHT_PORT || '4173');
const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const SLEEP_SAV = path.resolve(ROOT, 'test_data/sleep.sav');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not ready at ${url}`);
}

function startDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return child;
}

async function clearBrowserStorage(page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  });
}

async function shot(page, name, fullPage = false) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`  saved ${file}`);
  return file;
}

async function waitForWorkspaceReady(page) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const startFresh = page.getByRole('button', { name: 'Start Fresh' });
    if (await startFresh.isVisible().catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(600);
    }

    const candidates = [
      page.getByTestId('workspace-empty-state'),
      page.getByRole('button', { name: /Upload survey file/i }),
      page.getByRole('button', { name: /Try the brand tracker example/i }),
      page.getByTestId('dataset-upload-input'),
      page.getByRole('button', { name: 'Table view' }),
      page.getByTestId('workspace-status-strip'),
      page.getByRole('heading', { name: 'Recent Datasets' }),
    ];
    for (const loc of candidates) {
      if (await loc.isVisible().catch(() => false)) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('Workspace did not become ready in time');
}

async function uploadSavAndReachDashboard(page, options = {}) {
  const { captureEmptySlideImmediately = false } = options;
  const fileInput = page.getByTestId('dataset-upload-input');
  await fileInput.setInputFiles(SLEEP_SAV);

  const tableView = page.getByRole('button', { name: 'Table view' });
  const metadataLoaded = page.getByText('Metadata Loaded');
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    if (await tableView.isVisible().catch(() => false)) {
      if (captureEmptySlideImmediately) return 'dashboard';
      break;
    }
    if (await metadataLoaded.isVisible().catch(() => false)) {
      await shot(page, '03-metadata-loaded-interstitial');
      await page.getByRole('button', { name: 'Load Full Data' }).click();
      await tableView.waitFor({ state: 'visible', timeout: 120000 });
      if (captureEmptySlideImmediately) return 'dashboard';
      break;
    }
    await page.waitForTimeout(300);
  }

  if (!captureEmptySlideImmediately) {
    await tableView.waitFor({ state: 'visible', timeout: 5000 });
  }
}

async function captureEngineInitSplash(browser) {
  const splashContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const splashPage = await splashContext.newPage();
  splashPage.on('dialog', (d) => d.dismiss());
  await clearBrowserStorage(splashPage);

  const splashPromise = splashPage
    .getByText(/Starting analysis engine|Initializing Analysis Engine|Preparing workspace/i)
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => null);

  await splashPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await splashPromise;
  await shot(splashPage, '00-engine-init-splash');
  await splashContext.close();
}

async function openInsertPalette(page) {
  const insertBtn = page.getByRole('button', { name: /insert/i });
  if (await insertBtn.isVisible().catch(() => false)) {
    await insertBtn.click();
  } else {
    await page.keyboard.press('Control+KeyK');
  }
  await page.getByPlaceholder('Find a variable…').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(300);
}

async function insertVariableFromPalette(page, query, target = 'rows') {
  await openInsertPalette(page);
  const input = page.getByPlaceholder('Find a variable…');
  await input.fill(query);
  await page.waitForTimeout(400);
  if (target === 'columns') {
    await page.keyboard.press('Alt+Enter');
  } else if (target === 'filter') {
    await page.keyboard.press('Shift+Enter');
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(900);
}

async function waitForCrosstabReady(page, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const table = page.locator('.analysis-frame table');
    if (await table.isVisible().catch(() => false)) {
      const headers = await table
        .locator('th')
        .allTextContents()
        .catch(() => []);
      const joined = headers.join(' ').toLowerCase();
      if (/single|married|divorced|widowed/.test(joined)) {
        return;
      }
    }
    await page.waitForTimeout(350);
  }
  throw new Error('Crosstab table did not become ready (expected banner columns)');
}

async function openOverflowMenu(page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menu', { name: 'More actions' }).waitFor({ state: 'visible', timeout: 5000 });
}

async function main() {
  console.log(`Output: ${OUT_DIR}`);
  const useExternalServer = process.env.SKIP_DEV_SERVER === '1';
  const server = useExternalServer ? null : startDevServer();
  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('dialog', (d) => d.dismiss());

    // 0. Engine init splash — isolated cold load so frame 00 ≠ workspace landing
    await captureEngineInitSplash(browser);

    // 1. Workspace landing (fresh profile)
    await page.goto(BASE_URL);
    await clearBrowserStorage(page);
    await page.reload();
    await waitForWorkspaceReady(page);
    await page.waitForTimeout(800);
    await shot(page, '01-workspace-landing');

    // 2–3. Upload; capture empty slide before auto-first-crosstab paints
    await uploadSavAndReachDashboard(page, { captureEmptySlideImmediately: true });
    await page.waitForTimeout(200);
    await shot(page, '04-dashboard-story-rail-empty-slide');

    // Continue workflow on the same session (auto-first-crosstab may apply after frame 04)
    await page.waitForTimeout(1500);

    // 5. Building first crosstab — one variable on rows via insert palette
    await insertVariableFromPalette(page, 'sex', 'rows');
    await page.locator('.analysis-frame table').waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, '05-building-crosstab-one-variable');

    // 6. Crosstab table result — second variable on columns (⌥↵)
    await insertVariableFromPalette(page, 'marital', 'columns');
    await waitForCrosstabReady(page);
    await page.waitForTimeout(1500);
    await shot(page, '06-crosstab-table-result');

    // 7. Chart view
    const chartBtn = page.getByRole('button', { name: /chart view/i });
    if (await chartBtn.isVisible().catch(() => false)) {
      await chartBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, '07-chart-view');
      await page.getByRole('button', { name: /table view/i }).click();
      await page.waitForTimeout(800);
    }

    // 8. Export modal
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByTestId('export-modal-submit').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, '08-export-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // 9. Recipe inspector (slide properties)
    await page.getByTestId('recipe-inspector-toggle').click();
    await page.waitForTimeout(800);
    await shot(page, '09-recipe-inspector');
    await page.getByTestId('recipe-inspector-toggle').click();
    await page.waitForTimeout(400);

    // 10. Variable Manager (overflow menu)
    await openOverflowMenu(page);
    await page.getByRole('menuitem', { name: 'Variable Manager' }).click();
    await page.waitForTimeout(1200);
    await shot(page, '10-variable-manager');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // 11. Insert palette
    await openInsertPalette(page);
    await page.waitForTimeout(600);
    await shot(page, '12-insert-palette');
    await page.keyboard.press('Escape');

    // 13. Return to workspace
    const homeButton = page.locator('button[title="Return to Workspace"]');
    await homeButton.click();
    await waitForWorkspaceReady(page);
    await page.waitForTimeout(800);
    await shot(page, '13-workspace-after-session');

    // 14. Reopen dataset (resume flow)
    await page.getByRole('button', { name: 'All Datasets' }).click();
    await page.getByPlaceholder('Search datasets...').fill('sleep.sav');
    await page.waitForTimeout(400);
    await shot(page, '14-dataset-search-reopen');
    const reopenListItem = page.getByRole('button', { name: 'Open dataset sleep.sav' });
    if (await reopenListItem.isVisible().catch(() => false)) {
      await reopenListItem.dblclick();
    } else {
      await page.getByRole('heading', { name: 'sleep.sav' }).dblclick();
    }
    await page.getByRole('button', { name: 'Table view' }).waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot(page, '15-resumed-analysis-session');

    await browser.close();
    console.log('\nDone.');
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
