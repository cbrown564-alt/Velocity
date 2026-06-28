import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { STARTUP_JS_TRANSFER_BUDGET_BYTES, formatBytes } from './helpers/performanceBudget';

/**
 * Phase 5 Task 1 — production-browser performance dashboard.
 *
 * This is the convergence point for the browser wall-clock measurements that
 * Phase 3 Task 5 (upload-to-first-crosstab) and Phase 4 Task 5 (render timing)
 * deferred into "the Phase 5 dashboard". It drives the production build (served
 * from `dist` by `playwright.performance.config.ts`) through the whole pilot
 * path and reports, in one JSON artifact:
 *
 *   - initialLoadedBytes  — same-origin startup assets fetched before upload
 *   - workerReadyMs       — navigation start -> "[enginePersistenceBridge] Engine ready"
 *   - uploadToReadyMs     — file selected -> dashboard ready for analysis
 *   - firstCrosstabMs     — first variable selected -> rendered percentages
 *   - exportModalOpenMs   — Export clicked -> export submit visible (lazy chunk)
 *
 * Scope (honest): this is a single-sample wall-clock reading on whatever machine
 * runs it. The *byte* metrics are deterministic for a build and are gated
 * (Task 4); the *timing* metrics are environment-sensitive and are recorded for
 * trend-watching, not asserted as tight gates. Output is written to
 * `validation/performance_dashboard_latest.json` (regenerable working artifact,
 * not frozen pilot evidence — see validation/README.md).
 */

const GENDERS = ['Male', 'Female'];
const REGIONS = ['North', 'South', 'East', 'West'];
const ROWS_PER_CELL = 30;

/**
 * A small, ordinary survey-shaped CSV: gender (rows) x region (columns) is a
 * typical 2x4 pilot crosstab, well below the virtualization thresholds, so the
 * first-crosstab reading reflects the common case rather than a stress shape.
 */
function buildPilotCsv(): string {
  const lines = ['gender,region,satisfaction'];
  for (const gender of GENDERS) {
    for (const region of REGIONS) {
      for (let i = 0; i < ROWS_PER_CELL; i++) {
        const satisfaction = (i * 7 + region.length * 3) % 11;
        lines.push(`${gender},${region},${satisfaction}`);
      }
    }
  }
  return lines.join('\n');
}

