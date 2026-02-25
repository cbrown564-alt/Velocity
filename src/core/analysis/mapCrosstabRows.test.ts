import { mapCrosstabRows } from './mapCrosstabRows';

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
