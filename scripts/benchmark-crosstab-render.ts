#!/usr/bin/env npx tsx
/**
 * Crosstab processing benchmark (Phase 4: Rendering Scalability).
 *
 * Measures the cost of `processAnalysisData` / `buildTree` — the pure-compute
 * step that turns raw aggregated rows into the hierarchical table model the
 * crosstab renders — on two shapes that stress the table:
 *
 *   - wide-banner tables (many body columns), and
 *   - multi-level row tables (deep recursive nesting).
 *
 * These are the inputs that make the table jank after a query completes, so
 * they are the right shapes to track for regressions in the tree-building path
 * optimised in Phase 4 Task 4 (per-node colKey indexing). It also reports each
 * scenario's row-node and cell counts and whether the result crosses the
 * per-cell animation threshold (`shouldAnimateCrosstab`), tying the data-prep
 * cost to the render-side motion policy from Task 1.
 *
 * Scope (honest): this is a Node-side measurement of the processing path, not a
 * headless-browser DOM render/commit profile. Browser wall-clock render timing
 * is folded into the Phase 5 performance dashboard. Node RSS high-water marks
 * are GC-noisy, so timing is the reliable signal; peak RSS is informational.
 *
 * Usage:
 *   npx tsx scripts/benchmark-crosstab-render.ts
 *   npx tsx scripts/benchmark-crosstab-render.ts --iterations=50
 *   npx tsx scripts/benchmark-crosstab-render.ts --output=validation/benchmark_crosstab_render_latest.json
 */

import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import { processAnalysisData } from '../src/core/analysis/analysisProcessor';
import { countTreeNodes, shouldAnimateCrosstab } from '../src/features/dashboard/components/crosstabMotionPolicy';
import type { AggregatedRow, Variable } from '../src/types';

const RSS_POLL_MS = 25;
const DEFAULT_ITERATIONS = 30;

interface Args {
  outputPath: string;
  iterations: number;
}

function parseArgs(argv: string[]): Args {
  const outputFlag = argv.find((arg) => arg.startsWith('--output='));
  const iterationsFlag = argv.find((arg) => arg.startsWith('--iterations='));
  return {
    outputPath: outputFlag
      ? outputFlag.slice('--output='.length)
      : path.resolve(process.cwd(), 'validation/benchmark_crosstab_render_latest.json'),
    iterations: iterationsFlag ? Math.max(1, Number(iterationsFlag.slice('--iterations='.length))) : DEFAULT_ITERATIONS,
  };
}

/** Build a categorical variable with `count` value labels (v0..v{count-1}). */
function makeCategorical(id: string, count: number): Variable {
  return {
    id,
    name: id,
    label: id.toUpperCase(),
    type: 'categorical',
    valueLabels: Array.from({ length: count }, (_, i) => ({ value: i, label: `${id} ${i}` })),
    missingValues: {},
  };
}

/** Deterministic, non-trivial cell count so percentages and sorting do real work. */
function cellCount(parts: number[]): number {
  const seed = parts.reduce((acc, p, idx) => acc + p * (7 + idx * 6), 0);
  return (seed % 50) + 1;
}

interface Scenario {
  key: string;
  description: string;
  data: AggregatedRow[];
  rowVariables: Variable[];
  colVariable: Variable | null;
}

/** Single row variable × a wide banner column variable. */
function wideBanner(key: string, rowCount: number, colCount: number): Scenario {
  const rowVar = makeCategorical('rowvar', rowCount);
  const colVar = makeCategorical('colvar', colCount);
  const data: AggregatedRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      data.push({ rowKeys: [String(r)], colKey: String(c), count: cellCount([r, c]) });
    }
  }
  return {
    key,
    description: `${rowCount} rows x ${colCount} banner columns`,
    data,
    rowVariables: [rowVar],
    colVariable: colVar,
  };
}

/** Three nested row variables × a modest banner (deep recursion). */
function multiLevel(key: string, l1: number, l2: number, l3: number, colCount: number): Scenario {
  const rowVars = [makeCategorical('region', l1), makeCategorical('agegroup', l2), makeCategorical('gender', l3)];
  const colVar = colCount > 1 ? makeCategorical('colvar', colCount) : null;
  const cols = colCount > 1 ? colCount : 1;
  const data: AggregatedRow[] = [];
  for (let a = 0; a < l1; a++) {
    for (let b = 0; b < l2; b++) {
      for (let d = 0; d < l3; d++) {
        for (let c = 0; c < cols; c++) {
          data.push({
            rowKeys: [String(a), String(b), String(d)],
            colKey: colVar ? String(c) : 'Total',
            count: cellCount([a, b, d, c]),
          });
        }
      }
    }
  }
  return {
    key,
    description: `${l1} x ${l2} x ${l3} nested rows x ${cols} column(s)`,
    data,
    rowVariables: rowVars,
    colVariable: colVar,
  };
}

interface ScenarioResult {
  key: string;
  description: string;
  inputRows: number;
  rowNodeCount: number;
  columnCount: number;
  renderedCellCount: number;
  animationsEnabled: boolean;
  iterations: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  peakRssBytes: number;
}

function runScenario(scenario: Scenario, iterations: number): ScenarioResult {
  const run = () =>
    processAnalysisData({
      data: scenario.data,
      rowVariables: scenario.rowVariables,
      colVariable: scenario.colVariable,
    });

  // Warm up (JIT + first-run allocation) before measuring.
  const warm = run();
  if (!warm) {
    throw new Error(`Scenario ${scenario.key} produced no processed data`);
  }

  let peakRss = process.memoryUsage().rss;
  const poll = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peakRss) peakRss = rss;
  }, RSS_POLL_MS);

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  clearInterval(poll);

  const rowNodeCount = countTreeNodes(warm.rows);
  const columnCount = warm.columns.length;

  return {
    key: scenario.key,
    description: scenario.description,
    inputRows: scenario.data.length,
    rowNodeCount,
    columnCount,
    renderedCellCount: rowNodeCount * columnCount,
    animationsEnabled: shouldAnimateCrosstab(rowNodeCount, columnCount),
    iterations,
    meanMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    peakRssBytes: peakRss,
  };
}

async function main(): Promise<void> {
  const { outputPath, iterations } = parseArgs(process.argv.slice(2));

  const scenarios: Scenario[] = [
    wideBanner('wide-banner-typical', 12, 30),
    wideBanner('wide-banner-large', 24, 60),
    multiLevel('multi-level-typical', 8, 6, 5, 6),
    multiLevel('multi-level-deep', 10, 8, 6, 12),
  ];

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const result = runScenario(scenario, iterations);
    results.push(result);
    process.stdout.write(
      `${result.key.padEnd(22)} ${result.description.padEnd(40)} ` +
        `nodes=${String(result.rowNodeCount).padStart(5)} cells=${String(result.renderedCellCount).padStart(6)} ` +
        `anim=${result.animationsEnabled ? 'on ' : 'off'} ` +
        `mean=${result.meanMs.toFixed(2)}ms min=${result.minMs.toFixed(2)}ms max=${result.maxMs.toFixed(2)}ms ` +
        `peakRSS=${(result.peakRssBytes / 1024 / 1024).toFixed(0)}MB\n`,
    );
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    note: 'Node-side processAnalysisData/buildTree timing. Not a browser DOM render profile; RSS is GC-noisy and informational only.',
    iterations,
    scenarios: results,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nWrote ${outputPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
