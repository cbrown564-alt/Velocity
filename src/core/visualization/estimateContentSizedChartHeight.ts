import type { ChartType } from '../../types/charts';
import type { ProcessedAnalysisData } from '../../types/processedData';

/** Toolbar + spacing above the plot canvas (AnalysisChart.module.css). */
const TOOLBAR_HEIGHT = 56;

const GROUPED_BAR_MARGIN_V = 80;
const HORIZONTAL_BAR_MARGIN_V = 48;
const DEFAULT_MARGIN_V = 72;

function groupedRowHeight(seriesCount: number): number {
  const barPadding = 0.1;
  return Math.max((16 * seriesCount) / (1 - barPadding), 40);
}

function horizontalRowHeight(rowCount: number): number {
  const barHeight = 40;
  return (barHeight + 8) * rowCount;
}

function stackedRowHeight(rowCount: number): number {
  const barHeight = Math.min(Math.max(24, 24), 48);
  return (barHeight + 8) * rowCount;
}

/**
 * Estimate the natural plot height for shrink-wrapped chart slides (UXF-004).
 * Mirrors the row/group sizing rules in grouped + horizontal bar renderers.
 */
export function estimateContentSizedChartHeight(chartType: ChartType, data: ProcessedAnalysisData): number {
  const rowCount = Math.max(data.rows.length, 1);
  const colCount = Math.max(data.columns.length, 1);
  const seriesRowCount = Math.max(data.series[0]?.data.length ?? 0, rowCount);

  switch (chartType) {
    case 'grouped-bar':
    case 'grouped-column':
      return groupedRowHeight(colCount) * rowCount + GROUPED_BAR_MARGIN_V + TOOLBAR_HEIGHT;
    case 'stacked-bar': {
      const effectiveRows = data.colVariable ? colCount : 1;
      return stackedRowHeight(effectiveRows) + GROUPED_BAR_MARGIN_V + TOOLBAR_HEIGHT;
    }
    case 'horizontal-bar':
    case 'lollipop':
    case 'diverging-bar':
      return horizontalRowHeight(seriesRowCount) + HORIZONTAL_BAR_MARGIN_V + TOOLBAR_HEIGHT;
    case 'vertical-bar':
      return Math.max(280, colCount * 48 + DEFAULT_MARGIN_V + TOOLBAR_HEIGHT);
    case 'donut':
    case 'histogram':
    case 'box-plot':
    case 'grouped-box-plot':
    case 'violin':
    case 'ridgeline':
    case 'hexbin':
    case 'scatter':
      return Math.max(320, seriesRowCount * 36 + DEFAULT_MARGIN_V + TOOLBAR_HEIGHT);
    default: {
      const _exhaustive: never = chartType;
      void _exhaustive;
      return Math.max(320, seriesRowCount * 36 + DEFAULT_MARGIN_V + TOOLBAR_HEIGHT);
    }
  }
}
