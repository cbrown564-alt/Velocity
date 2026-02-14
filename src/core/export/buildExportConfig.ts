import { processAnalysisData } from '../../services/analysisProcessor';
import type { AggregatedRow, Variable } from '../../types';
import type { ChartType } from '../../types/charts';
import type { ExportConfig } from './types';

interface BuildExportConfigOptions {
  title: string;
  label?: string;
  data: AggregatedRow[];
  rowVariables: Variable[];
  colVariable: Variable | null;
  isWeighted: boolean;
  isMultipleResponse: boolean;
  visualizationType?: 'table' | 'chart';
  chartType?: ChartType;
}

export const buildExportConfig = ({
  title,
  label,
  data,
  rowVariables,
  colVariable,
  isWeighted,
  isMultipleResponse,
  visualizationType,
  chartType,
}: BuildExportConfigOptions): ExportConfig => {
  if (!data || data.length === 0 || rowVariables.length === 0) {
    return { title, analyses: [] };
  }

  const processedData = processAnalysisData({
    data,
    rowVariables,
    colVariable,
    isWeighted,
    isMultipleResponse,
  });

  if (!processedData) {
    return { title, analyses: [] };
  }

  const rowVarLabels = rowVariables.map((v) => v.label).join(' × ');
  const colVarLabel = colVariable ? ` by ${colVariable.label}` : '';
  const tableLabel = `${rowVarLabels}${colVarLabel}`;
  const analysisLabel = label && label.trim().length > 0 ? label : tableLabel;

  return {
    title,
    analyses: [
      {
        label: analysisLabel,
        result: processedData,
        visualizationType,
        chartType,
        options: {
          showSignificance: true,
          showPercents: true,
          showCounts: false,
        },
      },
    ],
  };
};
