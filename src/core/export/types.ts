import { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';

export interface ExportBranding {
  primaryColor?: string;
  headerColor?: string;
  fontFamily?: string;
}

export interface AnalysisExportItem {
  label: string;
  result: ProcessedAnalysisData;
  viewType?: 'table' | 'chart';
  chartType?: ChartType;
  options?: {
    showCounts?: boolean;
    showPercents?: boolean;
    showSignificance?: boolean;
  };
}

export interface ExportConfig {
  title: string;
  analyses: AnalysisExportItem[];
  branding?: ExportBranding;
}
