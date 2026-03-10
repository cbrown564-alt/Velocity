import type { QueryResult } from '../core/DatabaseAdapter';
import type {
  SessionImportDiagnosticsSummary,
  VelocitySessionFile,
} from '../core/session';
import type {
  Dataset,
  Filter,
  Folder,
  RecodeConfig,
  Variable,
  VariableSet,
} from '../types';
import type { ChartType } from '../types/charts';
import type { ProcessedAnalysisData } from '../types/processedData';
import type { VariableStatsResult } from '../types/worker';
import type { ExportBranding } from '../core/export/types';

export type EngineRuntime = 'node' | 'wasm';

export interface ResultEnvelope<T> {
  data: T;
  operation: string;
  inputs: Record<string, unknown>;
  durationMs: number;
  warnings: string[];
  metadata: {
    datasetName: string;
    rowCount: number;
    filtersApplied: number;
    isWeighted: boolean;
    engineVersion: string;
  };
}

export interface EngineOptions {
  runtime?: EngineRuntime;
  adapter?: unknown;
  dataDir?: string;
  engineVersion?: string;
}

export interface DatasetSummary {
  datasetName: string;
  rowCount: number;
  variableCount: number;
  variableSetCount: number;
  source: Dataset['source'];
}

export interface DatasetDescription {
  dataset: Dataset | null;
  variableSets: VariableSet[];
  folders: Folder[];
  activeFilters: Filter[];
  weightVariable: string | null;
}

export interface VariableDetail {
  variable: Variable;
  stats: VariableStatsResult;
}

export interface AnalysisDescriptor {
  id: string;
  label: string;
  configSchema: Record<string, unknown>;
}

export type AnalysisResult = unknown;
export type EngineQueryResult = QueryResult;
export type EngineImportDiagnostics = SessionImportDiagnosticsSummary;

export type VelocityErrorCode =
  | 'INVALID_VARIABLE'
  | 'ANALYSIS_FAILED'
  | 'FILE_LOAD_FAILED'
  | 'SESSION_INVALID'
  | 'NO_DATASET_LOADED'
  | 'ANALYSIS_NOT_FOUND'
  | 'UNSUPPORTED_RUNTIME'
  | 'UNSUPPORTED_FORMAT'
  | 'DECK_BUILD_FAILED'
  | 'PATH_TRAVERSAL_DENIED';

export class VelocityError extends Error {
  constructor(
    public code: VelocityErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VelocityError';
  }
}

export interface EngineRecodeConfig extends RecodeConfig {
  targetVariableName?: string;
  label?: string;
}

export type EngineSessionFile = VelocitySessionFile;

// ============================================================================
// Deck Types (Phase 2 — DeckBuilder)
// ============================================================================

export interface SlideSpec {
  rowVars: string[];
  colVar?: string | null;
  filters?: Filter[];
  weightVar?: string | null;
  title?: string;
  subtitle?: string;
  notes?: string;
  visualizationType?: 'table' | 'chart';
  chartType?: ChartType;
  displayOptions?: {
    showSignificance?: boolean;
    showPercents?: boolean;
    showCounts?: boolean;
  };
}

export interface DeckSectionSpec {
  title: string;
  slides: SlideSpec[];
}

export interface DeckSpec {
  title: string;
  subtitle?: string;
  branding?: ExportBranding;
  sections: DeckSectionSpec[];
}

export interface BuiltSlide {
  spec: SlideSpec;
  sectionTitle: string;
  result: ResultEnvelope<unknown>;
  processed: ProcessedAnalysisData;
  resolvedTitle: string;
  resolvedSubtitle: string;
  resolvedChartType?: ChartType;
}

export interface DeckBuildError {
  slideIndex: number;
  sectionTitle: string;
  error: VelocityError;
}

export interface BuiltDeck {
  spec: DeckSpec;
  slides: BuiltSlide[];
  errors: DeckBuildError[];
  buildDurationMs: number;
}

export interface DeckExportOptions {
  format: 'pptx' | 'xlsx';
  branding?: ExportBranding;
}
