import * as arrow from 'apache-arrow';
import type { Variable, VariableSet } from '../../types';
import { processMetadata } from '../../core/ingestion/savLoader';
import { isWriteModeCommitError } from './duckdbPersistence';
import { loadSAVChunkedLegacy } from './savChunkedLegacy';
import {
  buildEmptyVectorsFromMetadata,
  buildVectorsFromBatch,
  CHUNK_DOWNSHIFT_FACTOR,
  CHUNK_UPSHIFT_FACTOR,
  clampChunkSize,
  DEFAULT_CHUNK_SIZE,
  ENABLE_SAV_STREAMING_LEGACY,
  ENABLE_SAV_STREAMING_V3_SINGLE_PASS,
  FAST_BATCH_MS,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  type SavColumnMetadata,
  SLOW_BATCH_MS,
  STREAMING_ROUTE_THRESHOLD_BYTES,
  V3_INITIAL_CREDITS,
  V3_MAX_CREDITS,
} from './savArrowHelpers';
import type { SavLoadProgressReporter } from './loadProgress';
import { workerDbState } from './workerDbState';

type SavLoadResult = {
  variables: Variable[];
  variableSets: VariableSet[];
  rowCount: number;
  durationMs: number;
};

type SavStreamingMode = 'v3-single-pass' | 'v2';

type SavStreamingBatch = {
  variables?: Array<{ name: string; type: 'numeric' | 'string' }>;
  rows: (number | string | null)[][];
  progress: number;
  totalRows: number;
};

type SavStreamingMetadata = {
  variables: Parameters<typeof processMetadata>[0]['metadata']['variables'];
  valueLabelSets: Parameters<typeof processMetadata>[0]['metadata']['valueLabelSets'];
  multipleResponseSets: Parameters<typeof processMetadata>[0]['metadata']['multipleResponseSets'];
  rowCount: number;
};

type SavStreamingBridgeStats = {
  maxQueueDepth: number;
  producedBatches: number;
  consumedBatches: number;
};

const STREAMING_MODE_LABELS: Record<SavStreamingMode, string> = {
  'v3-single-pass': 'single-pass v3',
  v2: 'streaming v2',
};

export async function loadSAVChunked(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  onProgress?: SavLoadProgressReporter,
): Promise<SavLoadResult> {
  const shouldStream = buffer.byteLength >= STREAMING_ROUTE_THRESHOLD_BYTES;

  if (shouldStream && ENABLE_SAV_STREAMING_V3_SINGLE_PASS) {
    try {
      return await loadSAVChunkedStreaming(buffer, chunkSize, 'v3-single-pass', onProgress);
    } catch (error: unknown) {
      if (isWriteModeCommitError(error)) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`🦆 [Worker] V3 single-pass load failed (${message}); falling back to v2 path`);
    }
  }

  if (shouldStream) {
    try {
      return await loadSAVChunkedStreaming(buffer, chunkSize, 'v2', onProgress);
    } catch (error: unknown) {
      if (isWriteModeCommitError(error)) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`🦆 [Worker] V2 chunked load failed (${message}); falling back to legacy chunked path`);
    }
  }

  if (ENABLE_SAV_STREAMING_LEGACY) {
    return loadSAVChunkedLegacy(buffer, chunkSize, onProgress);
  }

  return loadSAVChunkedStreaming(buffer, chunkSize, 'v3-single-pass', onProgress);
}

async function runSavStreamingParser(
  buffer: ArrayBuffer,
  mode: SavStreamingMode,
  initialChunkSize: number,
  onBatch: (batch: SavStreamingBatch) => Promise<number>,
): Promise<{ metadata: SavStreamingMetadata; bridge?: SavStreamingBridgeStats }> {
  if (mode === 'v3-single-pass') {
    const { parseSavStreamingSinglePassBridge } = await import('@velocity/readstat-wasm');
    const result = await parseSavStreamingSinglePassBridge(
      buffer,
      {
        batchSize: initialChunkSize,
        initialCredits: V3_INITIAL_CREDITS,
        maxCredits: V3_MAX_CREDITS,
      },
      onBatch,
    );
    return { metadata: result.metadata, bridge: result.bridge };
  }

  const { parseSavStreamingV2 } = await import('@velocity/readstat-wasm');
  const result = await parseSavStreamingV2(buffer, initialChunkSize, onBatch);
  return { metadata: result.metadata };
}

