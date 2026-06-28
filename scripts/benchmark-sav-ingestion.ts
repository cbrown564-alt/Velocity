#!/usr/bin/env npx tsx
/**
 * SAV ingestion benchmark harness (Stage 0 gates for Pathway 3).
 *
 * Measures parser and ingestion timing + peak RSS on selected datasets.
 *
 * Usage:
 *   npx tsx scripts/benchmark-sav-ingestion.ts
 *   npx tsx scripts/benchmark-sav-ingestion.ts --output validation/benchmark_sav_ingestion_latest.json
 */

import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import { DuckDBNodeAdapter } from '../src/adapters/DuckDBNodeAdapter';

type ReadStatModule = {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _parse_sav: (bufferPtr: number, len: number) => number;
  _parse_sav_metadata: (bufferPtr: number, len: number) => number;
  _parse_sav_window?: (bufferPtr: number, len: number, rowOffset: number, rowLimit: number) => number;
  _get_row_count: () => number;
  _get_variable_count: () => number;
  _get_window_row_count?: () => number;
  _get_error_message: (errorCode: number) => number;
  _free_parse_results: () => void;
  UTF8ToString: (ptr: number) => string;
  writeArrayToMemory: (array: ArrayLike<number>, buffer: number) => void;
};

type ModuleFactory = (arg?: { wasmBinary?: Uint8Array }) => Promise<ReadStatModule>;

type Measurement<T> = {
  result: T;
  durationMs: number;
  peakRssBytes: number;
  startRssBytes: number;
  endRssBytes: number;
};

type DatasetResult = {
  key: string;
  filePath: string;
  fileSizeBytes: number;
  metadataParse: Measurement<{ rowCount: number; variableCount: number }>;
  fullParse: Measurement<{ rowCount: number; variableCount: number }>;
  windowParse: Measurement<{ rowCount: number; variableCount: number; chunkSize: number; windows: number }>;
  nodeIngestion: Measurement<{ rowCount: number; variableCount: number }>;
  parity: {
    metadataVsFullRows: boolean;
    metadataVsWindowRows: boolean;
    metadataVsNodeRows: boolean;
  };
};

const DATASETS = [
  { key: 'sleep', filePath: path.resolve(process.cwd(), 'test_data/sleep.sav') },
  { key: 'wvs7', filePath: path.resolve(process.cwd(), 'test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav') },
];

const DEFAULT_WINDOW_CHUNK_SIZE = 5000;
const RSS_POLL_MS = 25;

function parseArgs(argv: string[]): { outputPath: string } {
  const outputFlag = argv.find((arg) => arg.startsWith('--output='));
  const outputPath = outputFlag
    ? outputFlag.slice('--output='.length)
    : path.resolve(process.cwd(), 'validation/benchmark_sav_ingestion_latest.json');
  return { outputPath };
}

