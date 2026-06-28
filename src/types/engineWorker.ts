/**
 * Engine Worker Message Protocol
 *
 * Request-ID-based typed messages for EngineProxy <-> Worker communication.
 * Replaces the ad-hoc WorkerRequest/WorkerResponse protocol with structured,
 * collision-free messages aligned to VelocityEngine's public API.
 *
 * Every request carries a `requestId` (UUID). The worker echoes it in the
 * response, enabling EngineProxy to route concurrent responses correctly.
 */

import type { RecodeConfig, Variable, VariableSet, AggregatedRow, TableStats, MissingValueDef } from './index';
import type { OrderedScoring, VariableType } from './index';
import type { CrosstabQueryOptions } from '../core/sql/queryBuilder';
import type { ProcessedAnalysisData } from './processedData';
import type { ChartType } from './charts';
import type { VariableMapping } from './harmonization';
import type {
  WorkerAnalysisSettings,
  WorkerAnalysisContext,
  PersistedMetadata,
  VariableStatsResult,
  VariableStatsFrequency,
  NumericStats,
} from './worker';

// Re-export for convenience
export type { VariableStatsResult, VariableStatsFrequency, NumericStats, PersistedMetadata };

export interface WorkerProcessDataOptions {
  rowVariables: Variable[];
  colVariable: Variable | null;
  isWeighted?: boolean;
  isMultipleResponse?: boolean;
  chartType?: ChartType;
}

// ============================================================================
// Engine Request Types (Main Thread -> Worker)
// ============================================================================

interface EngineRequestBase {
  requestId: string; // Required — every request gets a UUID
}

