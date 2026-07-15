#!/usr/bin/env node
/**
 * Plan 06 Phase 0 — Journey gate (plan_06_backend_reset.md §1, WP0.2).
 *
 * Asserts Sarah-critical backend budgets in CI:
 *   - File-drop → first crosstab: < 10s cold, < 5s warm
 *   - Export 3-slide deck → PPTX: < 5s
 *   - Wave refresh engine demo: < 30s
 *   - Wave refresh browser contract smoke (demo/contracts/brand-tracker-wave-refresh.json)
 *
 * Run:
 *   node scripts/plan-06-journey-gate.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.JOURNEY_GATE_OUT || path.join(ROOT, 'docs/assets/design-reset-evidence');
const PORT = Number(process.env.PLAYWRIGHT_PORT || '4173');
const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

const BUDGETS = {
  coldFirstCrosstabMs: Number(process.env.JOURNEY_BUDGET_COLD_MS || 10_000),
  warmFirstCrosstabMs: Number(process.env.JOURNEY_BUDGET_WARM_MS || 5_000),
  exportPptxMs: Number(process.env.JOURNEY_BUDGET_EXPORT_MS || 5_000),
  waveRefreshMs: Number(process.env.JOURNEY_BUDGET_WAVE_REFRESH_MS || 30_000),
};

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

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (options.inherit) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (options.inherit) process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr || stdout}`));
    });
  });
}

async function runTimed(label, fn) {
  const startedAt = Date.now();
  const result = await fn();
  return { label, elapsedMs: Date.now() - startedAt, result };
}

async function main() {
  const results = [];
  const failures = [];
  const server = startDevServer();
  let viteStdout = '';
  let viteStderr = '';
  let journeyMetrics = {};
  const fiveMinuteReportPath = path.join(OUT_DIR, 'wp42-five-minute-pass.json');
  let runError = null;
  server.stdout.on('data', (chunk) => {
    viteStdout += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    viteStderr += chunk.toString();
  });

  console.log('Plan 06 journey gate — asserting §1 budgets');
  console.log(JSON.stringify(BUDGETS, null, 2));

  try {
    await waitForServer(BASE_URL);

    const sharedEnv = {
      SKIP_DEV_SERVER: '1',
      PLAYWRIGHT_HOST: HOST,
      PLAYWRIGHT_PORT: String(PORT),
      WP42_OUT: OUT_DIR,
      JOURNEY_GATE_OUT: OUT_DIR,
    };

    const fiveMinute = await runTimed('five-minute-pass', () =>
      runCommand('node', ['scripts/design-reset-five-minute-pass.mjs'], {
        env: { ...sharedEnv, JOURNEY_GATE: '1' },
        inherit: true,
      }),
    );
    results.push(fiveMinute);

    const fiveMinuteReport = JSON.parse(fs.readFileSync(fiveMinuteReportPath, 'utf8'));
    journeyMetrics = fiveMinuteReport.journeyMetrics ?? {};

    if ((journeyMetrics.coldFirstCrosstabMs ?? Infinity) > BUDGETS.coldFirstCrosstabMs) {
      failures.push(
        `cold file-drop → first crosstab ${journeyMetrics.coldFirstCrosstabMs}ms > ${BUDGETS.coldFirstCrosstabMs}ms`,
      );
    }
    if ((journeyMetrics.warmFirstCrosstabMs ?? Infinity) > BUDGETS.warmFirstCrosstabMs) {
      failures.push(
        `warm file-drop → first crosstab ${journeyMetrics.warmFirstCrosstabMs}ms > ${BUDGETS.warmFirstCrosstabMs}ms`,
      );
    }
    if ((journeyMetrics.exportPptxMs ?? Infinity) > BUDGETS.exportPptxMs) {
      failures.push(`export 3-slide PPTX ${journeyMetrics.exportPptxMs}ms > ${BUDGETS.exportPptxMs}ms`);
    }

    const waveRefresh = await runTimed('wave-refresh-engine', () =>
      runCommand('npm', ['run', 'demo:brand-tracker-wave-refresh'], { inherit: true }),
    );
    results.push(waveRefresh);
    if (waveRefresh.elapsedMs > BUDGETS.waveRefreshMs) {
      failures.push(`wave refresh engine demo ${waveRefresh.elapsedMs}ms > ${BUDGETS.waveRefreshMs}ms`);
    }

    const waveRefreshBrowser = await runTimed('wave-refresh-browser', () =>
      runCommand(
        'node',
        [
          'demo/scripts/run-demo-flow.mjs',
          '--contract',
          'demo/contracts/brand-tracker-wave-refresh.json',
          '--base-url',
          BASE_URL,
        ],
        { env: sharedEnv, inherit: true },
      ),
    );
    results.push(waveRefreshBrowser);

    const rebuildPath = await runTimed('persistence-rebuild-path', () =>
      runCommand('npx', ['playwright', 'test', 'tests/e2e/persistence-chaos.spec.ts', '-g', '@rebuild-path'], {
        env: sharedEnv,
        inherit: true,
      }),
    );
    results.push(rebuildPath);

    console.log(`\nJourney gate report: ${path.join(OUT_DIR, 'plan-06-journey-gate.json')}`);
    if (failures.length > 0) {
      throw new Error(`Journey gate budget failures: ${failures.join('; ')}`);
    }

    console.log('Journey gate PASSED');
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'vite-stdout.log'), viteStdout);
    fs.writeFileSync(path.join(OUT_DIR, 'vite-stderr.log'), viteStderr);
    const report = {
      capturedAt: new Date().toISOString(),
      budgets: BUDGETS,
      results: results.map(({ label, elapsedMs }) => ({ label, elapsedMs })),
      journeyMetrics,
      fiveMinuteReportPath,
      pass: !runError && failures.length === 0,
      failures,
      error: runError instanceof Error ? { message: runError.message, stack: runError.stack ?? null } : null,
      notes:
        'Budgets mirror plan_06_backend_reset.md §1. Tune JOURNEY_BUDGET_* env vars if CI hardware requires headroom.',
    };
    fs.writeFileSync(path.join(OUT_DIR, 'plan-06-journey-gate.json'), `${JSON.stringify(report, null, 2)}\n`);
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
