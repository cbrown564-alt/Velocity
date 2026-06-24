import { describe, expect, it } from 'vitest';
import type { ProcessedAnalysisData } from '../../types/processedData';
import { hasBoxPlotStats, resolveMetricChartType } from './chartTypeResolver';

const metricCrosstab = {
  rows: [{
    key: 'product_sat',
    label: 'product sat',
    rawValue: 'product_sat',
    total: 250,
    cells: {
      east: { count: 50, percent: 20, mean: 3.2, validCount: 50 },
      west: { count: 43, percent: 17, mean: 3.1, validCount: 43 },
    },
  }],
  series: [],
  columns: [
    { key: 'east', label: 'East', total: 50 },
    { key: 'west', label: 'West', total: 43 },
  ],
  grandTotal: 250,
  isMetric: true,
  isGrid: false,
  rowVariables: [],
  colVariable: null,
  isMultipleResponse: false,
} satisfies ProcessedAnalysisData;

describe('chartTypeResolver', () => {
  it('detects missing box plot quartiles on mean-only metric crosstabs', () => {
    expect(hasBoxPlotStats(metricCrosstab)).toBe(false);
  });

  it('falls back to vertical-bar when grouped-box-plot lacks quartiles', () => {
    expect(resolveMetricChartType('grouped-box-plot', metricCrosstab)).toBe('vertical-bar');
  });

  it('keeps grouped-box-plot when quartiles are present', () => {
    const withQuartiles: ProcessedAnalysisData = {
      ...metricCrosstab,
      rows: [{
        ...metricCrosstab.rows[0],
        cells: {
          east: {
            count: 50,
            percent: 20,
            mean: 3.2,
            min: 1,
            q1: 2,
            median: 3,
            q3: 4,
            max: 5,
            validCount: 50,
          },
        },
      }],
      columns: [{ key: 'east', label: 'East', total: 50 }],
    };

    expect(hasBoxPlotStats(withQuartiles)).toBe(true);
    expect(resolveMetricChartType('grouped-box-plot', withQuartiles)).toBe('grouped-box-plot');
  });
});
