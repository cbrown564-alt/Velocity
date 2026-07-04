import { describe, expect, it } from 'vitest';
import { estimateContentSizedChartHeight } from './estimateContentSizedChartHeight';
import type { ProcessedAnalysisData } from '../../types/processedData';

function makeProcessedData(rowCount: number, colCount: number): ProcessedAnalysisData {
  return {
    rows: Array.from({ length: rowCount }, (_, i) => ({
      key: String(i),
      label: `Row ${i}`,
      rawValue: String(i),
      depth: 0,
      cells: {},
      total: 10,
      children: [],
      rowPath: [],
    })),
    columns: Array.from({ length: colCount }, (_, i) => ({
      key: String(i),
      label: `Col ${i}`,
      total: 10,
    })),
    series: [
      {
        key: 'series',
        label: 'Series',
        data: Array.from({ length: rowCount }, (_, i) => ({
          label: `Row ${i}`,
          rawValue: String(i),
          value: 10,
          percent: 10,
        })),
      },
    ],
    grandTotal: rowCount * 10,
    isMetric: false,
    isGrid: false,
    rowVariables: [],
    colVariable:
      colCount > 1
        ? ({
            id: 'seg',
            name: 'seg',
            label: 'Segment',
            type: 'categorical',
            valueLabels: [],
            missingValues: {},
          } as never)
        : null,
    isMultipleResponse: false,
  };
}

describe('estimateContentSizedChartHeight', () => {
  it('accounts for grouped series per row', () => {
    const height = estimateContentSizedChartHeight('grouped-bar', makeProcessedData(6, 3));
    // 6 rows × ~53px groups + margins + toolbar
    expect(height).toBeGreaterThan(430);
  });

  it('uses row count for horizontal bars', () => {
    const height = estimateContentSizedChartHeight('horizontal-bar', makeProcessedData(6, 1));
    expect(height).toBe(56 + 48 + 6 * 48);
  });
});
