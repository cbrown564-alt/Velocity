/**
 * ArrowChunkBuilder Tests
 */

import { describe, it, expect } from 'vitest';
import { ArrowChunkBuilder, VariableMetadata } from './arrowChunkBuilder';

describe('ArrowChunkBuilder', () => {
  const testVariables: VariableMetadata[] = [
    { name: 'id', type: 'numeric' },
    { name: 'name', type: 'string' },
    { name: 'value', type: 'numeric' },
  ];

  it('should create builder with correct configuration', () => {
    const builder = new ArrowChunkBuilder(testVariables, 100);
    expect(builder.getChunkSize()).toBe(100);
    expect(builder.getTotalRowsProcessed()).toBe(0);
    expect(builder.getPendingRowCount()).toBe(0);
  });

  it('should accumulate rows without producing batch before chunk size', () => {
    const builder = new ArrowChunkBuilder(testVariables, 5);

    for (let i = 0; i < 4; i++) {
      const batch = builder.addRow([i, `name${i}`, i * 10]);
      expect(batch).toBeNull();
    }

    expect(builder.getPendingRowCount()).toBe(4);
    expect(builder.getTotalRowsProcessed()).toBe(4);
  });

  it('should produce RecordBatch when chunk size is reached', () => {
    const builder = new ArrowChunkBuilder(testVariables, 3);

    // Add rows up to chunk size
    expect(builder.addRow([1, 'a', 10])).toBeNull();
    expect(builder.addRow([2, 'b', 20])).toBeNull();
    const batch = builder.addRow([3, 'c', 30]);

    expect(batch).not.toBeNull();
    expect(batch!.numRows).toBe(3);
    expect(batch!.numCols).toBe(3);

    // Builder should be reset
    expect(builder.getPendingRowCount()).toBe(0);
    expect(builder.getTotalRowsProcessed()).toBe(3);
  });

  it('should handle multiple chunks correctly', () => {
    const builder = new ArrowChunkBuilder(testVariables, 2);
    const batches: any[] = [];

    for (let i = 0; i < 7; i++) {
      const batch = builder.addRow([i, `name${i}`, i * 10]);
      if (batch) {
        batches.push(batch);
      }
    }

    // Should have produced 3 batches (2+2+2 rows), with 1 pending
    expect(batches.length).toBe(3);
    expect(builder.getPendingRowCount()).toBe(1);
    expect(builder.getTotalRowsProcessed()).toBe(7);

    // Flush the remaining row
    const finalBatch = builder.flush();
    expect(finalBatch).not.toBeNull();
    expect(finalBatch!.numRows).toBe(1);
  });

  it('should return null when flushing empty builder', () => {
    const builder = new ArrowChunkBuilder(testVariables, 10);
    expect(builder.flush()).toBeNull();
  });

  it('should flush partial chunk correctly', () => {
    const builder = new ArrowChunkBuilder(testVariables, 10);

    builder.addRow([1, 'test', 100]);
    builder.addRow([2, 'test2', 200]);

    const batch = builder.flush();
    expect(batch).not.toBeNull();
    expect(batch!.numRows).toBe(2);
    expect(builder.getPendingRowCount()).toBe(0);
  });

  it('should handle null values correctly', () => {
    const builder = new ArrowChunkBuilder(testVariables, 2);

    builder.addRow([1, null, 10]);
    const batch = builder.addRow([null, 'name', null]);

    expect(batch).not.toBeNull();
    expect(batch!.numRows).toBe(2);
  });

  it('should preserve data integrity across chunks', () => {
    const builder = new ArrowChunkBuilder(testVariables, 3);
    const allBatches: any[] = [];

    // Add 10 rows
    for (let i = 0; i < 10; i++) {
      const batch = builder.addRow([i, `name_${i}`, i * 100]);
      if (batch) allBatches.push(batch);
    }

    // Flush remaining
    const finalBatch = builder.flush();
    if (finalBatch) allBatches.push(finalBatch);

    // Should have 4 batches: 3+3+3+1
    expect(allBatches.length).toBe(4);
    expect(allBatches[0].numRows).toBe(3);
    expect(allBatches[1].numRows).toBe(3);
    expect(allBatches[2].numRows).toBe(3);
    expect(allBatches[3].numRows).toBe(1);

    // Total rows
    const totalRows = allBatches.reduce((sum, b) => sum + b.numRows, 0);
    expect(totalRows).toBe(10);
    expect(builder.getTotalRowsProcessed()).toBe(10);
  });

  it('should create batches with correct column names', () => {
    const builder = new ArrowChunkBuilder(testVariables, 2);

    builder.addRow([1, 'test', 100]);
    const batch = builder.addRow([2, 'test2', 200]);

    expect(batch).not.toBeNull();
    const schema = batch!.schema;
    expect(schema.fields.map((f) => f.name)).toEqual(['id', 'name', 'value']);
  });
});
