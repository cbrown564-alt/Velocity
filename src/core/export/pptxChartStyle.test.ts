import { describe, expect, it } from 'vitest';
import { buildPresentationChartOptions, resolveChartColorsForExport } from './pptxChartStyle';
import type { ExportBranding } from './types';

const branding = {
  primaryColor: '2D4A3E',
  headerColor: 'E07860',
  fontFamily: 'Atkinson Hyperlegible',
  chartColors: ['2D4A3E', 'E07860', 'E8B468', '6B8BA4', 'A45D5D'],
} satisfies ExportBranding & { fontFamily: string; chartColors: string[] };

describe('resolveChartColorsForExport', () => {
  it('uses one color for single-series charts to avoid per-bar palette cycling', () => {
    expect(resolveChartColorsForExport(1, branding)).toEqual(['2D4A3E']);
  });

  it('uses one color per series for multi-series charts', () => {
    expect(resolveChartColorsForExport(3, branding)).toEqual(['2D4A3E', 'E07860', 'E8B468']);
  });

  it('falls back to header color when palette is empty', () => {
    expect(resolveChartColorsForExport(1, { headerColor: 'E07860', chartColors: [] })).toEqual(['E07860']);
  });
});

describe('buildPresentationChartOptions', () => {
  it('applies gridlines, bar gap control, and readable axis labels', () => {
    const opts = buildPresentationChartOptions({
      branding,
      seriesCount: 1,
      isBarChart: true,
      showPercents: true,
      showCounts: false,
      contentY: 1.0,
    });

    expect(opts.chartColors).toEqual(['2D4A3E']);
    expect(opts.valGridLine).toEqual(expect.objectContaining({ color: expect.any(String), size: expect.any(Number) }));
    expect(opts.barGapWidthPct).toBe(25);
    expect(opts.valAxisLabelFontSize).toBeGreaterThanOrEqual(9);
    expect(opts.catAxisLabelFontSize).toBeGreaterThanOrEqual(9);
  });

  it('omits bar-specific options for donut charts', () => {
    const opts = buildPresentationChartOptions({
      branding,
      seriesCount: 1,
      isBarChart: false,
      showPercents: true,
      showCounts: false,
      contentY: 1.0,
    });

    expect(opts.barGapWidthPct).toBeUndefined();
    expect(opts.valGridLine).toBeDefined();
  });
});
