import { describe, it, expect } from 'vitest';
import { generateNarrativeTitleFromRows } from '../generateNarrativeTitleFromRows';
import type { AggregatedRow, TableStats } from '../../../types';

function makeRow(
  rowKeys: string[],
  colKey: string,
  count: number,
  overrides: Partial<AggregatedRow> = {},
): AggregatedRow {
  return {
    rowKeys,
    colKey,
    count,
    ...overrides,
  } as AggregatedRow;
}

describe('generateNarrativeTitleFromRows', () => {
  it('returns null for empty rows', () => {
    expect(generateNarrativeTitleFromRows(null, null, 'Gender', 'Region')).toBeNull();
    expect(generateNarrativeTitleFromRows([], null, 'Gender', 'Region')).toBeNull();
  });

  it('detects chi-square significance', () => {
    const rows = [makeRow(['Male'], 'East', 50)];
    const stats: TableStats = { chiSquare: { chiSquare: 10, df: 1, pValue: 0.01, cramersV: 0.2 } };
    const title = generateNarrativeTitleFromRows(rows, stats, 'Gender', 'Region');
    expect(title).toContain('significant');
  });

  it('detects over-representation from high_95 sig', () => {
    const rows = [makeRow(['Male'], 'East', 60, { sig: 'high_95' }), makeRow(['Female'], 'East', 40)];
    const title = generateNarrativeTitleFromRows(rows, null, 'Gender', 'Region');
    expect(title).toContain('Male');
    expect(title).toContain('over-represented');
    expect(title).toContain('East');
  });

  it('detects under-representation from low_95 sig', () => {
    const rows = [makeRow(['Male'], 'West', 10, { sig: 'low_95' }), makeRow(['Female'], 'West', 45)];
    const title = generateNarrativeTitleFromRows(rows, null, 'Gender', 'Region');
    expect(title).toContain('Male');
    expect(title).toContain('under-represented');
    expect(title).toContain('West');
  });

  it('returns null when resolver cannot map numeric codes to labels', () => {
    const rows = [makeRow(['0'], '4', 50, { sig: 'high_95' })];
    const resolver = {
      rowLabel: () => null,
      colLabel: () => null,
    };
    expect(generateNarrativeTitleFromRows(rows, null, 'Sex', 'Marital status', resolver)).toBeNull();
  });

  it('does not throw when row/col keys are numeric', () => {
    const rows = [makeRow(['1'], '2', 50, { sig: 'high_95' }), makeRow(['2'], '2', 40)] as AggregatedRow[];
    (rows[0] as { rowKeys: unknown[] }).rowKeys = [1];
    (rows[0] as { colKey: unknown }).colKey = 2;
    const resolver = {
      rowLabel: (k: string) => (k === '1' ? 'Female' : null),
      colLabel: (k: string) => (k === '2' ? 'Married' : null),
    };
    expect(generateNarrativeTitleFromRows(rows, null, 'Sex', 'Marital status', resolver)).toContain('Female');
  });

  it('uses label resolver when provided', () => {
    const rows = [makeRow(['1'], 'east', 50, { sig: 'high_95' })];
    const resolver = {
      rowLabel: (k: string) => (k === '1' ? 'Male' : null),
      colLabel: (k: string) => (k === 'east' ? 'East' : null),
    };
    const title = generateNarrativeTitleFromRows(rows, null, 'Gender', 'Region', resolver);
    expect(title).toContain('Male');
    expect(title).toContain('East');
  });

  it('prefers high_95 over high_80', () => {
    const rows = [makeRow(['A'], 'c1', 55, { sig: 'high_80' }), makeRow(['B'], 'c1', 70, { sig: 'high_95' })];
    const title = generateNarrativeTitleFromRows(rows, null, 'Row', 'Col');
    expect(title).toContain('B');
  });

  it('falls back to variation language when no sig', () => {
    const rows = [
      makeRow(['A'], 'c1', 40),
      makeRow(['A'], 'c2', 60),
      makeRow(['B'], 'c1', 55),
      makeRow(['B'], 'c2', 45),
    ];
    const title = generateNarrativeTitleFromRows(rows, null, 'Brand', 'Region');
    expect(title).toMatch(/varies|distribution/);
  });

  it('suggests even distribution for flat data', () => {
    const rows = [
      makeRow(['A'], 'c1', 50),
      makeRow(['A'], 'c2', 50),
      makeRow(['B'], 'c1', 50),
      makeRow(['B'], 'c2', 50),
    ];
    const title = generateNarrativeTitleFromRows(rows, null, 'Gender', 'Region');
    expect(title).toContain('relatively even');
  });
});
