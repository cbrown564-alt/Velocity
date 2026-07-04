#!/usr/bin/env node
/**
 * WP4.2 — Timed five-minute metric pass (plan_05 §6).
 *
 * Automates: file-drop → three titled slides → PPTX export.
 * Records elapsed time and interruption count to stdout + JSON artifact.
 *
 * Run:
 *   node scripts/design-reset-five-minute-pass.mjs
 *
 * Environment: Chromium 1440×900, test_data/sleep.sav, keyboard-first palette grammar.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function openInsertPalette(page) {
  const insertBtn = page.getByRole('button', { name: /insert/i });
  if (await insertBtn.isVisible().catch(() => false)) {
    await insertBtn.click();
  } else {
    await page.keyboard.press('Control+KeyK');
  }
  await page.getByPlaceholder('Find a variable…').waitFor({ state: 'visible', timeout: 10000 });
}

async function insertVariable(page, query, target = 'rows') {
  await openInsertPalette(page);
  await page.getByPlaceholder('Find a variable…').fill(query);
  await page.waitForTimeout(350);
  if (target === 'columns') {
    await page.keyboard.press('Alt+Enter');
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(900);
}

async function addNewSlide(page) {
  await page.getByText('+ New slide').click();
  await page.waitForTimeout(600);
}

async function main() {
  const useExternalServer = process.env.SKIP_DEV_SERVER === '1';
  const server = useExternalServer ? null : startDevServer();
  const interruptions = [];
  const startedAt = Date.now();
  let fileDropAt = null;
  let pptxSavedAt = null;

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

    fileDropAt = Date.now();
    await page.getByTestId('dataset-upload-input').setInputFiles(SLEEP_SAV);
    await waitForDashboardReady(page);

    // Slide 1: sex × marital
    await insertVariable(page, 'sex', 'rows');
    await insertVariable(page, 'marital', 'columns');
    await page.locator('.analysis-frame table').waitFor({ state: 'visible', timeout: 60000 });

    // Slide 2
    await addNewSlide(page);
    await insertVariable(page, 'age', 'rows');
    await insertVariable(page, 'race', 'columns');

    // Slide 3 — single-variable distribution
    await addNewSlide(page);
    await insertVariable(page, 'educ', 'rows');

    // Export PPTX
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByTestId('export-modal-submit').waitFor({ state: 'visible', timeout: 10000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.getByTestId('export-modal-submit').click();
    const download = await downloadPromise;
    pptxSavedAt = Date.now();
    const savePath = path.join(OUT_DIR, 'wp42-five-minute-pass.pptx');
    await download.saveAs(savePath);

    await browser.close();

    const elapsedMs = pptxSavedAt - fileDropAt;
    const elapsedSec = (elapsedMs / 1000).toFixed(1);
    const pass = elapsedMs < 5 * 60 * 1000 && interruptions.length === 0;

    const report = {
      capturedAt: new Date().toISOString(),
      environment: { viewport: '1440×900', dataset: 'test_data/sleep.sav', browser: 'chromium' },
      elapsedMs,
      elapsedFormatted: `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`,
      interruptionCount: interruptions.length,
      interruptions,
      pass,
      criteria: { maxElapsedMs: 300000, maxInterruptions: 0 },
      pptxPath: savePath,
    };

    const reportPath = path.join(OUT_DIR, 'wp42-five-minute-pass.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`WP4.2 five-minute pass: ${report.elapsedFormatted} elapsed, ${interruptions.length} interruption(s)`);
    console.log(`Pass: ${pass ? 'YES' : 'NO'} (< 5:00 and zero interruptions)`);
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
