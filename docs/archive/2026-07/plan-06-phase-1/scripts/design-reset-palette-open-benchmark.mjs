#!/usr/bin/env node
/**
 * WP2.2 — Insert palette open latency benchmark.
 *
 * Measures keyboard-open latency (⌘K → input visible) on a 500-variable CSV fixture.
 * Acceptance gate from plan_05 §2.2: <100ms on the 500-variable fixture.
 *
 * Run: node scripts/design-reset-palette-open-benchmark.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.WP22_OUT || path.join(ROOT, 'docs/assets/design-reset-evidence');
const PORT = Number(process.env.PLAYWRIGHT_PORT || '4174');
const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const THRESHOLD_MS = Number(process.env.PALETTE_OPEN_BUDGET_MS || '100');
const RUNS = Number(process.env.PALETTE_OPEN_RUNS || '5');

fs.mkdirSync(OUT_DIR, { recursive: true });

function build500VariableCsv() {
  const headers = ['id', ...Array.from({ length: 500 }, (_, i) => `var_${String(i + 1).padStart(3, '0')}`)];
  const lines = [headers.join(',')];
  for (let row = 0; row < 20; row += 1) {
    lines.push([row, ...headers.slice(1).map((_, col) => ((row + col) % 5) + 1)].join(','));
  }
  return lines.join('\n');
}

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

async function main() {
  const useExternalServer = process.env.SKIP_DEV_SERVER === '1';
  const server = useExternalServer ? null : startDevServer();

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('dialog', (d) => d.dismiss());

    await page.goto(BASE_URL);
    await clearBrowserStorage(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'velocity-pilot-events',
        JSON.stringify([{ id: 'bench-seed', name: 'file_selected', at: new Date().toISOString(), elapsedMs: 0 }]),
      );
    });
    await page.reload();

    await page.getByTestId('dataset-upload-input').setInputFiles({
      name: 'palette_500.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(build500VariableCsv(), 'utf8'),
    });
    await page.getByRole('button', { name: 'Table view' }).waitFor({ state: 'visible', timeout: 180000 });
    await page.waitForTimeout(1500);

    const samples = [];
    for (let i = 0; i < RUNS; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const start = Date.now();
      await page.keyboard.press('Control+KeyK');
      await page.getByPlaceholder('Find a variable…').waitFor({ state: 'visible', timeout: 5000 });
      samples.push(Date.now() - start);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }

    await browser.close();

    const sorted = [...samples].sort((a, b) => a - b);
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    const maxMs = Math.max(...samples);
    const pass = maxMs < THRESHOLD_MS;

    const report = {
      capturedAt: new Date().toISOString(),
      fixture: 'palette_500.csv (500 variables)',
      thresholdMs: THRESHOLD_MS,
      runs: samples,
      medianMs,
      maxMs,
      pass,
    };

    const reportPath = path.join(OUT_DIR, 'wp22-palette-open-benchmark.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`WP2.2 palette open: median ${medianMs}ms, max ${maxMs}ms (budget ${THRESHOLD_MS}ms)`);
    console.log(`Pass: ${pass ? 'YES' : 'NO'}`);
    console.log(`Report: ${reportPath}`);

    if (!pass) process.exit(1);
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
