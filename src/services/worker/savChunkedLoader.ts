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
  ENABLE_SAV_STREAMING_V2,
  ENABLE_SAV_STREAMING_V3_SINGLE_PASS,
  FAST_BATCH_MS,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  type SavColumnMetadata,
  SLOW_BATCH_MS,
  STREAMING_V2_HIGH_RISK_BYTES,
  STREAMING_V3_HIGH_RISK_BYTES,
  V3_INITIAL_CREDITS,
  V3_MAX_CREDITS,
} from './savArrowHelpers';
import { workerDbState } from './workerDbState';

export async function loadSAVChunked(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const useV3 = ENABLE_SAV_STREAMING_V3_SINGLE_PASS && buffer.byteLength >= STREAMING_V3_HIGH_RISK_BYTES;
  const useV2 = ENABLE_SAV_STREAMING_V2 && buffer.byteLength >= STREAMING_V2_HIGH_RISK_BYTES;

  if (useV3) {
    try {
      return await loadSAVChunkedV3SinglePass(buffer, chunkSize);
    } catch (error: any) {
      if (isWriteModeCommitError(error)) throw error;
      console.warn(`🦆 [Worker] V3 single-pass load failed (${error?.message || error}); falling back to v2 path`);
    }
  }

  if (useV2) {
    try {
      return await loadSAVChunkedV2(buffer, chunkSize);
    } catch (error: any) {
      if (isWriteModeCommitError(error)) throw error;
      console.warn(`🦆 [Worker] V2 chunked load failed (${error?.message || error}); falling back to legacy chunked path`);
    }
  }

  return loadSAVChunkedLegacy(buffer, chunkSize);
}

async function loadSAVChunkedV3SinglePass(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);
  let activeChunkSize = clampChunkSize(chunkSize);
  let rowsInserted = 0;
  let chunksInserted = 0;

  console.log(`🦆 [Worker] Starting single-pass SAV load v3: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}, credits ${V3_INITIAL_CREDITS}/${V3_MAX_CREDITS}`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'parsing',
    progress: 0,
    message: `Starting single-pass parse bridge for ${fileSizeMb.toFixed(1)} MB file...`,
  });

  const { parseSavStreamingSinglePassBridge } = await import('@velocity/readstat-wasm');
  let variableMetadata: SavColumnMetadata[] | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreamingSinglePassBridge(
    buffer,
    {
      batchSize: activeChunkSize,
      initialCredits: V3_INITIAL_CREDITS,
      maxCredits: V3_MAX_CREDITS,
    },
    async (batch) => {
      if (!variableMetadata) {
        const vars = batch.variables || [];
        if (vars.length === 0) {
          throw new Error('Streaming v3 did not provide variable metadata in the first batch');
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
        console.log(`📊 [Worker] V3 chunk ${chunksInserted}: ${rowsInserted}/${batch.totalRows} rows (${progressPct}%), ${batchMs.toFixed(0)}ms`);
        self.postMessage({
          type: 'loadProgress',
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
    },
  );

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

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);
  if (count !== rowsInserted) {
    throw new Error(`Streaming v3 row mismatch: inserted ${rowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV (single-pass v3): ${count} rows in ${chunksInserted} chunks, `
    + `${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms `
    + `(bridge queue max ${streamingResult.bridge.maxQueueDepth}, produced ${streamingResult.bridge.producedBatches}, consumed ${streamingResult.bridge.consumedBatches})`,
  );
  self.postMessage({
    type: 'loadProgress',
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

async function loadSAVChunkedV2(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);
  let activeChunkSize = clampChunkSize(chunkSize);
  let rowsInserted = 0;
  let chunksInserted = 0;

  console.log(`🦆 [Worker] Starting streaming SAV load v2: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'parsing',
    progress: 0,
    message: `Starting bounded-memory parse for ${fileSizeMb.toFixed(1)} MB file...`,
  });

  const { parseSavStreamingV2 } = await import('@velocity/readstat-wasm');
  let variableMetadata: SavColumnMetadata[] | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreamingV2(buffer, activeChunkSize, async (batch) => {
    if (!variableMetadata) {
      const vars = batch.variables || [];
      if (vars.length === 0) {
        throw new Error('Streaming v2 did not provide variable metadata in the first batch');
      }
      variableMetadata = vars.map((v) => ({ name: v.name, type: v.type }));
    }

    if (batch.rows.length === 0) {
      return activeChunkSize;
    }

    const insertStart = performance.now();
    const numRows = batch.rows.length;
    const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
    await conn.insertArrowTable(table, { name: 'main', create: chunksInserted === 0 });
    chunksInserted++;
    rowsInserted += numRows;

    const batchMs = performance.now() - insertStart;
    const progressPct = Math.round(batch.progress * 100);
    if (chunksInserted % 5 === 0 || progressPct >= 99) {
      console.log(`📊 [Worker] V2 chunk ${chunksInserted}: ${rowsInserted}/${batch.totalRows} rows (${progressPct}%), ${batchMs.toFixed(0)}ms`);
      self.postMessage({
        type: 'loadProgress',
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

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);
  if (count !== rowsInserted) {
    throw new Error(`Streaming v2 row mismatch: inserted ${rowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV (streaming v2): ${count} rows in ${chunksInserted} chunks, ${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms`);
  self.postMessage({
    type: 'loadProgress',
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
