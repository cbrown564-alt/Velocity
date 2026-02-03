/**
 * ArrowChunkBuilder
 *
 * Memory-efficient Arrow table builder that accumulates rows in chunks
 * and produces RecordBatch objects for streaming insertion into DuckDB.
 *
 * This enables loading large SAV files without holding all rows in memory
 * at once - each chunk is inserted into DuckDB and then freed.
 */

import * as arrow from 'apache-arrow';

export interface VariableMetadata {
  name: string;
  type: 'numeric' | 'string';
}

/**
 * Builds Arrow RecordBatches incrementally from rows.
 * Column-major accumulation for efficiency.
 */
export class ArrowChunkBuilder {
  private readonly chunkSize: number;
  private readonly variables: VariableMetadata[];
  private readonly numCols: number;

  // Column-major storage for current chunk
  private columns: (number | string | null)[][];
  private rowCount: number = 0;
  private totalRowsProcessed: number = 0;

  constructor(variables: VariableMetadata[], chunkSize: number = 10000) {
    this.variables = variables;
    this.chunkSize = chunkSize;
    this.numCols = variables.length;
    this.columns = this.createEmptyColumns();
  }

  private createEmptyColumns(): (number | string | null)[][] {
    return Array.from({ length: this.numCols }, () => []);
  }

  /**
   * Add a row to the builder.
   * Returns a RecordBatch if the chunk is full, otherwise null.
   */
  addRow(row: (number | string | null)[]): arrow.RecordBatch | null {
    // Add values to column arrays
    for (let c = 0; c < this.numCols; c++) {
      this.columns[c].push(row[c] ?? null);
    }
    this.rowCount++;
    this.totalRowsProcessed++;

    // Check if chunk is full
    if (this.rowCount >= this.chunkSize) {
      return this.buildAndReset();
    }

    return null;
  }

  /**
   * Build RecordBatch from accumulated rows and reset for next chunk.
   */
  private buildAndReset(): arrow.RecordBatch {
    const batch = this.buildRecordBatch();
    this.columns = this.createEmptyColumns();
    this.rowCount = 0;
    return batch;
  }

  /**
   * Build an Arrow RecordBatch from the accumulated columns.
   */
  private buildRecordBatch(): arrow.RecordBatch {
    const vectors: Record<string, arrow.Vector> = {};

    for (let i = 0; i < this.numCols; i++) {
      const meta = this.variables[i];
      const data = this.columns[i];

      if (meta.type === 'numeric') {
        vectors[meta.name] = arrow.vectorFromArray(data as (number | null)[], new arrow.Float64());
      } else {
        vectors[meta.name] = arrow.vectorFromArray(data as (string | null)[], new arrow.Utf8());
      }
    }

    const table = new arrow.Table(vectors);
    // Table with single batch - get the first RecordBatch
    const batches = table.batches;
    if (batches.length === 0) {
      throw new Error('Failed to create RecordBatch: no batches produced');
    }
    return batches[0];
  }

  /**
   * Flush any remaining rows as a final RecordBatch.
   * Returns null if no rows are pending.
   */
  flush(): arrow.RecordBatch | null {
    if (this.rowCount === 0) {
      return null;
    }
    return this.buildAndReset();
  }

  /**
   * Get the total number of rows processed so far.
   */
  getTotalRowsProcessed(): number {
    return this.totalRowsProcessed;
  }

  /**
   * Get the number of rows in the current (unflushed) chunk.
   */
  getPendingRowCount(): number {
    return this.rowCount;
  }

  /**
   * Get the configured chunk size.
   */
  getChunkSize(): number {
    return this.chunkSize;
  }
}
