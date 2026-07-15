#!/usr/bin/env node
/** Controlled repeated browser experiment for Audit 10 Phase 3. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.BOOT_EXPERIMENT_OUT || path.join(ROOT, 'validation/engine-boot');
const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const PORTS = { dev: 4181, preview: 4182 };
const SAV = path.join(ROOT, 'test_data/sleep.sav');

const CELLS = {
  'baseline-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'visible-upload',
  },
  'memory-dev': {
    server: 'dev',
    persistence: 'memory',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'visible-upload',
  },
  'sw-blocked-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: false,
    storage: 'fresh',
    concurrency: 1,
    action: 'visible-upload',
  },
  'returning-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'returning',
    concurrency: 1,
    action: 'visible-upload',
  },
  'corrupt-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'corrupt',
    concurrency: 1,
    action: 'visible-upload',
  },
  'source-no-db-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'source-no-db',
    concurrency: 1,
    action: 'visible-upload',
  },
  'two-context-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 2,
    action: 'visible-upload',
  },
  'example-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'example',
  },
  'drop-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'drop',
  },
  'hidden-control-dev': {
    server: 'dev',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'hidden-input',
  },
  'baseline-preview': {
    server: 'preview',
    persistence: 'opfs',
    serviceWorker: true,
    storage: 'fresh',
    concurrency: 1,
    action: 'visible-upload',
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const read = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const repetitions = Number(read('--repetitions', process.env.BOOT_EXPERIMENT_REPETITIONS || '20'));
  const requested = read('--cells', 'baseline-dev,memory-dev,sw-blocked-dev,baseline-preview').split(',');
  for (const name of requested) {
    if (!CELLS[name]) throw new Error(`Unknown cell ${name}. Available: ${Object.keys(CELLS).join(', ')}`);
  }
  return { repetitions, requested };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '0' } });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`))));
  });
}

function startServer(mode) {
  const port = PORTS[mode];
  const args =
    mode === 'preview'
      ? ['run', 'preview', '--', '--host', HOST, '--port', String(port)]
      : ['run', 'dev', '--', '--host', HOST, '--port', String(port)];
  return spawn('npm', args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Retry until the bounded server deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function clearOriginStorage(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (!navigator.storage?.getDirectory) return;
    const root = await navigator.storage.getDirectory();
    for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true });
  });
}

async function prepareStorage(page, storage) {
  await clearOriginStorage(page);
  if (storage === 'corrupt') {
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const file = await root.getFileHandle('velocity_data_v1_default.db', { create: true });
      const writable = await file.createWritable();
      await writable.write(new TextEncoder().encode('deliberately corrupt audit fixture'));
      await writable.close();
    });
  }
  if (storage === 'source-no-db') {
    await page.evaluate(() => {
      localStorage.setItem(
        'velocity-state',
        JSON.stringify({
          state: { dataFingerprint: { rowCount: 1, columnCount: 1, lastModified: Date.now() } },
          version: 1,
        }),
      );
    });
  }
  await page.reload();
}

async function visibleUpload(page) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /Upload/i })
    .first()
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles(SAV);
}

async function startAction(page, cell) {
  if (cell.persistence === 'memory') {
    await page.evaluate(() => window.__velocityWarmUpEngine?.('experiment-memory', 'memory'));
  }
  if (cell.action === 'visible-upload') return visibleUpload(page);
  if (cell.action === 'hidden-input') return page.getByTestId('dataset-upload-input').setInputFiles(SAV);
  if (cell.action === 'example') {
    await page.getByRole('button', { name: /Try the brand tracker example/i }).click();
    return;
  }
  const bytes = fs.readFileSync(SAV).toString('base64');
  await page.evaluate((base64) => {
    const binary = atob(base64);
    const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([data], 'sleep.sav', { type: 'application/octet-stream' }));
    document
      .querySelector('[data-testid="workspace-empty-state"]')
      ?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, bytes);
}

async function waitForOutcome(page) {
  await page
    .getByTestId('dashboard-workspace')
    .or(page.getByRole('button', { name: 'Table view' }))
    .first()
    .waitFor({ state: 'visible', timeout: 90_000 });
}

function summarizeTrace(trace) {
  const events = trace?.events ?? [];
  const failed = [...events].reverse().find((event) => ['error', 'timeout', 'cancelled'].includes(event.status));
  const durations = Object.fromEntries(
    events.filter((event) => event.durationMs != null).map((event) => [event.phase, event.durationMs]),
  );
  return {
    correlationId: trace?.correlationId ?? null,
    lastPhase: events.at(-1)?.phase ?? null,
    failurePhase: failed?.phase ?? null,
    terminalStatus:
      failed?.status ??
      (events.some((event) => event.phase === 'boot.terminal' && event.status === 'completed') ? 'completed' : null),
    bundle: events.find((event) => event.phase === 'duckdb.bundle.selected')?.detail?.bundle ?? null,
    persistence: events.find((event) => event.phase === 'persistence.outcome')?.detail?.mode ?? null,
    durations,
    events,
  };
}

async function runOnce(browser, baseURL, cell, cellName, repetition, lane) {
  const context = await browser.newContext({ serviceWorkers: cell.serviceWorker ? 'allow' : 'block' });
  const page = await context.newPage();
  const startedAt = Date.now();
  let error = null;
  try {
    await page.goto(baseURL);
    await prepareStorage(page, cell.storage);
    if (cell.storage === 'returning') {
      await visibleUpload(page);
      await waitForOutcome(page);
      await page.reload();
    }
    await startAction(page, cell);
    await waitForOutcome(page);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const trace = await page.evaluate(() => window.__velocityGetBootTrace?.() ?? null).catch(() => null);
  const result = {
    cell: cellName,
    repetition,
    lane,
    elapsedMs: Date.now() - startedAt,
    pass: error === null,
    error,
    trace: summarizeTrace(trace),
  };
  await context.close();
  return result;
}

async function runServerCells(browser, mode, cellNames, repetitions, results, serverLogs) {
  if (mode === 'preview') await runCommand('npm', ['run', 'build']);
  const server = startServer(mode);
  server.stdout.on('data', (chunk) => (serverLogs[mode].stdout += chunk.toString()));
  server.stderr.on('data', (chunk) => (serverLogs[mode].stderr += chunk.toString()));
  const baseURL = `http://${HOST}:${PORTS[mode]}`;
  try {
    await waitForServer(baseURL);
    for (const cellName of cellNames) {
      const cell = CELLS[cellName];
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const lanes = Array.from({ length: cell.concurrency }, (_, lane) =>
          runOnce(browser, baseURL, cell, cellName, repetition, lane + 1),
        );
        const laneResults = await Promise.all(lanes);
        results.push(...laneResults);
        const passes = laneResults.filter((result) => result.pass).length;
        console.log(`${cellName} ${repetition}/${repetitions}: ${passes}/${laneResults.length} passed`);
      }
    }
  } finally {
    server.kill('SIGTERM');
  }
}

async function main() {
  const { repetitions, requested } = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  const serverLogs = { dev: { stdout: '', stderr: '' }, preview: { stdout: '', stderr: '' } };
  try {
    for (const mode of ['dev', 'preview']) {
      const modeCells = requested.filter((name) => CELLS[name].server === mode);
      if (modeCells.length) await runServerCells(browser, mode, modeCells, repetitions, results, serverLogs);
    }
  } finally {
    await browser.close();
  }

  const summary = Object.fromEntries(
    requested.map((name) => {
      const cellResults = results.filter((result) => result.cell === name);
      const elapsed = cellResults.map((result) => result.elapsedMs).sort((a, b) => a - b);
      return [
        name,
        {
          attempts: cellResults.length,
          passes: cellResults.filter((result) => result.pass).length,
          failures: cellResults.filter((result) => !result.pass).length,
          medianMs: elapsed[Math.floor(elapsed.length / 2)] ?? null,
          p95Ms: elapsed[Math.floor(elapsed.length * 0.95)] ?? null,
          failurePhases: cellResults
            .filter((result) => !result.pass)
            .map((result) => result.trace.failurePhase ?? result.trace.lastPhase),
          bundles: [...new Set(cellResults.map((result) => result.trace.bundle).filter(Boolean))],
          persistenceModes: [...new Set(cellResults.map((result) => result.trace.persistence).filter(Boolean))],
        },
      ];
    }),
  );
  const artifact = {
    capturedAt: new Date().toISOString(),
    repetitions,
    cells: requested.map((name) => ({ name, ...CELLS[name] })),
    summary,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'engine-boot-experiment.raw.json'), `${JSON.stringify(artifact, null, 2)}\n`);
  fs.writeFileSync(
    path.join(OUT_DIR, 'engine-boot-experiment.json'),
    `${JSON.stringify({ capturedAt: artifact.capturedAt, repetitions, cells: artifact.cells, summary }, null, 2)}\n`,
  );
  for (const [mode, logs] of Object.entries(serverLogs)) {
    fs.writeFileSync(path.join(OUT_DIR, `${mode}-stdout.log`), logs.stdout);
    fs.writeFileSync(path.join(OUT_DIR, `${mode}-stderr.log`), logs.stderr);
  }
  if (results.some((result) => !result.pass)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
