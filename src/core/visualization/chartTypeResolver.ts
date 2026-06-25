import type { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';

const DISTRIBUTION_CHART_TYPES = new Set<ChartType>([
  'grouped-box-plot',
  'box-plot',
  'violin',
  'ridgeline',
]);

export function hasBoxPlotStats(processedData: ProcessedAnalysisData): boolean {
  const hasCellStats = (cell: { min?: number; q1?: number; median?: number; q3?: number; max?: number } | undefined) =>
    cell?.min !== undefined &&
    cell?.q1 !== undefined &&
    cell?.median !== undefined &&
    cell?.q3 !== undefined &&
    cell?.max !== undefined;

  for (const row of processedData.rows) {
    for (const col of processedData.columns) {
      if (hasCellStats(row.cells[col.key])) {
        return true;
      }
    }
  }

  return processedData.series.some((series) =>
    series.data.some((point) =>
      point.stats?.min !== undefined &&
      point.stats?.q1 !== undefined &&
      point.stats?.median !== undefined &&
      point.stats?.q3 !== undefined &&
      point.stats?.max !== undefined,
    ),
  );
}

export function resolveMetricChartType(
  requestedType: ChartType,
  processedData: ProcessedAnalysisData | null | undefined,
): ChartType {
  if (!processedData?.isMetric || !DISTRIBUTION_CHART_TYPES.has(requestedType)) {
    return requestedType;
  }
  if (hasBoxPlotStats(processedData)) {
    return requestedType;
  }
  if (processedData.rows.length === 1 && processedData.columns.length > 1) {
    return 'vertical-bar';
  }
  if (processedData.rows.length > 1 && processedData.columns.length === 1) {
    return 'vertical-bar';
  }
  return 'vertical-bar';
}
