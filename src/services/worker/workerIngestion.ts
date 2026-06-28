import * as arrow from 'apache-arrow';
import type { Variable, VariableSet } from '../../types';
import { processMetadata } from '../../core/ingestion/savLoader';
import { escapeString } from '../../core/sql/queryBuilder';
import { CHUNKED_THRESHOLD_BYTES } from './savArrowHelpers';
import { loadSAVChunked } from './savChunkedLoader';
import type { SavLoadProgressReporter } from './loadProgress';
import { getSchema } from './workerQueries';
import { workerDbState } from './workerDbState';

export async function loadCSV(
  fileName: string,
  content: string,
): Promise<{ schema: { name: string; type: string }[]; rowCount: number; durationMs: number }> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  await db.registerFileText(fileName, content);
  const safeFileName = escapeString(fileName);
  await conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${safeFileName}')`);

  const schema = await getSchema();
  const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const rowCount = Number(countResult.toArray()[0]?.cnt);

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded CSV: ${rowCount} rows, ${schema.length} columns in ${durationMs.toFixed(2)}ms`);

  return { schema, rowCount, durationMs };
}

export async function loadSAV(
  buffer: ArrayBuffer,
  forceChunked?: boolean,
  onProgress?: SavLoadProgressReporter,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const { db, conn } = workerDbState;
  if (!db || !conn) throw new Error('DB not initialized');

  if (forceChunked || buffer.byteLength > CHUNKED_THRESHOLD_BYTES) {
    console.log(
      `🦆 [Worker] Auto-routing to chunked mode (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB > ${CHUNKED_THRESHOLD_BYTES / 1024 / 1024} MB threshold)`,
    );
    return loadSAVChunked(buffer, undefined, onProgress);
  }

  const start = performance.now();

  onProgress?.({
    phase: 'parsing',
    progress: 0,
    message: 'Reading SAV metadata...',
  });

  const { parseSavFile } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavFile(buffer, (progress) => {
    const boundedProgress = Math.max(0, Math.min(progress.progress, 0.7));
    onProgress?.({
      phase: 'parsing',
      progress: boundedProgress,
      message: `Parsing variables (${Math.round(progress.progress * 100)}%)...`,
    });
    console.log(`📊 [Worker] Parse progress: ${(progress.progress * 100).toFixed(1)}%`);
  });

  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  const numRows = parsed.rows.length;
  const numCols = parsed.metadata.variables.length;

  if (numRows === 0) {
    throw new Error(`SAV parsing failed: No row data extracted (expected ${parsed.metadata.rowCount} rows)`);
  }

  const columnsData: any[][] = Array.from({ length: numCols }, () => new Array(numRows));
  for (let r = 0; r < numRows; r++) {
    const row = parsed.rows[r];
    for (let c = 0; c < numCols; c++) {
      columnsData[c][r] = row[c];
    }
    (parsed.rows as any)[r] = null;
  }
  (parsed as any).rows = [];

  const vectors: Record<string, arrow.Vector> = {};
  parsed.metadata.variables.forEach((v, i) => {
    const data = columnsData[i];
    if (v.type === 'numeric') {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Float64());
    } else {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Utf8());
    }
  });

  const table = new arrow.Table(vectors);

  await conn.query(`DROP TABLE IF EXISTS main`);
  onProgress?.({
    phase: 'inserting',
    progress: 0.8,
    totalRows: numRows,
    message: 'Building index...',
  });

  try {
    await conn.insertArrowTable(table, { name: 'main', create: true });

    const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const count = Number(verifyResult.toArray()[0]?.cnt);

    if (count !== numRows) {
      throw new Error(`Arrow insertion verification failed: expected ${numRows} rows, got ${count}`);
    }
  } catch (insertError: any) {
    throw new Error(`Arrow insertion failed: ${insertError.message}. Check apache-arrow version compatibility.`);
  }

  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`,
  );
  onProgress?.({
    phase: 'complete',
    progress: 1,
    rowsProcessed: parsed.metadata.rowCount,
    totalRows: parsed.metadata.rowCount,
    message: `Loaded ${parsed.metadata.rowCount.toLocaleString()} rows successfully`,
  });

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, durationMs };
}

export async function loadSAVMetadata(
  buffer: ArrayBuffer,
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const start = performance.now();

  const { parseSavMetadata } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavMetadata(buffer);

  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: [],
  });

  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV metadata: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`,
  );

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, durationMs };
}

export async function loadSAVSample(
  buffer: ArrayBuffer,
  rowLimit: number,
  strategy: 'sequential' | 'spread' = 'sequential',
): Promise<{
  variables: Variable[];
  variableSets: VariableSet[];
  rowCount: number;
  sampleRowCount: number;
  sampleStrategy: 'sequential' | 'spread';
  durationMs: number;
}> {
  const start = performance.now();

  const { parseSavSample } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavSample(buffer, rowLimit, strategy);

  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  const usedStrategy = parsed.sampleStrategy || strategy;
  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV sample: ${parsed.rows.length}/${parsed.metadata.rowCount} rows (${usedStrategy}), ${variables.length} variables in ${durationMs.toFixed(2)}ms`,
  );

  return {
    variables,
    variableSets,
    rowCount: parsed.metadata.rowCount,
    sampleRowCount: parsed.rows.length,
    sampleStrategy: usedStrategy,
    durationMs,
  };
}
