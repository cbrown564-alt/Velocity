import { describe, it, expect } from 'vitest';
import { buildGridHistogramQuery } from './queryBuilder';
import { buildCrosstabQuery } from './queryBuilder';

describe('Query Builder: Numeric Grids', () => {
  it('should build an aggregate query for numeric grids', () => {
    const sql = buildCrosstabQuery({
      rowVars: [], // Handled via gridColumns
      colVar: 'Gender',
      gridColumns: [
        { name: 'Q1', label: 'Question 1' },
        { name: 'Q2', label: 'Question 2' },
      ],
      gridAggregate: true,
    });

    // Should select stats (mean, etc.)
    expect(sql).toContain('AVG(_synthetic_value) as mean');
    expect(sql).toContain('STDDEV_POP(_synthetic_value) as stdDev');

    // Should group by Item and ColVar
    expect(sql).toContain('GROUP BY item_label, "Gender"');

    // Should select item_label as rowKey
    expect(sql).toContain('item_label as rowKey_0');
  });

  it('should build a frequency query for categorical grids (default)', () => {
    const sql = buildCrosstabQuery({
      rowVars: [],
      colVar: 'Gender',
      gridColumns: [
        { name: 'Q1', label: 'Question 1' },
        { name: 'Q2', label: 'Question 2' },
      ],
      gridAggregate: false,
    });

    // Should count frequencies
    expect(sql).toContain('COUNT(*)::INTEGER as count');

    // Should group by Value and Item
    expect(sql).toContain('GROUP BY _synthetic_value, item_label');

    // Should select Value as rowKey
    expect(sql).toContain('_synthetic_value as rowKey_0');
  });

  it('should build a histogram query for numeric grids', () => {
    const sql = buildGridHistogramQuery({
      columns: [
        { name: 'Q1', label: 'Question 1' },
        { name: 'Q2', label: 'Question 2' },
      ],
      colVar: 'Gender',
      minVal: 1,
      maxVal: 5,
      binCount: 10,
    });

    // Should use CTE for unpivoting
    expect(sql).toContain('WITH unpivoted AS');

    // Should include item_index in CTE now
    expect(sql).toContain('items.item_index');

    // Should calculate buckets
    // (val - 1) / (4/10) = (val-1)/0.4
    expect(sql).toContain('LEAST(FLOOR((_synthetic_value - 1) / 0.4) + 1, 10)::INTEGER');

    // Should group by Item, ColVar, and Bucket
    expect(sql).toContain('GROUP BY item_label, "Gender", bucket');

    // Should select proper keys
    expect(sql).toContain('item_label as rowKey_0');
    expect(sql).toContain('"Gender" as colKey');
    expect(sql).toContain('bucket');
    expect(sql).toContain('COUNT(*) as cnt');
  });
});
