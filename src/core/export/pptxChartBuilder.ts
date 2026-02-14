import PptxGenJS from 'pptxgenjs';
import type { ChartType } from '../../types/charts';
import type { ProcessedAnalysisData, ChartSeries } from '../../types/processedData';
import type { AnalysisExportItem } from './types';

/** Resolved branding values (hex without '#') */
interface ChartBranding {
  primaryColor: string;
  headerColor: string;
  fontFamily: string;
  chartColors: string[];
}

const DEFAULT_CHART_COLORS = ['2D4A3E', 'E07860', 'E8B468', '6B8BA4', 'A45D5D', '5C7065'];

/** Chart types that have no native PPTX equivalent — fall back to table export. */
const UNSUPPORTED_CHART_TYPES: ChartType[] = [
  'box-plot',
  'grouped-box-plot',
  'violin',
  'ridgeline',
  'hexbin',
];

/**
 * Whether a Velocity chart type can be exported as a native PPTX chart.
 */
export function canExportAsChart(chartType: ChartType | undefined): boolean {
  if (!chartType) return false;
  return !UNSUPPORTED_CHART_TYPES.includes(chartType);
}

interface PptxChartMapping {
  type: PptxGenJS.CHART_NAME;
  options: Partial<PptxGenJS.IChartOpts>;
}

/**
 * Map a Velocity chart type to PptxGenJS chart type + options.
 */
function mapChartType(velocityType: ChartType): PptxChartMapping {
  switch (velocityType) {
    case 'horizontal-bar':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'bar' } };
    case 'vertical-bar':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'col' } };
    case 'grouped-bar':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'bar', barGrouping: 'standard' } };
    case 'grouped-column':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'col', barGrouping: 'standard' } };
    case 'stacked-bar':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'bar', barGrouping: 'percentStacked' } };
    case 'diverging-bar':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'bar', barGrouping: 'stacked' } };
    case 'donut':
      return { type: 'doughnut' as PptxGenJS.CHART_NAME, options: {} };
    case 'histogram':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'col' } };
    case 'lollipop':
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'bar' } };
    case 'scatter':
      return { type: 'scatter' as PptxGenJS.CHART_NAME, options: {} };
    default:
      // Fallback to bar chart
      return { type: 'bar' as PptxGenJS.CHART_NAME, options: { barDir: 'col' } };
  }
}

interface OptsChartData {
  name: string;
  labels: string[];
  values: number[];
}

/**
 * Transform ProcessedAnalysisData series into PptxGenJS chart data format.
 */
function transformSeriesData(
  result: ProcessedAnalysisData,
  chartType: ChartType
): OptsChartData[] {
  const { series } = result;

  if (!series || series.length === 0) {
    return [];
  }

  if (chartType === 'donut') {
    // Donut: single series, filter out zero values
    const s = series[0];
    const filtered = s.data.filter(d => d.value > 0);
    return [{
      name: s.label || 'Total',
      labels: filtered.map(d => d.label),
      values: filtered.map(d => d.value),
    }];
  }

  if (chartType === 'scatter') {
    // Scatter: use x/y values from data points
    const s = series[0];
    return [{
      name: s.label || 'Data',
      labels: s.data.map(d => d.label),
      values: s.data.map(d => d.y ?? d.value),
    }];
  }

  if (chartType === 'diverging-bar') {
    // Diverging: split series data into positive/negative stacking
    // Convention: first half of categories go negative, second half positive
    return transformDivergingData(series);
  }

  // For all bar/column/grouped/stacked types:
  // If there's only one series (no cross-tab column), use it directly
  // If there are multiple series (cross-tab), each becomes a chart series
  if (series.length === 1) {
    const s = series[0];
    return [{
      name: s.label || 'Total',
      labels: s.data.map(d => d.label),
      values: s.data.map(d => d.percent),
    }];
  }

  // Multiple series (grouped/stacked charts with cross-tab column)
  return series.map(s => ({
    name: s.label,
    labels: s.data.map(d => d.label),
    values: s.data.map(d => d.percent),
  }));
}

/**
 * Transform series data for diverging bar charts.
 * Categories in the first half of the scale get negative values,
 * categories in the second half stay positive.
 */
function transformDivergingData(series: ChartSeries[]): OptsChartData[] {
  if (series.length <= 1) {
    // Single series: split data points into two halves
    const s = series[0];
    const midpoint = Math.ceil(s.data.length / 2);
    const labels = s.data.map(d => d.label);

    const negativeSeries: OptsChartData = {
      name: 'Below',
      labels,
      values: s.data.map((d, i) => i < midpoint ? -d.percent : 0),
    };
    const positiveSeries: OptsChartData = {
      name: 'Above',
      labels,
      values: s.data.map((d, i) => i >= midpoint ? d.percent : 0),
    };
    return [negativeSeries, positiveSeries];
  }

  // Multiple series: first half negative, second half positive
  const midpoint = Math.ceil(series.length / 2);
  return series.map((s, i) => ({
    name: s.label,
    labels: s.data.map(d => d.label),
    values: s.data.map(d => i < midpoint ? -d.percent : d.percent),
  }));
}

/**
 * Build chart options for PptxGenJS.
 */
function buildChartOptions(
  mapping: PptxChartMapping,
  branding: ChartBranding,
  title: string
): PptxGenJS.IChartOpts {
  const colors = branding.chartColors.length > 0 ? branding.chartColors : DEFAULT_CHART_COLORS;

  return {
    x: 0.5,
    y: 1.0,
    w: 12.3,
    h: 5.5,
    showTitle: false,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 8,
    legendFontFace: branding.fontFamily,
    chartColors: colors,
    valAxisLabelFontSize: 8,
    valAxisLabelFontFace: branding.fontFamily,
    catAxisLabelFontSize: 8,
    catAxisLabelFontFace: branding.fontFamily,
    dataLabelFontSize: 7,
    ...mapping.options,
  };
}

/**
 * Build a chart slide in a PPTX presentation.
 * Returns true if a chart was added, false if it fell back to needing table export.
 */
export function buildChartSlide(
  slide: PptxGenJS.Slide,
  item: AnalysisExportItem,
  branding: ChartBranding
): boolean {
  const chartType = item.chartType;
  if (!chartType || !canExportAsChart(chartType)) {
    return false;
  }

  const chartData = transformSeriesData(item.result, chartType);
  if (chartData.length === 0) {
    return false;
  }

  const mapping = mapChartType(chartType);
  const chartOpts = buildChartOptions(mapping, branding, item.label);

  // Add slide title
  slide.addText(item.label, {
    x: 0.5,
    y: 0.3,
    w: '90%',
    fontSize: 18,
    fontFace: branding.fontFamily,
    color: branding.primaryColor,
    bold: true,
  });

  slide.addChart(mapping.type, chartData as any, chartOpts);

  return true;
}

// Re-export for testing
export { mapChartType as _mapChartType, transformSeriesData as _transformSeriesData };
