import { ProcessedAnalysisData } from '../../types/processedData';

export interface ExportBranding {
  primaryColor?: string;
  headerColor?: string;
  fontFamily?: string;
}

export interface AnalysisExportItem {
  label: string;
  result: ProcessedAnalysisData;
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
