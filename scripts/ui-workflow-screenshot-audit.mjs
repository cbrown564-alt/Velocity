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
  const candidates = [
    page.getByRole('button', { name: /Load Example/i }),
    page.getByTestId('dataset-upload-input'),
    page.getByText('Survey Questions'),
    page.getByTestId('workspace-status-strip'),
  ];
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    for (const loc of candidates) {
      if (await loc.isVisible().catch(() => false)) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('Workspace did not become ready in time');
}

async function uploadSavAndReachDashboard(page) {
  const fileInput = page.getByTestId('dataset-upload-input');
  await fileInput.setInputFiles(SLEEP_SAV);

  const surveyQuestions = page.getByText(/Survey Questions/);
  const metadataLoaded = page.getByText('Metadata Loaded');

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await surveyQuestions.isVisible().catch(() => false)) break;
    if (await metadataLoaded.isVisible().catch(() => false)) {
      await shot(page, '03-metadata-loaded-interstitial');
      await page.getByRole('button', { name: 'Load Full Data' }).click();
      await surveyQuestions.waitFor({ state: 'visible', timeout: 120000 });
      break;
    }
    await page.waitForTimeout(300);
  }
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

    await page.goto(BASE_URL);

    const opfsSupported = await page.evaluate(async () => {
      try {
        if (!self.isSecureContext) return false;
        if (!navigator.storage?.getDirectory) return false;
        await navigator.storage.getDirectory();
        return true;
      } catch {
        return false;
      }
    });
    if (!opfsSupported) {
      throw new Error('OPFS not supported — cannot run full workflow audit');
    }

    // 0. Engine init splash (may flash briefly)
    await page.waitForTimeout(1500);
    await shot(page, '00-engine-init-splash');

    // 1. Workspace landing (fresh)
    await clearBrowserStorage(page);
    await page.reload();
    await waitForWorkspaceReady(page);
    await page.waitForTimeout(800);
    await shot(page, '01-workspace-landing');

    // 2. Upload initiated — file picker state isn't visible; capture after strip + empty grid
    await uploadSavAndReachDashboard(page);

    // 3. Metadata interstitial captured inside upload helper if shown

    // 4. Dashboard / variable browser before analysis
    await page.waitForTimeout(1000);
    await shot(page, '04-dashboard-variable-browser');

    // 5. Building first crosstab — one variable on shelf
    await page.getByRole('button', { name: /^sex$/i }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '05-building-crosstab-one-variable');

    // 6. Crosstab table result
    await page
      .getByRole('button', { name: /marital status/i })
      .first()
      .click();
    await page.locator('table').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500);
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

    // 9. Variable Manager
    const vmBtn = page.getByRole('button', { name: /variable manager|variables/i }).first();
    if (await vmBtn.isVisible().catch(() => false)) {
      await vmBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, '09-variable-manager');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      await page.keyboard.press('KeyV');
      await page.waitForTimeout(1200);
      await shot(page, '09-variable-manager');
      await page.keyboard.press('Escape');
    }

    // 10. Focus mode
    const focusBtn = page.getByRole('button', { name: /focus/i }).first();
    if (await focusBtn.isVisible().catch(() => false)) {
      await focusBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '10-focus-mode');
      await focusBtn.click();
      await page.waitForTimeout(400);
    }

    // 11. Command palette
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(600);
    await shot(page, '11-command-palette');
    await page.keyboard.press('Escape');

    // 12. Return to workspace
    const homeButton = page.locator('button[title="Return to Workspace"]');
    await homeButton.click();
    await waitForWorkspaceReady(page);
    await page.waitForTimeout(800);
    await shot(page, '12-workspace-after-session');

    // 13. Reopen dataset (resume flow)
    await page.getByRole('button', { name: 'All Datasets' }).click();
    await page.getByPlaceholder('Search datasets...').fill('sleep.sav');
    await page.waitForTimeout(400);
    await shot(page, '13-dataset-search-reopen');
    await page.getByRole('heading', { name: 'sleep.sav' }).dblclick();
    await page.getByText(/sleep\.sav \(271 rows\)/).waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot(page, '14-resumed-analysis-session');

    // 14. Analysis settings panel if visible
    const settingsBtn = page.getByRole('button', { name: /settings|analysis settings/i }).first();
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(600);
      await shot(page, '15-analysis-settings');
    }

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
