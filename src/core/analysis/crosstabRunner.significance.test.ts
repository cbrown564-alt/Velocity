import { describe, expect, it } from 'vitest';
import { runCrosstab } from './crosstabRunner';
import type { DatabaseAdapter, QueryResult } from '../DatabaseAdapter';

class MockAdapter implements DatabaseAdapter {
  private queryCount = 0;

  constructor(
    private readonly mainRows: Record<string, unknown>[],
    private readonly totalRows: Record<string, unknown>[]
  ) { }

  async query(_sql: string): Promise<QueryResult> {
    this.queryCount += 1;
    const rows = this.queryCount === 1 ? this.mainRows : this.totalRows;
    return {
      columns: [],
      rows,
      rowCount: rows.length,
    };
  }

  async execute(_sql: string): Promise<void> { }
  async insertArrowBuffer(_tableName: string, _buffer: Uint8Array): Promise<void> { }
  async getTableNames(): Promise<string[]> { return ['main']; }
  async close(): Promise<void> { }
}

const mainRows = [
  { rowKey_0: 'Row1', colKey: 'A', count: 31 },
  { rowKey_0: 'Row1', colKey: 'B', count: 19 },
  { rowKey_0: 'Row2', colKey: 'A', count: 19 },
  { rowKey_0: 'Row2', colKey: 'B', count: 31 },
];

const totalRows = [
  { rowKey_0: 'Row1', colKey: 'Total', count: 50 },
  { rowKey_0: 'Row2', colKey: 'Total', count: 50 },
];

describe('crosstabRunner significance integration', () => {
  it('stores adjusted p-values and correction method for cell-vs-rest tests', async () => {
    const adapter = new MockAdapter(mainRows, totalRows);
    const result = await runCrosstab(
      adapter,
      {
        rowVars: ['row_var'],
        colVar: 'col_var',
        filters: [],
        significanceOptions: {
          comparisonMethod: 'cell_vs_rest',
          correctionType: 'bonferroni',
          significanceLevel: 0.95,
        },
      },
      { variables: {}, variableSets: {} }
    );

    expect(result.rows).toHaveLength(4);
    result.rows.forEach((row) => {
      expect(row.stats?.correctionMethod).toBe('bonferroni');
      expect(row.stats?.adjustedPValue).toBeDefined();
      expect(row.stats?.adjustedPValue).toBeGreaterThanOrEqual(row.stats?.pValue ?? 0);
    });

    // Bonferroni should remove all 95% flags in this fixture.
    expect(result.rows.some(row => row.sig === 'high_95' || row.sig === 'low_95')).toBe(false);
  });

  it('uses pairwise mode and suppresses cell-vs-rest arrows', async () => {
    const adapter = new MockAdapter(mainRows, totalRows);
    const result = await runCrosstab(
      adapter,
      {
        rowVars: ['row_var'],
        colVar: 'col_var',
        filters: [],
        significanceOptions: {
          comparisonMethod: 'pairwise',
          correctionType: 'none',
          significanceLevel: 0.80,
        },
      },
      { variables: {}, variableSets: {} }
    );

    expect(result.rows.every(row => row.sig === undefined)).toBe(true);
    expect(result.rows.some(row => typeof row.columnLetter === 'string')).toBe(true);
    expect(result.rows.some(row => typeof row.sigLetters === 'string' && row.sigLetters.length > 0)).toBe(true);
  });
});
