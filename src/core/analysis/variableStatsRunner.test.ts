import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter, QueryResult } from '../DatabaseAdapter';
import { getVariableStats } from './variableStatsRunner';

class RecordingAdapter implements DatabaseAdapter {
  public readonly queries: string[] = [];
  private cursor = 0;

  constructor(private readonly responses: QueryResult[]) { }

  async query(sql: string): Promise<QueryResult> {
    this.queries.push(sql);
    const response = this.responses[this.cursor];
    this.cursor += 1;
    return response ?? { columns: [], rows: [], rowCount: 0 };
  }

  async execute(_sql: string): Promise<void> { }
  async insertArrowBuffer(_tableName: string, _buffer: Uint8Array): Promise<void> { }
  async getTableNames(): Promise<string[]> { return ['main']; }
  async close(): Promise<void> { }
}

const resultWithRows = (rows: Record<string, unknown>[]): QueryResult => ({
  columns: [],
  rows,
  rowCount: rows.length,
});

describe('variableStatsRunner missing exclusions', () => {
  it('excludes user-missing values from top frequency stats', async () => {
    const adapter = new RecordingAdapter([
      resultWithRows([{ cnt: 100 }]), // total
      resultWithRows([{ cnt: 30 }]), // missing
      resultWithRows([{ value: 1, cnt: 20 }]), // valid frequency
      resultWithRows([{ value: 999, cnt: 25 }]), // user-missing frequency for mapping
    ]);

    await getVariableStats(
      adapter,
      'q1',
      'categorical',
      undefined,
      10,
      { discrete: [999], range: { low: 98, high: 99 } }
    );

    const frequencySql = adapter.queries[2];
    expect(frequencySql).toContain('WHERE NOT ("q1" IS NULL OR "q1" IN (999) OR ("q1" >= 98 AND "q1" <= 99))');
    expect(frequencySql).not.toContain('WHERE "q1" IS NOT NULL');
  });

  it('excludes user-missing values from numeric aggregates and histogram bins', async () => {
    const adapter = new RecordingAdapter([
      resultWithRows([{ cnt: 50 }]), // total
      resultWithRows([{ cnt: 10 }]), // missing
      resultWithRows([{ value: 1, cnt: 10 }]), // valid frequency
      resultWithRows([{ value: 999, cnt: 10 }]), // user-missing frequency for mapping
      resultWithRows([{ min_val: 1, max_val: 5, mean_val: 3, median_val: 3, stddev_val: 1, q1_val: 2, q3_val: 4 }]), // numeric stats
      resultWithRows([{ whisker_min: 1, whisker_max: 5 }]), // fence
      resultWithRows([]), // outliers
      resultWithRows([{ bucket: 1, cnt: 10 }, { bucket: 2, cnt: 10 }]), // histogram
    ]);

    await getVariableStats(
      adapter,
      'q_age',
      'numeric',
      undefined,
      2,
      { discrete: [999] }
    );

    const numericSql = adapter.queries[4];
    const histogramSql = adapter.queries[7];

    expect(numericSql).toContain('WHERE NOT ("q_age" IS NULL OR "q_age" IN (999))');
    expect(histogramSql).toContain('WHERE NOT ("q_age" IS NULL OR "q_age" IN (999))');
  });
});
