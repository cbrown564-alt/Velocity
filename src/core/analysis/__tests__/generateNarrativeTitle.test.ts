import { describe, it, expect } from 'vitest';
import { generateNarrativeTitle } from '../generateNarrativeTitle';
import type { ProcessedAnalysisData } from '../../../types/processedData';
import type { TableStats } from '../../../types';

function makeProcessedData(overrides: Partial<ProcessedAnalysisData> = {}): ProcessedAnalysisData {
  return {
    rows: [],
    series: [],
    columns: [],
    grandTotal: 100,
    isMetric: false,
    isGrid: false,
    rowVariables: [],
    colVariable: null,
    isMultipleResponse: false,
    ...overrides,
  };
}

function makeRow(
  label: string,
  rawValue: string,
  cells: Record<string, { percent: number; sig?: ProcessedAnalysisData['rows'][0]['cells'][string]['sig'] }>,
) {
  return {
    key: rawValue,
    label,
    rawValue,
    depth: 0,
    cells: Object.fromEntries(
      Object.entries(cells).map(([col, cell]) => [col, { count: 10, percent: cell.percent, sig: cell.sig }]),
    ),
    total: 50,
    children: [],
    rowPath: [{ variable: 'var1', value: rawValue }],
  };
}

describe('generateNarrativeTitle', () => {
  it('returns null when data is null', () => {
    expect(generateNarrativeTitle(null, null, 'Gender', 'Region')).toBeNull();
  });

  it('returns null when there are no rows', () => {
    const data = makeProcessedData({ rows: [] });
    expect(generateNarrativeTitle(data, null, 'Gender', 'Region')).toBeNull();
  });

  it('suggests chi-square significance when p < 0.05', () => {
    const data = makeProcessedData({
      rows: [makeRow('Male', '1', { east: { percent: 60, sig: 'high_95' } })],
      columns: [{ key: 'east', label: 'East', total: 50 }],
    });
    const stats: TableStats = { chiSquare: { chiSquare: 12.5, df: 2, pValue: 0.01, cramersV: 0.3 } };
    const title = generateNarrativeTitle(data, stats, 'Gender', 'Region');
    expect(title).toContain('significant');
    expect(title).toContain('Region');
    expect(title).toContain('Gender');
  });

  it('suggests over-representation for high_95 sig', () => {
    const data = makeProcessedData({
      rows: [
        makeRow('Male', '1', { east: { percent: 70, sig: 'high_95' } }),
        makeRow('Female', '2', { east: { percent: 30 } }),
      ],
      columns: [{ key: 'east', label: 'East', total: 50 }],
    });
    const title = generateNarrativeTitle(data, null, 'Gender', 'Region');
    expect(title).toContain('Male');
    expect(title).toContain('over-represented');
    expect(title).toContain('East');
  });

  it('suggests under-representation for low_95 sig', () => {
    const data = makeProcessedData({
      rows: [
        makeRow('Male', '1', { west: { percent: 10, sig: 'low_95' } }),
        makeRow('Female', '2', { west: { percent: 45 } }),
      ],
      columns: [{ key: 'west', label: 'West', total: 50 }],
    });
    const title = generateNarrativeTitle(data, null, 'Gender', 'Region');
    expect(title).toContain('Male');
    expect(title).toContain('under-represented');
    expect(title).toContain('West');
  });

  it('prefers the most significant finding (high_95 over high_80)', () => {
    const data = makeProcessedData({
      rows: [
        makeRow('A', '1', { c1: { percent: 55, sig: 'high_80' } }),
        makeRow('B', '2', { c1: { percent: 70, sig: 'high_95' } }),
      ],
      columns: [{ key: 'c1', label: 'Col1', total: 50 }],
    });
    const title = generateNarrativeTitle(data, null, 'Row', 'Col');
    expect(title).toContain('B');
    expect(title).toContain('over-represented');
  });

  it('falls back to variation language when no significance', () => {
    const data = makeProcessedData({
      rows: [
        makeRow('A', '1', { c1: { percent: 40 }, c2: { percent: 60 } }),
        makeRow('B', '2', { c1: { percent: 55 }, c2: { percent: 45 } }),
      ],
      columns: [
        { key: 'c1', label: 'Col1', total: 50 },
        { key: 'c2', label: 'Col2', total: 50 },
      ],
    });
    const title = generateNarrativeTitle(data, null, 'Brand', 'Region');
    expect(title).toContain('Brand');
    expect(title).toContain('Region');
    expect(title).toMatch(/varies|distribution/);
  });

  it('suggests even distribution when percentages are flat', () => {
    const data = makeProcessedData({
      rows: [
        makeRow('A', '1', { c1: { percent: 50 }, c2: { percent: 50 } }),
        makeRow('B', '2', { c1: { percent: 50 }, c2: { percent: 50 } }),
      ],
      columns: [
        { key: 'c1', label: 'Col1', total: 50 },
        { key: 'c2', label: 'Col2', total: 50 },
      ],
    });
    const title = generateNarrativeTitle(data, null, 'Gender', 'Region');
    expect(title).toContain('relatively even');
  });

  it('works with single-column data (no col variable)', () => {
    const data = makeProcessedData({
      rows: [makeRow('A', '1', { _total: { percent: 60, sig: 'high_95' } })],
      columns: [{ key: '_total', label: 'Total', total: 100 }],
    });
    const title = generateNarrativeTitle(data, null, 'Gender', null);
    expect(title).toContain('A');
  });
});
