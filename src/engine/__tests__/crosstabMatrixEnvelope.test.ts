import { describe, expect, it } from 'vitest';
import { formatCrosstabMatrix } from '../../core/analysis/formatCrosstabMatrix';
import type { ResultEnvelope } from '../types';

function buildMatrixCrosstabEnvelope(
  longRows: Record<string, unknown>[],
  config: { weightVar?: string | null },
  baseMetadata: { isWeighted?: boolean } = {},
  tableStats?: unknown
): ResultEnvelope<unknown> {
  const hasPerCallWeight = typeof config.weightVar === 'string' && config.weightVar.length > 0;
  const isWeighted = hasPerCallWeight || baseMetadata.isWeighted === true;
  const matrix = formatCrosstabMatrix(longRows, { isWeighted });

  return {
    data: {
      format: 'matrix',
      columns: matrix.columns,
      rows: matrix.rows,
      grandTotal: matrix.grandTotal,
      tableStats,
    },
    operation: 'runAnalysis:crosstab',
    inputs: {},
    durationMs: 1,
    warnings: [],
    metadata: {
      datasetName: 'test.sav',
      rowCount: 100,
      filtersApplied: 0,
      isWeighted,
      engineVersion: 'test',
    },
  };
}

describe('VelocityEngine crosstab matrix envelope', () => {
  it('shapes long rows into matrix data with column bases and percentages', () => {
    const envelope = buildMatrixCrosstabEnvelope(
      [
        { rowKey_0: 'Male', colKey: 'Brand A', count: 10 },
        { rowKey_0: 'Male', colKey: 'Brand B', count: 30 },
        { rowKey_0: 'Female', colKey: 'Brand A', count: 40 },
        { rowKey_0: 'Female', colKey: 'Brand B', count: 20 },
      ],
      {},
      { isWeighted: false },
      { chiSquare: { statistic: 5.4, df: 1, pValue: 0.02 } }
    );

    expect(envelope.data).toMatchObject({
      format: 'matrix',
      columns: [
        { key: 'Brand A', label: 'Brand A', base: 50 },
        { key: 'Brand B', label: 'Brand B', base: 50 },
      ],
    });
    expect((envelope.data as { rows: unknown[] }).rows).toHaveLength(2);
    expect(envelope.metadata?.isWeighted).toBe(false);
  });

  it('uses weighted counts when weightVar is supplied per call', () => {
    const envelope = buildMatrixCrosstabEnvelope(
      [
        { rowKey_0: 'Male', colKey: 'Brand A', count: 10, weightedCount: 100 },
        { rowKey_0: 'Female', colKey: 'Brand A', count: 40, weightedCount: 100 },
      ],
      { weightVar: 'WEIGHT' },
      { isWeighted: false }
    );

    expect(envelope.metadata?.isWeighted).toBe(true);
    expect((envelope.data as { columns: { base: number }[] }).columns).toEqual([
      { key: 'Brand A', label: 'Brand A', base: 200 },
    ]);
  });
});
