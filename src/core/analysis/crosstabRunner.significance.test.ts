import { describe, expect, it } from 'vitest';
import { runCrosstab } from './crosstabRunner';
import type { DatabaseAdapter, QueryResult } from '../DatabaseAdapter';

class MockAdapter implements DatabaseAdapter {
  private queryCount = 0;
  public readonly queries: string[] = [];

  constructor(
    private readonly mainRows: Record<string, unknown>[],
    private readonly totalRows: Record<string, unknown>[],
    private readonly overlapRows: Record<string, unknown>[] = [],
  ) {}

  async query(sql: string): Promise<QueryResult> {
    this.queries.push(sql);
    this.queryCount += 1;
    const rows = this.queryCount === 1 ? this.mainRows : this.queryCount === 2 ? this.totalRows : this.overlapRows;
    return {
      columns: [],
      rows,
      rowCount: rows.length,
    };
  }

  async execute(): Promise<void> {}
  async insertArrowBuffer(): Promise<void> {}
  async getTableNames(): Promise<string[]> {
    return ['main'];
  }
  async close(): Promise<void> {}
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

const overlapRows = [
  { rowKey_0: 'Row1', colKeyA: 'Coke', colKeyB: 'Pepsi', overlapCount: 15 },
  { rowKey_0: 'Row2', colKeyA: 'Coke', colKeyB: 'Pepsi', overlapCount: 10 },
];

describe('crosstabRunner significance integration', () => {
  it('injects missing-value exclusions into analysis SQL', async () => {
    const adapter = new MockAdapter([], []);
    await runCrosstab(
      adapter,
      {
        rowVars: ['q1'],
        colVar: null,
        filters: [],
      },
      {
        variables: {
          q1: {
            id: 'q1',
            name: 'q1',
            label: 'Q1',
            type: 'categorical',
            valueLabels: [],
            missingValues: { discrete: [999], range: { low: 98, high: 99 } },
          },
        },
        variableSets: {},
      },
    );

    expect(adapter.queries[0]).toContain('WHERE NOT ("q1" IS NULL OR "q1" IN (999) OR ("q1" >= 98 AND "q1" <= 99))');
  });

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
      { variables: {}, variableSets: {} },
    );

    expect(result.rows).toHaveLength(4);
    result.rows.forEach((row) => {
      expect(row.stats?.correctionMethod).toBe('bonferroni');
      expect(row.stats?.adjustedPValue).toBeDefined();
      expect(row.stats?.adjustedPValue).toBeGreaterThanOrEqual(row.stats?.pValue ?? 0);
    });

    // Bonferroni should remove all 95% flags in this fixture.
    expect(result.rows.some((row) => row.sig === 'high_95' || row.sig === 'low_95')).toBe(false);
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
          significanceLevel: 0.8,
        },
      },
      { variables: {}, variableSets: {} },
    );

    expect(result.rows.every((row) => row.sig === undefined)).toBe(true);
    expect(result.rows.some((row) => typeof row.columnLetter === 'string')).toBe(true);
    expect(result.rows.some((row) => typeof row.sigLetters === 'string' && row.sigLetters.length > 0)).toBe(true);
  });

  it('applies overlap-corrected dependent pairwise tests for MR columns', async () => {
    const overlapMainRows = [
      { rowKey_0: 'Row1', colKey: 'Coke', count: 30 },
      { rowKey_0: 'Row1', colKey: 'Pepsi', count: 20 },
      { rowKey_0: 'Row2', colKey: 'Coke', count: 15 },
      { rowKey_0: 'Row2', colKey: 'Pepsi', count: 25 },
    ];
    const overlapTotals = [
      { rowKey_0: 'Row1', colKey: 'Total', count: 40 },
      { rowKey_0: 'Row2', colKey: 'Total', count: 35 },
    ];

    const adapter = new MockAdapter(overlapMainRows, overlapTotals, overlapRows);
    const result = await runCrosstab(
      adapter,
      {
        rowVars: ['row_var'],
        colVar: null,
        columnMultipleColumns: [
          { name: 'mr_1', label: 'Coke', countedValue: 1 },
          { name: 'mr_2', label: 'Pepsi', countedValue: 1 },
        ],
        filters: [],
        significanceOptions: {
          comparisonMethod: 'pairwise',
          correctionType: 'none',
          significanceLevel: 0.95,
        },
      },
      { variables: {}, variableSets: {} },
    );

    expect(result.rows.every((row) => row.sig === undefined)).toBe(true);
    expect(result.rows.every((row) => row.stats?.isOverlapCorrected === true)).toBe(true);
    expect(result.rows.some((row) => typeof row.columnLetter === 'string')).toBe(true);
  });
});
