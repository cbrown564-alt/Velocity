import { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';

export interface ExportBranding {
  primaryColor?: string;
  headerColor?: string;
  fontFamily?: string;
  /** Hex colors without '#' for chart series (e.g., ['E07860', '2D4A3E']) */
  chartColors?: string[];
}

export interface AnalysisExportItem {
  label: string;
  result: ProcessedAnalysisData;
  /** Whether this slide is a chart or table view */
  visualizationType?: 'table' | 'chart';
  /** Chart type when visualizationType is 'chart' */
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

/**
 * Typed error for export failures with machine-readable codes.
 */
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