export type EngineWorkerRequest = EngineRequestBase &
  // --- Lifecycle ---
  (
    | { type: 'engine.init'; forceCleanStart?: boolean; datasetId?: string; schemaVersion?: number }
    | { type: 'engine.close' }
    | { type: 'engine.ping' }

    // --- Persistence ---
    | { type: 'engine.setPersistenceContext'; datasetId?: string; schemaVersion?: number }
    | { type: 'engine.updatePersistenceMetadata'; metadata: PersistedMetadata }
    | { type: 'engine.checkPersistedData' }
    | { type: 'engine.clearPersistedData' }
    | { type: 'engine.flushPersistedData' }

    // --- Data Loading ---
    | { type: 'engine.loadCSV'; fileName: string; content: string }
    | { type: 'engine.loadSAV'; buffer: ArrayBuffer; forceChunked?: boolean }
    | { type: 'engine.loadSAVMetadata'; buffer: ArrayBuffer }
    | { type: 'engine.loadSAVSample'; buffer: ArrayBuffer; rowLimit: number; strategy?: 'sequential' | 'spread' }

    // --- Querying ---
    | { type: 'engine.query'; sql: string }
    | { type: 'engine.getSchema' }
    | { type: 'engine.getUniqueValues'; column: string }
    | {
        type: 'engine.getVariableStats';
        column: string;
        variableType?: VariableType;
        orderedScoring?: OrderedScoring;
        binCount?: number;
        missingValues?: MissingValueDef;
      }

    // --- Analysis ---
    | {
        type: 'engine.runCrosstab';
        options: CrosstabQueryOptions & { includeDistributions?: boolean };
        analysisSettings?: WorkerAnalysisSettings;
        context: WorkerAnalysisContext;
        includeProcessedData?: WorkerProcessDataOptions;
      }
    | {
        type: 'engine.runAnalysis';
        id: string;
        config: Record<string, unknown>;
      }
    | {
        type: 'engine.processData';
        data: AggregatedRow[];
        options: Omit<WorkerProcessDataOptions, 'chartType'>;
        chartType?: ChartType;
      }

    // --- Transformations ---
    | { type: 'engine.recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
    | { type: 'engine.dropColumn'; column: string }
    | { type: 'engine.updateColumn'; sourceCol: string; targetCol: string; config: RecodeConfig }
    | { type: 'engine.fillSystemMissing'; column: string; value: number | string }

    // --- Export ---
    | { type: 'engine.exportArrow'; sql: string; columns?: string[] }

    // --- Harmonization ---
    | { type: 'engine.getValueFrequencies'; tableName: string; columnName: string }
    | {
        type: 'engine.buildHarmonizedTable';
        sourceTable: string;
        targetTable: string;
        mappings: VariableMapping[];
        outputTableName: string;
        sourceVarNames?: Record<string, string>;
        targetVarNames?: Record<string, string>;
      }
    | { type: 'engine.getRespondentOverlap'; sourceTable: string; targetTable: string; keyColumn: string }
  );

// ============================================================================
// Engine Response Types (Worker -> Main Thread)
// ============================================================================

interface EngineResponseBase {
  requestId: string; // Echoes the request's UUID
}

export type EngineWorkerResponse = EngineResponseBase &
  // --- Lifecycle ---
  (
    | { type: 'engine.ready'; opfsAvailable: boolean }
    | { type: 'engine.closed' }
    | { type: 'engine.pong'; hasData: boolean; rowCount?: number }

    // --- Persistence ---
    | {
        type: 'engine.persistenceStatus';
        opfsAvailable: boolean;
        mode: 'opfs' | 'memory' | 'disabled';
        dbPath: string;
        lastError?: string;
      }
    | { type: 'engine.corruptionDetected'; message: string }
    | {
        type: 'engine.persistedDataFound';
        schema: { name: string; type: string }[];
        rowCount: number;
        metadata?: PersistedMetadata;
      }
    | { type: 'engine.noPersistedData' }
    | { type: 'engine.persistedDataCleared' }
    | { type: 'engine.flushComplete'; ok: boolean; durationMs: number; error?: string }

    // --- Data Loading ---
    | { type: 'engine.csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number }
    | {
        type: 'engine.savLoaded';
        variables: Variable[];
        variableSets: VariableSet[];
        rowCount: number;
        durationMs: number;
      }
    | {
        type: 'engine.savMetadataLoaded';
        variables: Variable[];
        variableSets: VariableSet[];
        rowCount: number;
        durationMs: number;
      }
    | {
        type: 'engine.savSampleLoaded';
        variables: Variable[];
        variableSets: VariableSet[];
        rowCount: number;
        sampleRowCount: number;
        sampleStrategy: 'sequential' | 'spread';
        durationMs: number;
      }
    | {
        type: 'engine.loadProgress';
        phase: 'parsing' | 'inserting' | 'complete';
        progress: number;
        rowsProcessed?: number;
        totalRows?: number;
        message: string;
      }

    // --- Querying ---
    | {
        type: 'engine.queryResult';
        data: Array<AggregatedRow | Record<string, unknown>>;
        durationMs: number;
        tableStats?: TableStats;
        processedData?: ProcessedAnalysisData | null;
        timings?: {
          queryMs: number;
          processMs?: number;
          totalMs: number;
        };
      }
    | { type: 'engine.schema'; data: { name: string; type: string }[] }
    | { type: 'engine.uniqueValues'; data: string[] }
    | { type: 'engine.variableStats'; stats: VariableStatsResult }

    // --- Analysis ---
    | { type: 'engine.analysisResult'; id: string; result: Record<string, unknown> | null; durationMs: number }
    | { type: 'engine.processedData'; result: ProcessedAnalysisData | null; durationMs?: number }

    // --- Transformations ---
    | { type: 'engine.recodeComplete'; newColName: string }
    | { type: 'engine.columnDropped'; column: string }
    | { type: 'engine.columnUpdated'; column: string }
    | { type: 'engine.fillSystemMissingComplete'; column: string }

    // --- Export ---
    | { type: 'engine.arrowExported'; buffer: ArrayBuffer; rowCount: number; durationMs: number }

    // --- Harmonization ---
    | { type: 'engine.valueFrequencies'; column: string; frequencies: Array<{ value: number; count: number }> }
    | { type: 'engine.harmonizedTableCreated'; tableName: string; rowCount: number; durationMs: number }
    | { type: 'engine.respondentOverlap'; totalSource: number; totalTarget: number; overlap: number }

    // --- Errors ---
    | { type: 'engine.error'; message: string; code?: string }
  );

// ============================================================================
// Discriminated helpers
// ============================================================================

/** Extract a specific response type by its `type` field. */
export type EngineResponseByType<T extends EngineWorkerResponse['type']> = Extract<EngineWorkerResponse, { type: T }>;

/** Check if a message is an engine-protocol message (type starts with 'engine.'). */
export function isEngineMessage(msg: { type: string }): boolean {
  return msg.type.startsWith('engine.');
}
