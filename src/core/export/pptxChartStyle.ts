import type { ExportBranding } from './types';

const FALLBACK_CHART_COLORS = ['E07A5F', '1C1C1C', '4F46E5', '10B981', 'F59E0B'];

export interface PresentationChartOptionsInput {
  branding: ExportBranding & {
    fontFamily: string;
    chartColors: string[];
  };
  seriesCount: number;
  isBarChart: boolean;
  showPercents: boolean;
  showCounts: boolean;
  contentY: number;
  barDir?: 'bar' | 'col';
  barGrouping?: 'clustered' | 'stacked' | 'percentStacked';
}

/**
 * PptxGenJS cycles chartColors across data points in a single series.
 * Pass one color per series (or one color total for a single series).
 */
export function resolveChartColorsForExport(
  seriesCount: number,
  branding: ExportBranding,
): string[] {
  const palette =
    branding.chartColors && branding.chartColors.length > 0
      ? branding.chartColors
      : branding.headerColor
        ? [branding.headerColor]
        : FALLBACK_CHART_COLORS;

  if (seriesCount <= 1) {
    return [palette[0]];
  }

  return palette.slice(0, seriesCount);
}

export function buildPresentationChartOptions(
  input: PresentationChartOptionsInput,
): Record<string, unknown> {
  const chartColors = resolveChartColorsForExport(input.seriesCount, input.branding);
  const gridColor = input.branding.primaryColor ?? 'CCCCCC';

  const opts: Record<string, unknown> = {
    x: 0.5,
    y: input.contentY,
    w: 12.3,
    h: 6.0 - Math.max(0, input.contentY - 1.0),
    showTitle: false,
    showLegend: input.seriesCount > 1,
    legendPos: 'b',
    legendFontSize: 9,
    legendFontFace: input.branding.fontFamily,
    chartColors,
    valGridLine: { color: gridColor, size: 0.5, style: 'solid' },
    catGridLine: { color: gridColor, size: 0.5, style: 'solid' },
    valAxisLabelFontSize: 10,
    valAxisLabelFontFace: input.branding.fontFamily,
    catAxisLabelFontSize: 10,
    catAxisLabelFontFace: input.branding.fontFamily,
    dataLabelFontFace: input.branding.fontFamily,
    dataLabelFontSize: 10,
    showValue: input.showPercents || input.showCounts,
  };

  if (input.isBarChart) {
    const labelFmt = input.showPercents ? '0.0"%"' : '0';
    const axisFmt = input.showPercents ? '0"%"' : '0';
    Object.assign(opts, {
      barDir: input.barDir ?? 'col',
      barGrouping: input.barGrouping ?? 'clustered',
      barGapWidthPct: 25,
      dataLabelFormatCode: labelFmt,
      dataBorder: { pt: 1, color: 'FFFFFF' },
      dataLabelColor: input.branding.primaryColor ?? '333333',
      valAxisLabelFormatCode: axisFmt,
      showValue: input.showPercents || input.showCounts,
    });
  }

  return opts;
}
