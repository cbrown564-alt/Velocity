/**
 * Worker Message Types
 *
 * Type-safe communication protocol between the main thread and the analysis Web Worker.
 * Extracted from analysisWorker.ts to enable sharing across the codebase
 * and future headless/CLI usage.
 */

import { RecodeConfig, VariableSet, Variable, Filter, HistogramBin, AggregatedRow, ChiSquareResult, TableStats, MissingValueDef } from './index';
import type { OrderedScoring, VariableType } from './index';
import { CrosstabQueryOptions } from '../services/queryBuilder';
import { ProcessedAnalysisData } from './processedData';
import { ChartType } from './charts';
import type { VariableMapping } from './harmonization';

export interface WorkerAnalysisSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
}

export interface WorkerAnalysisContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

export interface RunCrosstabRequestPayload {
  options: CrosstabQueryOptions & { includeDistributions?: boolean };
  analysisSettings?: WorkerAnalysisSettings;
  context: WorkerAnalysisContext;
}

export interface AnalysisConfigById {
  crosstab: RunCrosstabRequestPayload;
}

export interface AnalysisResultById {
  crosstab: { rows: AggregatedRow[]; tableStats?: TableStats };
}

type KnownRunAnalysisRequest = {
  [K in keyof AnalysisConfigById]: { type: 'runAnalysis'; id: K; config: AnalysisConfigById[K] };
}[keyof AnalysisConfigById];

type UnknownRunAnalysisRequest = {
  type: 'runAnalysis';
  id: Exclude<string, keyof AnalysisConfigById>;
  config: Record<string, unknown>;
};

type KnownAnalysisResultResponse = {
  [K in keyof AnalysisResultById]: { type: 'analysisResult'; id: K; result: AnalysisResultById[K]; durationMs: number };
}[keyof AnalysisResultById];

type UnknownAnalysisResultResponse = {
  type: 'analysisResult';
  id: Exclude<string, keyof AnalysisResultById>;
  result: Record<string, unknown> | null;
  durationMs: number;
};

export type WorkerQueryRow = AggregatedRow | Record<string, unknown>;

// ============================================================================
// Worker Request Types
// ============================================================================

interface WorkerRequestBase {
  requestId?: string;
}

export type WorkerRequest = WorkerRequestBase & (
  | { type: 'init'; forceCleanStart?: boolean; datasetId?: string; schemaVersion?: number }
  | { type: 'setPersistenceContext'; datasetId?: string; schemaVersion?: number }
  | { type: 'updatePersistenceMetadata'; metadata: PersistedMetadata }
  | { type: 'loadCSV'; fileName: string; content: string }
  | { type: 'loadSAV'; buffer: ArrayBuffer; forceChunked?: boolean }
  | { type: 'loadSAVMetadata'; buffer: ArrayBuffer }
  | { type: 'loadSAVSample'; buffer: ArrayBuffer; rowLimit: number; strategy?: 'sequential' | 'spread' }
  | { type: 'flushPersistedData' }
  | { type: 'query'; sql: string }
  | { type: 'getSchema' }
  | { type: 'getUniqueValues'; column: string }
  | { type: 'getVariableStats'; column: string; variableType?: VariableType; orderedScoring?: OrderedScoring; binCount?: number; missingValues?: MissingValueDef }
  | { type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
  | { type: 'fillSystemMissing'; column: string; value: number | string }
  | { type: 'checkPersistedData' }
  | { type: 'clearPersistedData' }
  | {
      type: 'runCrosstab';
      options: RunCrosstabRequestPayload['options'];
      analysisSettings?: WorkerAnalysisSettings;
      context: WorkerAnalysisContext;
    }
  | {
      type: 'processData';
      data: AggregatedRow[];
      options: {
        rowVariables: Variable[];
        colVariable: Variable | null;
        isWeighted?: boolean;
        isMultipleResponse?: boolean;
      };
      chartType?: ChartType;
    }
  | KnownRunAnalysisRequest
  | UnknownRunAnalysisRequest
  | { type: 'exportArrow'; sql: string; columns?: string[] }
  | { type: 'getValueFrequencies'; tableName: string; columnName: string }
  | {
      type: 'buildHarmonizedTable';
      sourceTable: string;
      targetTable: string;
      mappings: VariableMapping[];
      outputTableName: string;
      sourceVarNames?: Record<string, string>;
      targetVarNames?: Record<string, string>;
    }
  | { type: 'getRespondentOverlap'; sourceTable: string; targetTable: string; keyColumn: string }
  | { type: 'ping' }
);

// ============================================================================
// Worker Response Types
// ============================================================================

export interface VariableStatsFrequency {
  value: number | string | null;
  count: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr?: number;
  lowerFence?: number;
  upperFence?: number;
  whiskerMin?: number;
  whiskerMax?: number;
  outliers?: number[];
  histogramBins: HistogramBin[];
}

export interface PersistedMetadata {
  datasetId?: string;
  datasetName?: string;
  rowCount: number;
  columnCount: number;
  schemaVersion: number;
  lastModified: number;
}

export interface VariableStatsResult {
  column: string;
  frequencies: VariableStatsFrequency[];
  missingCount: number;
  totalCount: number;
  numeric?: NumericStats;
}

interface WorkerResponseBase {
  requestId?: string;
}

export type WorkerResponse = WorkerResponseBase & (
  | { type: 'ready'; opfsAvailable: boolean }
  | { type: 'persistenceStatus'; opfsAvailable: boolean; mode: 'opfs' | 'memory' | 'disabled'; dbPath: string; lastError?: string }
  | { type: 'corruptionDetected'; message: string }
  | { type: 'schema'; data: { name: string; type: string }[] }
  | { type: 'csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number }
  | { type: 'savLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }
  | { type: 'savMetadataLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }
  | { type: 'savSampleLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; sampleRowCount: number; sampleStrategy: 'sequential' | 'spread'; durationMs: number }
  | { type: 'loadProgress'; phase: 'parsing' | 'inserting' | 'complete'; progress: number; rowsProcessed?: number; totalRows?: number; message: string }
  | { type: 'flushComplete'; ok: boolean; durationMs: number; error?: string }
  | { type: 'queryResult'; data: WorkerQueryRow[]; durationMs: number; tableStats?: TableStats }
  | { type: 'uniqueValues'; data: string[] }
  | { type: 'variableStats'; stats: VariableStatsResult }
  | { type: 'recodeComplete'; newColName: string }
  | { type: 'persistedDataFound'; schema: { name: string; type: string }[]; rowCount: number; metadata?: PersistedMetadata }
  | { type: 'noPersistedData' }
  | { type: 'persistedDataCleared' }
  | { type: 'pong'; hasData: boolean; rowCount?: number }
  | { type: 'processedData'; result: ProcessedAnalysisData | null }
  | KnownAnalysisResultResponse
  | UnknownAnalysisResultResponse
  | { type: 'arrowExported'; buffer: ArrayBuffer; rowCount: number; durationMs: number }
  | { type: 'valueFrequencies'; column: string; frequencies: Array<{ value: number; count: number }> }
  | { type: 'fillSystemMissingComplete'; column: string }
  | { type: 'harmonizedTableCreated'; tableName: string; rowCount: number; durationMs: number }
  | { type: 'respondentOverlap'; totalSource: number; totalTarget: number; overlap: number }
  | { type: 'error'; message: string }
);
