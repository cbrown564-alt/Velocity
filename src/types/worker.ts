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

/** Base fields shared by all worker requests */
interface WorkerRequestBase {
  requestId?: string;
}

export type WorkerRequest =
  | (WorkerRequestBase & { type: 'init'; forceCleanStart?: boolean; datasetId?: string; schemaVersion?: number })
  | (WorkerRequestBase & { type: 'setPersistenceContext'; datasetId?: string; schemaVersion?: number })
  | (WorkerRequestBase & { type: 'updatePersistenceMetadata'; metadata: PersistedMetadata })
  | (WorkerRequestBase & { type: 'loadCSV'; fileName: string; content: string })
  | (WorkerRequestBase & { type: 'loadSAV'; buffer: ArrayBuffer; forceChunked?: boolean })
  | (WorkerRequestBase & { type: 'loadSAVMetadata'; buffer: ArrayBuffer })
  | (WorkerRequestBase & { type: 'loadSAVSample'; buffer: ArrayBuffer; rowLimit: number; strategy?: 'sequential' | 'spread' })
  | (WorkerRequestBase & { type: 'flushPersistedData' })
  | (WorkerRequestBase & { type: 'query'; sql: string })
  | (WorkerRequestBase & { type: 'getSchema' })
  | (WorkerRequestBase & { type: 'getUniqueValues'; column: string })
  | (WorkerRequestBase & { type: 'getVariableStats'; column: string; variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date'; binCount?: number })
  | (WorkerRequestBase & { type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig })
  | (WorkerRequestBase & { type: 'checkPersistedData' })
  | (WorkerRequestBase & { type: 'clearPersistedData' })
  | (WorkerRequestBase & {
    type: 'runCrosstab';
    options: CrosstabQueryOptions & { includeDistributions?: boolean };
    context: {
      variables: Record<string, Variable>;
      variableSets: Record<string, VariableSet>;
    }
  })
  | (WorkerRequestBase & {
    type: 'processData';
    data: AggregatedRow[];
    options: {
      rowVariables: Variable[];
      colVariable: Variable | null;
      isWeighted?: boolean;
      isMultipleResponse?: boolean;
    };
    chartType?: ChartType;
  })
  | (WorkerRequestBase & { type: 'runAnalysis'; id: string; config: any })
  | (WorkerRequestBase & { type: 'exportArrow'; sql: string; columns?: string[] })
  | (WorkerRequestBase & { type: 'ping' });

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

/** Base fields shared by all worker responses */
interface WorkerResponseBase {
  requestId?: string;
}

export type WorkerResponse =
  | (WorkerResponseBase & { type: 'ready'; opfsAvailable: boolean })
  | (WorkerResponseBase & { type: 'persistenceStatus'; opfsAvailable: boolean; mode: 'opfs' | 'memory' | 'disabled'; dbPath: string; lastError?: string })
  | (WorkerResponseBase & { type: 'corruptionDetected'; message: string })
  | (WorkerResponseBase & { type: 'schema'; data: { name: string; type: string }[] })
  | (WorkerResponseBase & { type: 'csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number })
  | (WorkerResponseBase & { type: 'savLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number })
  | (WorkerResponseBase & { type: 'savMetadataLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number })
  | (WorkerResponseBase & { type: 'savSampleLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; sampleRowCount: number; sampleStrategy: 'sequential' | 'spread'; durationMs: number })
  | (WorkerResponseBase & { type: 'loadProgress'; phase: 'parsing' | 'inserting' | 'complete'; progress: number; rowsProcessed?: number; totalRows?: number; message: string })
  | (WorkerResponseBase & { type: 'flushComplete'; ok: boolean; durationMs: number; error?: string })
  | (WorkerResponseBase & { type: 'queryResult'; data: any[]; durationMs: number; tableStats?: TableStats })
  | (WorkerResponseBase & { type: 'uniqueValues'; data: string[] })
  | (WorkerResponseBase & { type: 'variableStats'; stats: VariableStatsResult })
  | (WorkerResponseBase & { type: 'recodeComplete'; newColName: string })
  | (WorkerResponseBase & { type: 'persistedDataFound'; schema: { name: string; type: string }[]; rowCount: number; metadata?: PersistedMetadata })
  | (WorkerResponseBase & { type: 'noPersistedData' })
  | (WorkerResponseBase & { type: 'persistedDataCleared' })
  | (WorkerResponseBase & { type: 'pong'; hasData: boolean; rowCount?: number })
  | (WorkerResponseBase & { type: 'processedData'; result: ProcessedAnalysisData | null })
  | (WorkerResponseBase & { type: 'analysisResult'; id: string; result: any; durationMs: number })
  | (WorkerResponseBase & { type: 'arrowExported'; buffer: ArrayBuffer; rowCount: number; durationMs: number })
  | (WorkerResponseBase & { type: 'error'; message: string });
