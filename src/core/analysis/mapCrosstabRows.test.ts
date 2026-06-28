import { mapCrosstabRows } from './mapCrosstabRows';
import { extractRowKeys, extractRowKeyStrings, joinRowKeyPath } from './crosstab/rowKeys';

describe('extractRowKeys', () => {
  it('collects contiguous rowKey_N columns in index order', () => {
    const row = { rowKey_0: 'A', rowKey_1: 'B', colKey: 'Total', count: 5 };
    expect(extractRowKeys(row)).toEqual(['A', 'B']);
    expect(extractRowKeyStrings(row)).toEqual(['A', 'B']);
    expect(joinRowKeyPath(row)).toBe('A|B');
  });

  it('stops at the first gap in rowKey indices', () => {
    const row = { rowKey_0: 'A', rowKey_2: 'C' };
    expect(extractRowKeys(row)).toEqual(['A']);
  });

  it('preserves numeric row key values', () => {
    const row = { rowKey_0: 1, colKey: 'X' };
    expect(extractRowKeys(row)).toEqual([1]);
    expect(extractRowKeyStrings(row)).toEqual(['1']);
  });

  it('returns empty array when no row keys present', () => {
    expect(extractRowKeys({ colKey: 'Total' })).toEqual([]);
    expect(joinRowKeyPath({ colKey: 'Total' })).toBe('');
  });
});

describe('mapCrosstabRows', () => {
  it('maps raw rows to AggregatedRow for unweighted data', () => {
    const rawRows = [
      {
        rowKey_0: 'A',
        rowKey_1: 'B',
        colKey: 'Total',
        count: 12,
        validCount: 12,
        sig: true,
        sigLetters: 'A',
        columnLetter: 'A',
      },
    ];

    const result = mapCrosstabRows(rawRows, false);

    expect(result).toHaveLength(1);
    expect(result[0].rowKeys).toEqual(['A', 'B']);
    expect(result[0].colKey).toBe('Total');
    expect(result[0].count).toBe(12);
    expect(result[0].weightedCount).toBeUndefined();
    expect(result[0].sig).toBe(true);
    expect(result[0].sigLetters).toBe('A');
    expect(result[0].columnLetter).toBe('A');
  });

  it('maps raw rows to AggregatedRow for weighted data', () => {
    const rawRows = [
      {
        rowKey_0: 1,
        colKey: 'X',
        count: 40,
        weightedCount: 42.5,
        sumSqWeights: 45.25,
        validCount: 40,
      },
    ];

    const result = mapCrosstabRows(rawRows, true);

    expect(result).toHaveLength(1);
    expect(result[0].rowKeys).toEqual([1]);
    expect(result[0].colKey).toBe('X');
    expect(result[0].count).toBe(40);
    expect(result[0].weightedCount).toBe(42.5);
    expect(result[0].sumSqWeights).toBe(45.25);
    expect(result[0].validCount).toBe(40);
  });
});
