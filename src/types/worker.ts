/**
 * Worker Message Types
 *
 * Type-safe communication protocol between the main thread and the analysis Web Worker.
 * Extracted from analysisWorker.ts to enable sharing across the codebase
 * and future headless/CLI usage.
 */

import { RecodeConfig, VariableSet, Variable, Filter, HistogramBin, AggregatedRow, ChiSquareResult, TableStats } from './index';
import { CrosstabQueryOptions } from '../services/queryBuilder';
import { ProcessedAnalysisData } from './processedData';
import { ChartType } from './charts';

// ============================================================================
// Worker Request Types
// ============================================================================

export type WorkerRequest =
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
  | { type: 'getVariableStats'; column: string; variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date'; binCount?: number }
  | { type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
  | { type: 'checkPersistedData' }
  | { type: 'clearPersistedData' }
  | {
    type: 'runCrosstab';
    options: CrosstabQueryOptions & { includeDistributions?: boolean };
    context: {
      variables: Record<string, Variable>;
      variableSets: Record<string, VariableSet>;
    }
  }
  | {
    type: 'processData';
    requestId?: string;
    data: AggregatedRow[];
    options: {
      rowVariables: Variable[];
      colVariable: Variable | null;
      isWeighted?: boolean;
      isMultipleResponse?: boolean;
    };
    chartType?: ChartType;
  }
  | { type: 'runAnalysis'; id: string; config: any }
  | { type: 'exportArrow'; sql: string; columns?: string[] }
  | { type: 'ping' };

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

export type WorkerResponse =
  | { type: 'ready'; opfsAvailable: boolean }
  | { type: 'persistenceStatus'; opfsAvailable: boolean; mode: 'opfs' | 'memory' | 'disabled'; dbPath: string; lastError?: string }
  | { type: 'corruptionDetected'; message: string }
  | { type: 'schema'; data: { name: string; type: string }[] }
  | { type: 'csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number }
  | { type: 'savLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }
  | { type: 'savMetadataLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }
  | { type: 'savSampleLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; sampleRowCount: number; sampleStrategy: 'sequential' | 'spread'; durationMs: number }
  | { type: 'flushComplete'; ok: boolean; durationMs: number; error?: string }
  | { type: 'queryResult'; data: any[]; durationMs: number; tableStats?: TableStats }
  | { type: 'uniqueValues'; data: string[] }
  | { type: 'variableStats'; stats: VariableStatsResult }
  | { type: 'recodeComplete'; newColName: string }
  | { type: 'persistedDataFound'; schema: { name: string; type: string }[]; rowCount: number; metadata?: PersistedMetadata }
  | { type: 'noPersistedData' }
  | { type: 'persistedDataCleared' }
  | { type: 'pong'; hasData: boolean; rowCount?: number }
  | { type: 'processedData'; requestId?: string; result: ProcessedAnalysisData | null }
  | { type: 'analysisResult'; id: string; result: any; durationMs: number }
  | { type: 'arrowExported'; buffer: ArrayBuffer; rowCount: number; durationMs: number }
  | { type: 'error'; message: string };