async function loadSAVChunkedStreaming(
  buffer: ArrayBuffer,
  chunkSize: number,
  mode: SavStreamingMode,
  onProgress?: SavLoadProgressReporter,
): Promise<SavLoadResult> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  const modeLabel = STREAMING_MODE_LABELS[mode];
  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);
  let activeChunkSize = clampChunkSize(chunkSize);
  let rowsInserted = 0;
  let chunksInserted = 0;

  const startMessage =
    mode === 'v3-single-pass'
      ? `Starting single-pass parse bridge for ${fileSizeMb.toFixed(1)} MB file...`
      : `Starting bounded-memory parse for ${fileSizeMb.toFixed(1)} MB file...`;

  const startLog =
    mode === 'v3-single-pass'
      ? `🦆 [Worker] Starting single-pass SAV load v3: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}, credits ${V3_INITIAL_CREDITS}/${V3_MAX_CREDITS}`
      : `🦆 [Worker] Starting streaming SAV load v2: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}`;

  console.log(startLog);
  onProgress?.({
    phase: 'parsing',
    progress: 0,
    message: startMessage,
  });

  let variableMetadata: SavColumnMetadata[] | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await runSavStreamingParser(buffer, mode, activeChunkSize, async (batch) => {
    if (!variableMetadata) {
      const vars = batch.variables || [];
      if (vars.length === 0) {
        throw new Error(`Streaming ${mode} did not provide variable metadata in the first batch`);
      }
      variableMetadata = vars.map((v) => ({ name: v.name, type: v.type }));
    }

    if (batch.rows.length === 0) {
      return activeChunkSize;
    }

    const insertStart = performance.now();
    const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
    await conn.insertArrowTable(table, { name: 'main', create: chunksInserted === 0 });
    chunksInserted++;
    rowsInserted += batch.rows.length;

    const batchMs = performance.now() - insertStart;
    const progressPct = Math.round(batch.progress * 100);
    if (chunksInserted % 5 === 0 || progressPct >= 99) {
      const chunkLabel = mode === 'v3-single-pass' ? 'V3' : 'V2';
      console.log(
        `📊 [Worker] ${chunkLabel} chunk ${chunksInserted}: ${rowsInserted}/${batch.totalRows} rows (${progressPct}%), ${batchMs.toFixed(0)}ms`,
      );
      onProgress?.({
        phase: 'inserting',
        progress: batch.progress,
        rowsProcessed: rowsInserted,
        totalRows: batch.totalRows,
        message: `Loaded ${rowsInserted.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows...`,
      });
    }

    if (batchMs > SLOW_BATCH_MS && activeChunkSize > MIN_CHUNK_SIZE) {
      activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_DOWNSHIFT_FACTOR);
    } else if (batchMs < FAST_BATCH_MS && activeChunkSize < MAX_CHUNK_SIZE) {
      activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_UPSHIFT_FACTOR);
    }

    return activeChunkSize;
  });

  if (rowsInserted === 0) {
    const emptyVectors = buildEmptyVectorsFromMetadata(
      streamingResult.metadata.variables.map((v) => ({ name: v.name, type: v.type })),
    );
    const emptyTable = new arrow.Table(emptyVectors);
    await conn.insertArrowTable(emptyTable, { name: 'main', create: true });
  }

  const processedMeta = processMetadata({
    metadata: {
      variables: streamingResult.metadata.variables,
      valueLabelSets: streamingResult.metadata.valueLabelSets,
      multipleResponseSets: streamingResult.metadata.multipleResponseSets,
      rowCount: streamingResult.metadata.rowCount,
    },
    rows: [],
  });

  onProgress?.({
    phase: 'verifying',
    progress: 0.99,
    rowsProcessed: rowsInserted,
    totalRows: streamingResult.metadata.rowCount,
    message: 'Verifying data integrity...',
  });

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);
  if (count !== rowsInserted) {
    throw new Error(`Streaming ${mode} row mismatch: inserted ${rowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  const bridge = streamingResult.bridge;
  const completionLog = bridge
    ? `🦆 [Worker] Loaded SAV (${modeLabel}): ${count} rows in ${chunksInserted} chunks, ` +
      `${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms ` +
      `(bridge queue max ${bridge.maxQueueDepth}, produced ${bridge.producedBatches}, consumed ${bridge.consumedBatches})`
    : `🦆 [Worker] Loaded SAV (${modeLabel}): ${count} rows in ${chunksInserted} chunks, ${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms`;

  console.log(completionLog);
  onProgress?.({
    phase: 'complete',
    progress: 1,
    rowsProcessed: count,
    totalRows: streamingResult.metadata.rowCount,
    message: `Loaded ${count.toLocaleString()} rows successfully`,
  });

  return {
    variables: processedMeta.variables,
    variableSets: processedMeta.variableSets,
    rowCount: streamingResult.metadata.rowCount,
    durationMs,
  };
}
