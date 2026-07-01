import { describe, it, expect } from 'vitest';
import { computeCrosstabColumnWidths } from './crosstabColumnWidths';

describe('computeCrosstabColumnWidths', () => {
  it('allocates wider columns to longer labels', () => {
    const widths = computeCrosstabColumnWidths(
      ['east', 'north'],
      { east: 'East', north: 'North Eastern Region' },
      true,
    );

    const eastPct = parseFloat(widths.columns.east);
    const northPct = parseFloat(widths.columns.north);
    expect(northPct).toBeGreaterThan(eastPct);
  });

  it('reserves row label and total column percentages', () => {
    const widths = computeCrosstabColumnWidths(['a', 'b'], { a: 'A', b: 'B' }, true);

    expect(widths.rowLabel).toBe('28%');
    expect(widths.total).toBe('8%');

    const dataSum = parseFloat(widths.columns.a) + parseFloat(widths.columns.b);
    expect(dataSum).toBeCloseTo(64, 0);
  });

  it('uses full width budget when no total column', () => {
    const widths = computeCrosstabColumnWidths(['a'], { a: 'Alpha' }, false);

    expect(widths.total).toBeUndefined();
    expect(parseFloat(widths.columns.a)).toBeCloseTo(72, 0);
  });

  it('does not crash when a column label is null', () => {
    expect(() =>
      computeCrosstabColumnWidths(['yes', null as unknown as string], { yes: 'yes', null: null }, true),
    ).not.toThrow();
  });
});
