import { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';

export interface ExportBranding {
  primaryColor?: string;
  headerColor?: string;
  fontFamily?: string;
  chartColors?: string[];
}

export interface AnalysisExportItem {
  label: string;
  result: ProcessedAnalysisData;
  viewType?: 'table' | 'chart';
  visualizationType?: 'table' | 'chart';
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

export class ExportError extends Error {
  code: 'EMPTY_DATA' | 'TIMEOUT' | 'GENERATION_FAILED' | 'INVALID_CONFIG';

  constructor(
    message: string,
    code: 'EMPTY_DATA' | 'TIMEOUT' | 'GENERATION_FAILED' | 'INVALID_CONFIG'
  ) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}
