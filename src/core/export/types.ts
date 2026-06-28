import { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';
import type { SlideSection } from '../../types/slides';
import type { AppliedTemplateBinding, PptxTemplate, TemplateMapping } from './templateMapping';
import type { SlideRecipe } from './slideRecipe';

export interface ExportBranding {
  primaryColor?: string;
  headerColor?: string;
  fontFamily?: string;
  chartColors?: string[];
}

export interface AnalysisExportItem {
  label: string;
  subtitle?: string;
  notes?: string;
  sectionId?: string;
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
  sections?: SlideSection[];
  branding?: ExportBranding;
  templateOptions?: TemplateExportOptions;
}

export type TemplateRefreshMode = 'full_rebuild' | 'wave_refresh';

export interface TemplateApplyInput {
  baseTemplate: Uint8Array;
  bindings: AppliedTemplateBinding[];
  refreshMode: TemplateRefreshMode;
  preserveUntouchedContent: boolean;
}

export interface TemplateExportOptions {
  template: PptxTemplate;
  mapping: TemplateMapping;
  slideRecipes: SlideRecipe[];
  baseTemplate?: Uint8Array;
  refreshMode?: TemplateRefreshMode;
  preserveUntouchedContent?: boolean;
  applyTemplateBindings?: (input: TemplateApplyInput) => Promise<Uint8Array>;
}

export class ExportError extends Error {
  code: 'EMPTY_DATA' | 'TIMEOUT' | 'GENERATION_FAILED' | 'INVALID_CONFIG';

  constructor(message: string, code: 'EMPTY_DATA' | 'TIMEOUT' | 'GENERATION_FAILED' | 'INVALID_CONFIG') {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}
