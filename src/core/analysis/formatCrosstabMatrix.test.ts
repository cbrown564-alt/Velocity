import { formatCrosstabMatrix } from './formatCrosstabMatrix';

describe('formatCrosstabMatrix', () => {
  it('pivots long crosstab rows into column-percentage matrix', () => {
    const rows = [
      { rowKey_0: 'Male', colKey: 'Brand A', count: 10, weightedCount: 10 },
      { rowKey_0: 'Male', colKey: 'Brand B', count: 30, weightedCount: 30 },
      { rowKey_0: 'Female', colKey: 'Brand A', count: 40, weightedCount: 40 },
      { rowKey_0: 'Female', colKey: 'Brand B', count: 20, weightedCount: 20 },
    ];

    const result = formatCrosstabMatrix(rows, { isWeighted: true });

    expect(result.format).toBe('matrix');
    expect(result.columns).toEqual([
      { key: 'Brand A', label: 'Brand A', base: 50 },
      { key: 'Brand B', label: 'Brand B', base: 50 },
    ]);
    expect(result.rows).toEqual([
      {
        label: 'Male',
        cells: {
          'Brand A': { count: 10, percent: 20 },
          'Brand B': { count: 30, percent: 60 },
        },
      },
      {
        label: 'Female',
        cells: {
          'Brand A': { count: 40, percent: 80 },
          'Brand B': { count: 20, percent: 40 },
        },
      },
    ]);
    expect(result.grandTotal).toBe(100);
  });

  it('uses unweighted counts when isWeighted is false', () => {
    const rows = [
      { rowKey_0: 'Yes', colKey: 'Total', count: 25 },
      { rowKey_0: 'No', colKey: 'Total', count: 75 },
    ];

    const result = formatCrosstabMatrix(rows, { isWeighted: false });

    expect(result.columns).toEqual([{ key: 'Total', label: 'Total', base: 100 }]);
    expect(result.rows[0].cells.Total).toEqual({ count: 25, percent: 25 });
    expect(result.rows[1].cells.Total).toEqual({ count: 75, percent: 75 });
  });

  it('joins multi-level row keys and preserves significance markers', () => {
    const rows = [
      {
        rowKey_0: 'North',
        rowKey_1: 'Urban',
        colKey: 'A',
        count: 12,
        sig: true,
        sigLetters: 'AB',
      },
      {
        rowKey_0: 'North',
        rowKey_1: 'Rural',
        colKey: 'A',
        count: 8,
      },
    ];

    const result = formatCrosstabMatrix(rows, { isWeighted: false });

    expect(result.rows.map((row) => row.label)).toEqual(['North / Urban', 'North / Rural']);
    expect(result.rows[0].cells.A).toEqual({
      count: 12,
      percent: 60,
      sig: true,
      sigLetters: 'AB',
    });
  });
});