interface StartupResource {
  name: string;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

test('performance dashboard: cold start, upload, first crosstab, export modal', async ({ page }, testInfo) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('dialog', (dialog) => dialog.dismiss());

  // --- Cold start: navigation -> worker/engine ready ---------------------------
  const engineReady = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for production engine readiness')), 90000);
    page.on('console', (message) => {
      if (message.text().includes('[enginePersistenceBridge] Engine ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  const navStart = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await engineReady;
  const workerReadyMs = Date.now() - navStart;

  // Snapshot the startup network *before* any dataset upload so the byte budget
  // reflects only the cold-start payload.
  const startupResources: StartupResource[] = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry): entry is PerformanceResourceTiming => entry.entryType === 'resource')
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      })),
  );

  const appOrigin = new URL(page.url()).origin;
  const sameOriginAssets = startupResources.filter((r) => r.name.startsWith(appOrigin) && r.name.includes('/assets/'));
  const startupJsAssets = sameOriginAssets.filter((r) => r.name.includes('.js'));
  const startupJsTransferBytes = startupJsAssets.reduce((sum, r) => sum + r.transferSize, 0);
  const startupAssetTransferBytes = sameOriginAssets.reduce((sum, r) => sum + r.transferSize, 0);
  const exportVendorOnStartup = startupResources.some((r) => r.name.includes('export-vendor'));

  // --- Upload -> dashboard ready ----------------------------------------------
  const fileInput = page.getByTestId('dataset-upload-input');
  await expect(fileInput).toBeAttached({ timeout: 60000 });

  const uploadStart = Date.now();
  await fileInput.setInputFiles({
    name: 'pilot_dashboard.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(buildPilotCsv(), 'utf8'),
  });

  const genderBtn = page.getByRole('button', { name: /^gender$/i }).first();
  await expect(genderBtn).toBeVisible({ timeout: 120000 });
  const uploadToReadyMs = Date.now() - uploadStart;

  // --- First crosstab: select row var, then column var, await percentages ------
  const crosstabStart = Date.now();
  await genderBtn.click();
  const regionBtn = page.getByRole('button', { name: /^region$/i }).first();
  await expect(regionBtn).toBeVisible({ timeout: 15000 });
  await regionBtn.click();

  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=/\\d+\\.\\d%/').first()).toBeVisible({ timeout: 30000 });
  const firstCrosstabMs = Date.now() - crosstabStart;

  // --- Export modal open (exercises the Phase 1 lazy export chunk) -------------
  // Click directly (like pilot-workflow): Playwright auto-waits for the Export
  // button to become enabled, then we wait for the lazily-loaded modal's submit.
  let exportModalOpenMs: number | null = null;
  try {
    const exportStart = Date.now();
    await page.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 15000 });
    await expect(page.getByTestId('export-modal-submit')).toBeVisible({ timeout: 30000 });
    exportModalOpenMs = Date.now() - exportStart;
  } catch {
    // Best-effort: leave exportModalOpenMs null; the assertion below flags it.
  }

  // --- Cross-reference: on-device pilot telemetry ------------------------------
  const pilotEvents = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('velocity-pilot-events');
      if (!raw) return [];
      const events = JSON.parse(raw) as Array<{ name: string; elapsedMs: number }>;
      return events.map((e) => ({ name: e.name, elapsedMs: e.elapsedMs }));
    } catch {
      return [];
    }
  });

  // --- Assemble + persist the dashboard reading --------------------------------
  const payload = {
    generatedAt: new Date().toISOString(),
    note: 'Production-browser (vite preview of dist) wall-clock dashboard. Timings are single-sample and machine-sensitive; only the byte metrics are deterministic and budgeted. Regenerable working artifact, not frozen pilot evidence.',
    appOrigin,
    metrics: {
      workerReadyMs,
      uploadToReadyMs,
      firstCrosstabMs,
      exportModalOpenMs,
      initialLoadedBytes: {
        startupAssetTransferBytes,
        startupJsTransferBytes,
        startupJsTransferBudgetBytes: STARTUP_JS_TRANSFER_BUDGET_BYTES,
        exportVendorOnStartup,
      },
    },
    startupJsAssets: startupJsAssets
      .map((r) => ({ name: r.name.replace(appOrigin, ''), transferSize: r.transferSize }))
      .sort((a, b) => b.transferSize - a.transferSize),
    pilotEvents,
  };

  const outputPath = path.resolve(process.cwd(), 'validation/performance_dashboard_latest.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await testInfo.attach('performance-dashboard.json', {
    body: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
  });

  process.stdout.write(
    `\nPerformance dashboard:\n` +
      `  worker ready        ${workerReadyMs} ms\n` +
      `  upload -> ready     ${uploadToReadyMs} ms\n` +
      `  first crosstab      ${firstCrosstabMs} ms\n` +
      `  export modal open   ${exportModalOpenMs ?? 'n/a'} ms\n` +
      `  startup JS          ${formatBytes(startupJsTransferBytes)} (budget ${formatBytes(STARTUP_JS_TRANSFER_BUDGET_BYTES)})\n` +
      `  startup assets      ${formatBytes(startupAssetTransferBytes)}\n` +
      `  wrote ${outputPath}\n`,
  );

  // --- Gates (stable byte budgets only; timings are reported, not gated) -------
  expect(workerReadyMs).toBeGreaterThan(0);
  expect(uploadToReadyMs).toBeGreaterThan(0);
  expect(firstCrosstabMs).toBeGreaterThan(0);
  expect(exportModalOpenMs, 'export modal should open (lazy export chunk loads)').not.toBeNull();
  expect(startupJsAssets.length, 'startup should fetch main-thread JS assets').toBeGreaterThan(0);
  expect(exportVendorOnStartup, 'export-vendor must stay off the startup path (Phase 1)').toBe(false);
  expect(
    startupJsTransferBytes,
    `startup JS ${formatBytes(startupJsTransferBytes)} exceeds budget ${formatBytes(STARTUP_JS_TRANSFER_BUDGET_BYTES)}`,
  ).toBeLessThanOrEqual(STARTUP_JS_TRANSFER_BUDGET_BYTES);
});
