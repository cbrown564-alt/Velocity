import * as arrow from 'apache-arrow';

export const CHUNKED_THRESHOLD_BYTES = 50 * 1024 * 1024;
export const DEFAULT_CHUNK_SIZE = 5000;
export const MIN_CHUNK_SIZE = 500;
export const MAX_CHUNK_SIZE = 10000;
export const SLOW_BATCH_MS = 1200;
export const FAST_BATCH_MS = 350;
export const CHUNK_DOWNSHIFT_FACTOR = 0.7;
export const CHUNK_UPSHIFT_FACTOR = 1.2;

/** Canonical streaming path (v3 single-pass bridge). */
export const ENABLE_SAV_STREAMING_V3_SINGLE_PASS = true;
/** Legacy chunked parser; disable once v3 is fully validated in production. */
export const ENABLE_SAV_STREAMING_LEGACY = true;
export const V3_INITIAL_CREDITS = 2;
export const V3_MAX_CREDITS = 4;

export type SavColumnMetadata = { name: string; type: 'numeric' | 'string' };

export function clampChunkSize(size: number): number {
  const rounded = Math.floor(size);
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, rounded));
}

export function buildEmptyVectorsFromMetadata(
  variables: SavColumnMetadata[],
): Record<string, arrow.Vector> {
  const vectors: Record<string, arrow.Vector> = {};
  for (const variable of variables) {
    vectors[variable.name] = variable.type === 'numeric'
      ? arrow.vectorFromArray([], new arrow.Float64())
      : arrow.vectorFromArray([], new arrow.Utf8());
  }
  return vectors;
}

export function buildVectorsFromBatch(
  rows: (number | string | null)[][],
  variables: SavColumnMetadata[],
): Record<string, arrow.Vector> {
  const numRows = rows.length;
  const numCols = rows[0]?.length ?? 0;
  const vectors: Record<string, arrow.Vector> = {};

  for (let c = 0; c < numCols; c++) {
    const colData: (number | string | null)[] = new Array(numRows);
    for (let r = 0; r < numRows; r++) {
      colData[r] = rows[r][c];
    }

    const colMeta = variables[c];
    const colName = colMeta?.name || `col_${c}`;
    const isNumeric = colMeta?.type === 'numeric';

    vectors[colName] = isNumeric
      ? arrow.vectorFromArray(colData as (number | null)[], new arrow.Float64())
      : arrow.vectorFromArray(colData as (string | null)[], new arrow.Utf8());
  }

  return vectors;
}
