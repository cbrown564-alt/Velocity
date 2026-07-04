#!/usr/bin/env node
/**
 * WP4.2 — Timed five-minute metric pass (plan_05 §6).
 *
 * Automates: file-drop → three titled slides → PPTX export.
 * Records elapsed time and interruption count to stdout + JSON artifact.
 *
 * Run:
 *   node scripts/design-reset-five-minute-pass.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectPptx } from './report-quality/inspect-pptx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.WP42_OUT || path.join(ROOT, 'docs/assets/design-reset-evidence');
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
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not ready at ${url}`);
}

function startDevServer() {
  return spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
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

async function waitForDashboardReady(page) {
  const tableView = page.getByRole('button', { name: 'Table view' });
  const metadataLoaded = page.getByText('Metadata Loaded');
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (await tableView.isVisible().catch(() => false)) return;
    if (await metadataLoaded.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Load Full Data' }).click();
      await tableView.waitFor({ state: 'visible', timeout: 120000 });
      return;
    }
    await page.waitForTimeout(300);
  }
  throw new Error('Dashboard did not become ready');
}

async function closeOverlays(page) {
  for (let i = 0; i < 3; i += 1) {
    const paletteInput = page.getByPlaceholder('Find a variable…');
    if (await paletteInput.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await paletteInput.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    const exportModal = page.getByTestId('export-modal-submit');
    if (await exportModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await exportModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(150);
  }
}

async function openInsertPalette(page) {
  await closeOverlays(page);
  await page.keyboard.press('Control+KeyK');
  await page.getByPlaceholder('Find a variable…').waitFor({ state: 'visible', timeout: 10000 });
}

async function insertVariable(page, query, target = 'rows') {
  await openInsertPalette(page);
  const input = page.getByPlaceholder('Find a variable…');
  await input.fill('');
  await input.fill(query);
  await page.waitForTimeout(250);
  if (target === 'columns') {
    await page.keyboard.press('Alt+Enter');
  } else if (target === 'filter') {
    await page.keyboard.press('Shift+Enter');
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(700);
  await closeOverlays(page);
}

async function waitForActiveSlideTable(page, timeoutMs = 60000) {
  const table = page.locator('.analysis-frame table');
  await table.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(
    () => {
      const active = document.querySelector('.analysis-frame table');
      if (!active) return false;
      const rows = active.querySelectorAll('tbody tr');
      if (rows.length === 0) return false;
      const text = active.textContent ?? '';
      return /\d+\.\d%/.test(text) || /\d/.test(text);
    },
    { timeout: timeoutMs },
  );
}

async function addNewSlide(page) {
  await closeOverlays(page);
  const before = await slideCount(page);
  await page.keyboard.press('n');
  await page
    .waitForFunction(
      (expected) => document.querySelectorAll('[data-testid^="story-rail-slide-"]').length > expected,
      before,
      {
        timeout: 10000,
      },
    )
    .catch(async () => {
      await page.getByText('+ New slide').click({ force: true });
      await page.waitForFunction(
        (expected) => document.querySelectorAll('[data-testid^="story-rail-slide-"]').length > expected,
        before,
        { timeout: 10000 },
      );
    });
  await page.waitForTimeout(400);
}

async function slideCount(page) {
  return page.getByTestId(/story-rail-slide-/).count();
}

async function exportAllSlidesPptx(page, savePath) {
  await closeOverlays(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByTestId('export-modal-submit').waitFor({ state: 'visible', timeout: 10000 });
  await page
    .locator('label')
    .filter({ hasText: /^All Slides/ })
    .click();
  await page.waitForTimeout(300);
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.getByTestId('export-modal-submit').click();
  const download = await downloadPromise;
  await download.saveAs(savePath);
}

async function renameActiveSlide(page, title) {
  const activeSlide = page.locator('[data-testid^="story-rail-slide-"][aria-current="true"]');
  if (await activeSlide.isVisible().catch(() => false)) {
    await activeSlide.dblclick();
    const input = page.locator('[data-testid^="story-rail-slide-"] input').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(title);
      await input.press('Enter');
      await page.waitForTimeout(300);
      return;
    }
  }
  const heading = page.getByRole('heading', { level: 2 }).first();
  if (await heading.isVisible().catch(() => false)) {
    await heading.click();
    await page.keyboard.type(title);
    await page.keyboard.press('Enter');
  }
}

async function main() {
  const useExternalServer = process.env.SKIP_DEV_SERVER === '1';
  const server = useExternalServer ? null : startDevServer();
  const interruptions = [];
  const timings = { fileDropAt: 0, pptxSavedAt: 0 };
  const steps = [];

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('dialog', (d) => d.dismiss());

    page.on('console', (msg) => {
      const text = msg.text();
      if (/coaching|tour|onboarding/i.test(text)) {
        interruptions.push({ type: 'console', text });
      }
    });

    await page.goto(BASE_URL);
    await clearBrowserStorage(page);
    await page.reload();

    const startFresh = page.getByRole('button', { name: 'Start Fresh' });
    if (await startFresh.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startFresh.click();
    }

    timings.fileDropAt = Date.now();
    await page.getByTestId('dataset-upload-input').setInputFiles(SLEEP_SAV);
    await waitForDashboardReady(page);
    steps.push({ step: 'dashboard-ready', atMs: Date.now() - timings.fileDropAt });

    // Slide 1: sex × marital (auto-first-crosstab may already apply; ensure recipe exists)
    const tableVisible = await page
      .locator('.analysis-frame table')
      .isVisible()
      .catch(() => false);
    if (!tableVisible) {
      await insertVariable(page, 'sex', 'rows');
      await insertVariable(page, 'marital', 'columns');
    }
    await page.locator('.analysis-frame table').waitFor({ state: 'visible', timeout: 60000 });
    await renameActiveSlide(page, 'Gender by marital status');
    await waitForActiveSlideTable(page);
    steps.push({ step: 'slide-1-crosstab', atMs: Date.now() - timings.fileDropAt });

    // Slide 2: edlevel × sex (nominal crosstab — age is numeric and may not show % cells)
    await addNewSlide(page);
    await insertVariable(page, 'edlevel', 'rows');
    await insertVariable(page, 'sex', 'columns');
    await waitForActiveSlideTable(page);
    await renameActiveSlide(page, 'Education by gender');
    steps.push({ step: 'slide-2-crosstab', atMs: Date.now() - timings.fileDropAt });

    // Slide 3: single-variable distribution
    await addNewSlide(page);
    await insertVariable(page, 'marital', 'rows');
    await waitForActiveSlideTable(page);
    await renameActiveSlide(page, 'Marital status distribution');
    steps.push({ step: 'slide-3-rows', atMs: Date.now() - timings.fileDropAt });

    const slides = await slideCount(page);
    if (slides < 3) {
      throw new Error(`Expected at least 3 slides before export, found ${slides}`);
    }

    // Export all slides to PPTX (default scope is current slide only)
    const savePath = path.join(OUT_DIR, 'wp42-five-minute-pass.pptx');
    await exportAllSlidesPptx(page, savePath);
    timings.pptxSavedAt = Date.now();
    steps.push({ step: 'pptx-saved', atMs: timings.pptxSavedAt - timings.fileDropAt });

    const exported = await inspectPptx(savePath);

    await browser.close();

    const elapsedMs = timings.pptxSavedAt - timings.fileDropAt;
    const pass =
      elapsedMs < 5 * 60 * 1000 &&
      interruptions.length === 0 &&
      slides >= 3 &&
      exported.slideCount >= 3 &&
      exported.tableCount >= 2;

    const report = {
      capturedAt: new Date().toISOString(),
      environment: { viewport: '1440×900', dataset: 'test_data/sleep.sav', browser: 'chromium' },
      elapsedMs,
      elapsedFormatted: `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`,
      slideCount: slides,
      exportedSlideCount: exported.slideCount,
      exportedTableCount: exported.tableCount,
      steps,
      interruptionCount: interruptions.length,
      interruptions,
      pass,
      criteria: { maxElapsedMs: 300000, maxInterruptions: 0, minSlides: 3, minExportedSlides: 3 },
      pptxPath: savePath,
    };

    const reportPath = path.join(OUT_DIR, 'wp42-five-minute-pass.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(
      `WP4.2 five-minute pass: ${report.elapsedFormatted} elapsed, ${slides} deck slides, ${exported.slideCount} exported slides, ${interruptions.length} interruption(s)`,
    );
    console.log(`Pass: ${pass ? 'YES' : 'NO'} (< 5:00, zero interruptions, ≥3 deck slides, ≥3 exported slides)`);
    console.log(`Report: ${reportPath}`);
    console.log(`PPTX: ${savePath}`);

    if (!pass) process.exit(1);
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