function asU8(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function throwReadStatError(mod: ReadStatModule, code: number): void {
  if (code === 0) return;
  const msg = mod.UTF8ToString(mod._get_error_message(code));
  throw new Error(`ReadStat error (${code}): ${msg}`);
}

async function loadReadStatModule(): Promise<ReadStatModule> {
  const moduleFactory = (await import('../packages/readstat-wasm/dist/readstat.js')).default as ModuleFactory;
  const wasmPath = path.resolve(process.cwd(), 'packages/readstat-wasm/dist/readstat.wasm');
  const wasmBinary = await fs.readFile(wasmPath);
  return moduleFactory({ wasmBinary: asU8(wasmBinary) });
}

async function measure<T>(fn: () => Promise<T>): Promise<Measurement<T>> {
  const startRssBytes = process.memoryUsage().rss;
  let peakRssBytes = startRssBytes;

  const interval = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peakRssBytes) {
      peakRssBytes = rss;
    }
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

async function runMetadataParse(
  mod: ReadStatModule,
  data: Buffer,
): Promise<{ rowCount: number; variableCount: number }> {
  const bytes = asU8(data);
  const ptr = mod._malloc(bytes.length);
  if (ptr === 0) throw new Error('Failed to allocate memory for metadata parse');

  mod.writeArrayToMemory(bytes, ptr);
  try {
    const code = mod._parse_sav_metadata(ptr, bytes.length);
    throwReadStatError(mod, code);
    const result = {
      rowCount: mod._get_row_count(),
      variableCount: mod._get_variable_count(),
    };
    mod._free_parse_results();
    return result;
  } finally {
    mod._free(ptr);
  }
}

async function runFullParse(mod: ReadStatModule, data: Buffer): Promise<{ rowCount: number; variableCount: number }> {
  const bytes = asU8(data);
  const ptr = mod._malloc(bytes.length);
  if (ptr === 0) throw new Error('Failed to allocate memory for full parse');

  mod.writeArrayToMemory(bytes, ptr);
  try {
    const code = mod._parse_sav(ptr, bytes.length);
    throwReadStatError(mod, code);
    const result = {
      rowCount: mod._get_row_count(),
      variableCount: mod._get_variable_count(),
    };
    mod._free_parse_results();
    return result;
  } finally {
    mod._free(ptr);
  }
}

async function runWindowParse(
  mod: ReadStatModule,
  data: Buffer,
  chunkSize: number,
): Promise<{ rowCount: number; variableCount: number; chunkSize: number; windows: number }> {
  if (!mod._parse_sav_window || !mod._get_window_row_count) {
    throw new Error('ReadStat build does not export window parsing APIs');
  }

  const bytes = asU8(data);
  const ptr = mod._malloc(bytes.length);
  if (ptr === 0) throw new Error('Failed to allocate memory for window parse');

  mod.writeArrayToMemory(bytes, ptr);

  try {
    const metadataCode = mod._parse_sav_metadata(ptr, bytes.length);
    throwReadStatError(mod, metadataCode);

    const totalRows = mod._get_row_count();
    const variableCount = mod._get_variable_count();
    mod._free_parse_results();

    let offset = 0;
    let parsedRows = 0;
    let windows = 0;

    while (offset < totalRows) {
      const windowLimit = Math.min(chunkSize, totalRows - offset);
      const code = mod._parse_sav_window(ptr, bytes.length, offset, windowLimit);
      throwReadStatError(mod, code);

      const windowRows = mod._get_window_row_count();
      mod._free_parse_results();

      if (windowRows <= 0) {
        throw new Error(`Window parse returned zero rows at offset ${offset}`);
      }

      parsedRows += windowRows;
      offset += windowRows;
      windows += 1;
    }

    return {
      rowCount: parsedRows,
      variableCount,
      chunkSize,
      windows,
    };
  } finally {
    mod._free(ptr);
  }
}

async function runNodeIngestion(filePath: string): Promise<{ rowCount: number; variableCount: number }> {
  const adapter = await DuckDBNodeAdapter.create();
  try {
    const result = await adapter.loadSav(filePath);
    return {
      rowCount: result.rowCount,
      variableCount: result.variables.length,
    };
  } finally {
    await adapter.close();
  }
}

async function benchmarkDataset(mod: ReadStatModule, key: string, filePath: string): Promise<DatasetResult> {
  const stat = await fs.stat(filePath);
  const data = await fs.readFile(filePath);

  const metadataParse = await measure(() => runMetadataParse(mod, data));
  const fullParse = await measure(() => runFullParse(mod, data));
  const windowParse = await measure(() => runWindowParse(mod, data, DEFAULT_WINDOW_CHUNK_SIZE));
  const nodeIngestion = await measure(() => runNodeIngestion(filePath));

  return {
    key,
    filePath,
    fileSizeBytes: stat.size,
    metadataParse,
    fullParse,
    windowParse,
    nodeIngestion,
    parity: {
      metadataVsFullRows: metadataParse.result.rowCount === fullParse.result.rowCount,
      metadataVsWindowRows: metadataParse.result.rowCount === windowParse.result.rowCount,
      metadataVsNodeRows: metadataParse.result.rowCount === nodeIngestion.result.rowCount,
    },
  };
}

async function main(): Promise<void> {
  const { outputPath } = parseArgs(process.argv.slice(2));
  const mod = await loadReadStatModule();

  const results: DatasetResult[] = [];
  const skipped: Array<{ key: string; filePath: string; reason: string }> = [];
  const failures: Array<{ key: string; filePath: string; reason: string }> = [];

  for (const dataset of DATASETS) {
    try {
      await fs.access(dataset.filePath);
    } catch {
      skipped.push({ key: dataset.key, filePath: dataset.filePath, reason: 'file not found' });
      continue;
    }

    console.log(`\n[benchmark] Running ${dataset.key} (${dataset.filePath})`);
    try {
      const result = await benchmarkDataset(mod, dataset.key, dataset.filePath);
      results.push(result);

      console.log(
        `[benchmark] ${dataset.key}: metadata ${result.metadataParse.durationMs.toFixed(1)}ms, ` +
          `full ${result.fullParse.durationMs.toFixed(1)}ms, ` +
          `window ${result.windowParse.durationMs.toFixed(1)}ms, ` +
          `ingest ${result.nodeIngestion.durationMs.toFixed(1)}ms`,
      );
    } catch (error: any) {
      const reason = error?.message || String(error);
      failures.push({ key: dataset.key, filePath: dataset.filePath, reason });
      console.warn(`[benchmark] FAILED ${dataset.key}: ${reason}`);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    datasets: results,
    skipped,
    failures,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`\n[benchmark] Wrote results to ${outputPath}`);
}

main().catch((error) => {
  console.error('[benchmark] FAILED:', error);
  process.exitCode = 1;
});
