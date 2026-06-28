#!/usr/bin/env npx tsx
/**
 * Side-by-side benchmark: parseSavStreamingV2 vs parseSavStreamingSinglePassBridge (v3).
 *
 * This benchmark runs both paths with identical batch sizing and measures:
 * - wall-clock duration
 * - peak RSS
 * - row/batch parity
 * - v3 bridge queue depth metrics
 *
 * Usage:
 *   npx tsx scripts/benchmark-sav-v2-v3.ts
 *   npx tsx scripts/benchmark-sav-v2-v3.ts --output=validation/benchmark_sav_v2_v3_latest.json --iterations=2 --batch=5000
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import * as arrow from 'apache-arrow';
import {
  parseSavStreamingV2,
  parseSavStreamingSinglePassBridge,
  type SavVariable,
} from '../packages/readstat-wasm/ts/index';

type ScenarioName = 'v2_parse_only' | 'v3_parse_only' | 'v2_vectorize' | 'v3_vectorize';

type ScenarioRunResult = {
  rows: number;
  batches: number;
  metadataRowCount: number;
  queueMaxDepth?: number;
  producedBatches?: number;
  consumedBatches?: number;
};

type Measurement<T> = {
  result: T;
  durationMs: number;
  peakRssBytes: number;
  startRssBytes: number;
  endRssBytes: number;
};

type ScenarioAggregate = {
  runs: Measurement<ScenarioRunResult>[];
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgPeakRssBytes: number;
  allRunsRowParity: boolean;
  allRunsBatchParity: boolean;
  bridgeMetrics?: {
    maxQueueDepthObserved: number;
    producedBatchesAvg: number;
    consumedBatchesAvg: number;
  };
};

type DatasetBenchmark = {
  key: string;
  filePath: string;
  fileSizeBytes: number;
  batchSize: number;
  iterations: number;
  scenarios: Record<ScenarioName, ScenarioAggregate>;
  winners: {
    parseOnlyByAvgDuration: 'v2' | 'v3' | 'tie';
    vectorizeByAvgDuration: 'v2' | 'v3' | 'tie';
    parseOnlyByAvgPeakRss: 'v2' | 'v3' | 'tie';
    vectorizeByAvgPeakRss: 'v2' | 'v3' | 'tie';
  };
};

type BenchmarkOutput = {
  generatedAt: string;
  config: {
    iterations: number;
    batchSize: number;
    v3InitialCredits: number;
    v3MaxCredits: number;
  };
  datasets: DatasetBenchmark[];
  skipped: Array<{ key: string; filePath: string; reason: string }>;
  failures: Array<{ key: string; filePath: string; reason: string }>;
};

const DATASETS = [
  { key: 'sleep', filePath: path.resolve(process.cwd(), 'test_data/sleep.sav') },
  // Mid-size (8-50 MB) band: GSS annual cross-sections, wide/short shape (~1k cols, ~4k rows).
  { key: 'gss2021', filePath: path.resolve(process.cwd(), 'test_data/GSS/GSS2021.sav') },
  { key: 'gss2024', filePath: path.resolve(process.cwd(), 'test_data/GSS/GSS2024.sav') },
  { key: 'gss2022', filePath: path.resolve(process.cwd(), 'test_data/GSS/GSS2022.sav') },
  // Mid-size (8-50 MB) band: stitched British Social Attitudes waves 2014-2017 (harmonization fixture).
  { key: 'bsa2014_2017', filePath: path.resolve(process.cwd(), 'test_data/British Social Attitudes Survey/bsa_stitched_2014_2017.sav') },
  { key: 'wvs7', filePath: path.resolve(process.cwd(), 'test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav') },
];

const DEFAULT_OUTPUT = path.resolve(process.cwd(), 'validation/benchmark_sav_v2_v3_latest.json');
const DEFAULT_ITERATIONS = 2;
const DEFAULT_BATCH_SIZE = 5000;
const RSS_POLL_MS = 25;
const V3_INITIAL_CREDITS = 2;
const V3_MAX_CREDITS = 4;

function parseArgValue(argv: string[], key: string): string | null {
  const entry = argv.find((arg) => arg.startsWith(`${key}=`));
  return entry ? entry.slice(key.length + 1) : null;
}

function parseArgs(argv: string[]): { outputPath: string; iterations: number; batchSize: number } {
  const outputPath = parseArgValue(argv, '--output') ?? DEFAULT_OUTPUT;
  const iterationsRaw = parseArgValue(argv, '--iterations');
  const batchRaw = parseArgValue(argv, '--batch');

  const iterations = iterationsRaw ? Math.max(1, Math.floor(Number(iterationsRaw))) : DEFAULT_ITERATIONS;
  const batchSize = batchRaw ? Math.max(1, Math.floor(Number(batchRaw))) : DEFAULT_BATCH_SIZE;

  return { outputPath: path.resolve(process.cwd(), outputPath), iterations, batchSize };
}

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickWinner(a: number, b: number): 'v2' | 'v3' | 'tie' {
  const epsilon = 1e-9;
  if (Math.abs(a - b) <= epsilon) return 'tie';
  return a < b ? 'v2' : 'v3';
}

function buildVectorsFromBatch(
  rows: (number | string | null)[][],
  variables: SavVariable[],
): Record<string, arrow.Vector> {
  const numRows = rows.length;
  const numCols = rows[0]?.length ?? 0;
  const vectors: Record<string, arrow.Vector> = {};

  for (let c = 0; c < numCols; c++) {
    const colData: (number | string | null)[] = new Array(numRows);
    for (let r = 0; r < numRows; r++) {
      colData[r] = rows[r][c];
    }

    const meta = variables[c];
    const colName = meta?.name || `col_${c}`;
    const isNumeric = meta?.type === 'numeric';

    vectors[colName] = isNumeric
      ? arrow.vectorFromArray(colData as (number | null)[], new arrow.Float64())
      : arrow.vectorFromArray(colData as (string | null)[], new arrow.Utf8());
  }

  return vectors;
}

async function measure<T>(fn: () => Promise<T>): Promise<Measurement<T>> {
  const startRssBytes = process.memoryUsage().rss;
  let peakRssBytes = startRssBytes;

  const interval = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peakRssBytes) peakRssBytes = rss;
  }, RSS_POLL_MS);

  const started = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - started;
    const endRssBytes = process.memoryUsage().rss;
    peakRssBytes = Math.max(peakRssBytes, endRssBytes);
    return { result, durationMs, peakRssBytes, startRssBytes, endRssBytes };
  } finally {
    clearInterval(interval);
  }
}

async function runScenario(scenario: ScenarioName, buffer: ArrayBuffer, batchSize: number): Promise<ScenarioRunResult> {
  if (scenario === 'v2_parse_only' || scenario === 'v2_vectorize') {
    let rows = 0;
    let batches = 0;
    let variableMeta: SavVariable[] = [];

    const result = await parseSavStreamingV2(buffer, batchSize, async (batch) => {
      rows += batch.rows.length;
      batches += 1;
      if (variableMeta.length === 0 && batch.variables?.length) {
        variableMeta = batch.variables;
      }

      if (scenario === 'v2_vectorize' && batch.rows.length > 0) {
        if (variableMeta.length === 0) {
          throw new Error('v2 vectorize benchmark missing metadata');
        }
        const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMeta));
        void table;
      }
    });

    return {
      rows,
      batches,
      metadataRowCount: result.metadata.rowCount,
    };
  }

  let rows = 0;
  let batches = 0;
  let variableMeta: SavVariable[] = [];

  const result = await parseSavStreamingSinglePassBridge(
    buffer,
    {
      batchSize,
      initialCredits: V3_INITIAL_CREDITS,
      maxCredits: V3_MAX_CREDITS,
    },
    async (batch) => {
      rows += batch.rows.length;
      batches += 1;
      if (variableMeta.length === 0 && batch.variables?.length) {
        variableMeta = batch.variables;
      }

      if (scenario === 'v3_vectorize' && batch.rows.length > 0) {
        if (variableMeta.length === 0) {
          throw new Error('v3 vectorize benchmark missing metadata');
        }
        const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMeta));
        void table;
      }
    },
  );

  return {
    rows,
    batches,
    metadataRowCount: result.metadata.rowCount,
    queueMaxDepth: result.bridge.maxQueueDepth,
    producedBatches: result.bridge.producedBatches,
    consumedBatches: result.bridge.consumedBatches,
  };
}

function aggregateScenario(runs: Measurement<ScenarioRunResult>[]): ScenarioAggregate {
  const durations = runs.map((r) => r.durationMs);
  const peaks = runs.map((r) => r.peakRssBytes);
  const rowParity = runs.every((r) => r.result.rows === r.result.metadataRowCount);
  const batchParity = runs.every((r) => r.result.batches > 0 || r.result.metadataRowCount === 0);

  const v3Runs = runs.filter((r) => typeof r.result.queueMaxDepth === 'number');
  const bridgeMetrics =
    v3Runs.length > 0
      ? {
          maxQueueDepthObserved: Math.max(...v3Runs.map((r) => r.result.queueMaxDepth || 0)),
          producedBatchesAvg: average(v3Runs.map((r) => r.result.producedBatches || 0)),
          consumedBatchesAvg: average(v3Runs.map((r) => r.result.consumedBatches || 0)),
        }
      : undefined;

  return {
    runs,
    avgDurationMs: average(durations),
    minDurationMs: Math.min(...durations),
    maxDurationMs: Math.max(...durations),
    avgPeakRssBytes: average(peaks),
    allRunsRowParity: rowParity,
    allRunsBatchParity: batchParity,
    bridgeMetrics,
  };
}

async function withWasmFetchOverride<T>(fn: () => Promise<T>): Promise<T> {
  const wasmPath = path.resolve(process.cwd(), 'packages/readstat-wasm/dist/readstat.wasm');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (href.endsWith('/readstat.wasm') || href.endsWith('readstat.wasm')) {
      const wasm = await fs.readFile(wasmPath);
      return new Response(wasm, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      });
    }

    if (!originalFetch) {
      throw new Error(`Unhandled fetch URL in benchmark: ${href}`);
    }
    return originalFetch(input as any, init);
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function benchmarkDataset(
  key: string,
  filePath: string,
  iterations: number,
  batchSize: number,
): Promise<DatasetBenchmark> {
  const stat = await fs.stat(filePath);
  const data = await fs.readFile(filePath);
  const buffer = asArrayBuffer(data);

  const scenarioNames: ScenarioName[] = ['v2_parse_only', 'v3_parse_only', 'v2_vectorize', 'v3_vectorize'];

  const scenarios: Partial<Record<ScenarioName, ScenarioAggregate>> = {};

  for (const scenario of scenarioNames) {
    const runs: Measurement<ScenarioRunResult>[] = [];
    for (let i = 0; i < iterations; i++) {
      const measurement = await measure(() => runScenario(scenario, buffer, batchSize));
      runs.push(measurement);
    }
    scenarios[scenario] = aggregateScenario(runs);
  }

  const v2Parse = scenarios.v2_parse_only!;
  const v3Parse = scenarios.v3_parse_only!;
  const v2Vector = scenarios.v2_vectorize!;
  const v3Vector = scenarios.v3_vectorize!;

  return {
    key,
    filePath,
    fileSizeBytes: stat.size,
    batchSize,
    iterations,
    scenarios: scenarios as Record<ScenarioName, ScenarioAggregate>,
    winners: {
      parseOnlyByAvgDuration: pickWinner(v2Parse.avgDurationMs, v3Parse.avgDurationMs),
      vectorizeByAvgDuration: pickWinner(v2Vector.avgDurationMs, v3Vector.avgDurationMs),
      parseOnlyByAvgPeakRss: pickWinner(v2Parse.avgPeakRssBytes, v3Parse.avgPeakRssBytes),
      vectorizeByAvgPeakRss: pickWinner(v2Vector.avgPeakRssBytes, v3Vector.avgPeakRssBytes),
    },
  };
}

async function main(): Promise<void> {
  const { outputPath, iterations, batchSize } = parseArgs(process.argv.slice(2));

  const datasets: DatasetBenchmark[] = [];
  const skipped: Array<{ key: string; filePath: string; reason: string }> = [];
  const failures: Array<{ key: string; filePath: string; reason: string }> = [];

  await withWasmFetchOverride(async () => {
    for (const dataset of DATASETS) {
      try {
        await fs.access(dataset.filePath);
      } catch {
        skipped.push({ key: dataset.key, filePath: dataset.filePath, reason: 'file not found' });
        continue;
      }

      console.log(`\n[benchmark-v2v3] Running ${dataset.key} (${dataset.filePath})`);
      try {
        const result = await benchmarkDataset(dataset.key, dataset.filePath, iterations, batchSize);
        datasets.push(result);

        const w = result.winners;
        console.log(
          `[benchmark-v2v3] ${dataset.key} winners: ` +
            `parse-time=${w.parseOnlyByAvgDuration}, vector-time=${w.vectorizeByAvgDuration}, ` +
            `parse-rss=${w.parseOnlyByAvgPeakRss}, vector-rss=${w.vectorizeByAvgPeakRss}`,
        );
      } catch (error: any) {
        const reason = error?.message || String(error);
        failures.push({ key: dataset.key, filePath: dataset.filePath, reason });
        console.warn(`[benchmark-v2v3] FAILED ${dataset.key}: ${reason}`);
      }
    }
  });

  const output: BenchmarkOutput = {
    generatedAt: new Date().toISOString(),
    config: {
      iterations,
      batchSize,
      v3InitialCredits: V3_INITIAL_CREDITS,
      v3MaxCredits: V3_MAX_CREDITS,
    },
    datasets,
    skipped,
    failures,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n[benchmark-v2v3] Wrote results to ${outputPath}`);
}

main().catch((error) => {
  console.error('[benchmark-v2v3] FAILED:', error);
  process.exitCode = 1;
});
