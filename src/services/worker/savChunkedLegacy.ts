import * as arrow from 'apache-arrow';
import type { Variable, VariableSet } from '../../types';
import { processMetadata } from '../../core/ingestion/savLoader';
import {
  buildEmptyVectorsFromMetadata,
  buildVectorsFromBatch,
  DEFAULT_CHUNK_SIZE,
  type SavColumnMetadata,
} from './savArrowHelpers';
import type { SavLoadProgressReporter } from './loadProgress';
import { workerDbState } from './workerDbState';

/**
 * Legacy chunked parser path (parseSavStreaming).
 * Gated by ENABLE_SAV_STREAMING_LEGACY until deleted.
 */
export async function loadSAVChunkedLegacy(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  onProgress?: SavLoadProgressReporter,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);

  console.log(`🦆 [Worker] Starting legacy streaming SAV load: ${fileSizeMb.toFixed(1)} MB, chunk size ${chunkSize}`);

  onProgress?.({
    phase: 'parsing',
    progress: 0,
    message: `Starting to parse ${fileSizeMb.toFixed(1)} MB file...`,
  });

  const { parseSavStreaming } = await import('@velocity/readstat-wasm');

  let variableMetadata: SavColumnMetadata[] = [];
  let isFirstChunk = true;
  let totalRowsInserted = 0;
  let chunksInserted = 0;
  let streamingError: Error | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreaming(buffer, chunkSize, async (batch) => {
    if (variableMetadata.length === 0) {
      const vars = batch.variables || [];
      if (vars.length > 0) {
        variableMetadata = vars.map((v) => ({ name: v.name, type: v.type }));
      } else {
        const numCols = batch.rows[0]?.length ?? 0;
        for (let c = 0; c < numCols; c++) {
          let isNumeric = true;
          for (const row of batch.rows) {
            if (row[c] !== null) {
              isNumeric = typeof row[c] === 'number';
              break;
            }
          }
          variableMetadata.push({
            name: `col_${c}`,
            type: isNumeric ? 'numeric' : 'string',
          });
        }
      }
    }

    if (batch.rows.length === 0) return;

    try {
      const numRows = batch.rows.length;

      const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
      await conn.insertArrowTable(table, { name: 'main', create: isFirstChunk });
      isFirstChunk = false;
      totalRowsInserted += numRows;
      chunksInserted++;

      const progressPct = Math.round(batch.progress * 100);
      if (chunksInserted % 5 === 0 || progressPct >= 99) {
        console.log(
          `📊 [Worker] Legacy chunk ${chunksInserted}: ${totalRowsInserted}/${batch.totalRows} rows (${progressPct}%)`,
        );
        onProgress?.({
          phase: 'inserting',
          progress: batch.progress,
          rowsProcessed: totalRowsInserted,
          totalRows: batch.totalRows,
          message: `Loaded ${totalRowsInserted.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows...`,
        });
      }
    } catch (err: any) {
      console.error(`🦆 [Worker] Legacy chunk insertion failed at rows ${batch.startRow}-${batch.endRow}:`, err);
      streamingError = err;
      throw err;
    }
  });

  if (streamingError) {
    throw streamingError;
  }

  if (totalRowsInserted === 0) {
    const emptyVectors = buildEmptyVectorsFromMetadata(
      streamingResult.metadata.variables.map((v) => ({ name: v.name, type: v.type })),
    );
    const emptyTable = new arrow.Table(emptyVectors);
    await conn.insertArrowTable(emptyTable, { name: 'main', create: true });
  }

  const realVariableNames = streamingResult.metadata.variables.map((v) => v.name);
  for (let i = 0; i < Math.min(variableMetadata.length, realVariableNames.length); i++) {
    const oldName = variableMetadata[i].name;
    const newName = realVariableNames[i];
    if (oldName !== newName) {
      try {
        const escapedOld = oldName.replace(/"/g, '""');
        const escapedNew = newName.replace(/"/g, '""');
        await conn.query(`ALTER TABLE main RENAME COLUMN "${escapedOld}" TO "${escapedNew}"`);
      } catch (renameError) {
        console.warn(`🦆 [Worker] Could not rename column ${oldName} to ${newName}:`, renameError);
      }
    }
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

  if (count !== totalRowsInserted) {
    console.warn(`🦆 [Worker] Row count mismatch: inserted ${totalRowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV (legacy streaming): ${streamingResult.metadata.rowCount} rows in ${chunksInserted} chunks, ${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms`,
  );
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
