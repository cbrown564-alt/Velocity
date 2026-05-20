import { describe, expect, it } from 'vitest';
import type { AggregatedRow } from '../../types';
import { computeAnalysisSampleSize } from './computeAnalysisSampleSize';

describe('computeAnalysisSampleSize', () => {
  it('sums top-level Total column marginals', () => {
    const data: AggregatedRow[] = [
      { rowKeys: ['1'], colKey: 'Total', count: 10 },
      { rowKeys: ['2'], colKey: 'Total', count: 20 },
    ];
    expect(computeAnalysisSampleSize(data)).toBe(30);
  });

  it('uses weighted counts when requested', () => {
    const data: AggregatedRow[] = [
      { rowKeys: ['1'], colKey: 'Total', count: 10, weightedCount: 11.5 },
      { rowKeys: ['2'], colKey: 'Total', count: 20, weightedCount: 22.5 },
    ];
    expect(computeAnalysisSampleSize(data, { isWeighted: true })).toBe(34);
  });

  it('ignores nested marginals when top-level totals exist', () => {
    const data: AggregatedRow[] = [
      { rowKeys: ['1'], colKey: 'Total', count: 10 },
      { rowKeys: ['1', 'a'], colKey: 'Total', count: 4 },
      { rowKeys: ['1', 'b'], colKey: 'Total', count: 6 },
    ];
    expect(computeAnalysisSampleSize(data)).toBe(10);
  });

  it('returns null when no Total marginals exist', () => {
    const data: AggregatedRow[] = [
      { rowKeys: ['1'], colKey: 'North', count: 10 },
    ];
    expect(computeAnalysisSampleSize(data)).toBeNull();
  });
});
