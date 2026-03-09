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
import type { VariableStatsResult } from '../types/worker';

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
  | 'UNSUPPORTED_FORMAT';

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
