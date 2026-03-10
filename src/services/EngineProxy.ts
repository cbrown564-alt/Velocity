/**
 * EngineProxy
 *
 * Main-thread class that mirrors the VelocityEngine API surface but delegates
 * every call to the Web Worker via typed postMessage with request IDs.
 *
 * Solves the P0 worker message collision bug: every request gets a UUID,
 * and the worker echoes it in the response. Concurrent requests are
 * routed to their correct callers.
 *
 * From the store's perspective, EngineProxy looks identical to calling
 * VelocityEngine directly — it returns promises with typed results.
 */

import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
  EngineResponseByType,
  PersistedMetadata,
  VariableStatsResult,
} from '../types/engineWorker';
import { isEngineMessage } from '../types/engineWorker';
import type { Variable, VariableSet, AggregatedRow, TableStats, RecodeConfig, MissingValueDef } from '../types';
import type { OrderedScoring, VariableType } from '../types';
import type { CrosstabQueryOptions } from './queryBuilder';
import type { ProcessedAnalysisData } from '../types/processedData';
import type { ChartType } from '../types/charts';
import type { WorkerAnalysisSettings, WorkerAnalysisContext } from '../types/worker';
import type { VariableMapping } from '../types/harmonization';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

// ============================================================================
// Types
// ============================================================================

interface PendingRequest {
  resolve: (value: EngineWorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type ProgressCallback = (msg: EngineResponseByType<'engine.loadProgress'>) => void;
type PersistenceStatusCallback = (msg: EngineResponseByType<'engine.persistenceStatus'>) => void;
type CorruptionCallback = (msg: EngineResponseByType<'engine.corruptionDetected'>) => void;

export interface EngineProxyOptions {
  /** Timeout per request in ms. Defaults to 120_000 (2 min). */
  timeoutMs?: number;
  /** Called on load-progress messages during file loading. */
  onProgress?: ProgressCallback;
  /** Called on persistence status updates during init. */
  onPersistenceStatus?: PersistenceStatusCallback;
  /** Called on corruption detection. */
  onCorruption?: CorruptionCallback;
}

// ============================================================================
// EngineProxy
// ============================================================================

export class EngineProxy {
  private worker: Worker;
  private pending = new Map<string, PendingRequest>();
  private timeoutMs: number;
  private onProgress?: ProgressCallback;
  private onPersistenceStatus?: PersistenceStatusCallback;
  private onCorruption?: CorruptionCallback;
  private disposed = false;

  constructor(worker: Worker, options: EngineProxyOptions = {}) {
    this.worker = worker;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onProgress = options.onProgress;
    this.onPersistenceStatus = options.onPersistenceStatus;
    this.onCorruption = options.onCorruption;

    this.worker.addEventListener('message', this.handleMessage);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async init(opts?: { forceCleanStart?: boolean; datasetId?: string; schemaVersion?: number }): Promise<EngineResponseByType<'engine.ready'>> {
    return this.send({
      type: 'engine.init',
      forceCleanStart: opts?.forceCleanStart,
      datasetId: opts?.datasetId,
      schemaVersion: opts?.schemaVersion,
    }, 'engine.ready') as Promise<EngineResponseByType<'engine.ready'>>;
  }

  async ping(): Promise<EngineResponseByType<'engine.pong'>> {
    return this.send({ type: 'engine.ping' }, 'engine.pong') as Promise<EngineResponseByType<'engine.pong'>>;
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  async checkPersistedData(): Promise<EngineResponseByType<'engine.persistedDataFound'> | EngineResponseByType<'engine.noPersistedData'>> {
    return this.send(
      { type: 'engine.checkPersistedData' },
      ['engine.persistedDataFound', 'engine.noPersistedData']
    ) as Promise<EngineResponseByType<'engine.persistedDataFound'> | EngineResponseByType<'engine.noPersistedData'>>;
  }

  async clearPersistedData(): Promise<void> {
    await this.send({ type: 'engine.clearPersistedData' }, 'engine.persistedDataCleared');
  }

  async flushPersistedData(): Promise<EngineResponseByType<'engine.flushComplete'>> {
    return this.send({ type: 'engine.flushPersistedData' }, 'engine.flushComplete') as Promise<EngineResponseByType<'engine.flushComplete'>>;
  }

  async updatePersistenceMetadata(metadata: PersistedMetadata): Promise<void> {
    // Fire-and-forget style: no specific response expected, but we still use requestId
    // The worker will echo back; we'll just ignore the response.
    const requestId = crypto.randomUUID();
    this.worker.postMessage({
      type: 'engine.updatePersistenceMetadata',
      requestId,
      metadata,
    } satisfies EngineWorkerRequest);
  }

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  async loadCSV(fileName: string, content: string): Promise<EngineResponseByType<'engine.csvLoaded'>> {
    return this.send(
      { type: 'engine.loadCSV', fileName, content },
      'engine.csvLoaded'
    ) as Promise<EngineResponseByType<'engine.csvLoaded'>>;
  }

  async loadSAV(buffer: ArrayBuffer, forceChunked?: boolean): Promise<EngineResponseByType<'engine.savLoaded'>> {
    return this.send(
      { type: 'engine.loadSAV', buffer, forceChunked },
      'engine.savLoaded',
      [buffer],
    ) as Promise<EngineResponseByType<'engine.savLoaded'>>;
  }

  async loadSAVMetadata(buffer: ArrayBuffer): Promise<EngineResponseByType<'engine.savMetadataLoaded'>> {
    return this.send(
      { type: 'engine.loadSAVMetadata', buffer },
      'engine.savMetadataLoaded',
      [buffer],
    ) as Promise<EngineResponseByType<'engine.savMetadataLoaded'>>;
  }

  async loadSAVSample(
    buffer: ArrayBuffer,
    rowLimit: number,
    strategy?: 'sequential' | 'spread',
  ): Promise<EngineResponseByType<'engine.savSampleLoaded'>> {
    return this.send(
      { type: 'engine.loadSAVSample', buffer, rowLimit, strategy },
      'engine.savSampleLoaded',
      [buffer],
    ) as Promise<EngineResponseByType<'engine.savSampleLoaded'>>;
  }

  // ==========================================================================
  // Querying
  // ==========================================================================

  async query(sql: string): Promise<EngineResponseByType<'engine.queryResult'>> {
    return this.send(
      { type: 'engine.query', sql },
      'engine.queryResult'
    ) as Promise<EngineResponseByType<'engine.queryResult'>>;
  }

  async getSchema(): Promise<EngineResponseByType<'engine.schema'>> {
    return this.send(
      { type: 'engine.getSchema' },
      'engine.schema'
    ) as Promise<EngineResponseByType<'engine.schema'>>;
  }

  async getUniqueValues(column: string): Promise<EngineResponseByType<'engine.uniqueValues'>> {
    return this.send(
      { type: 'engine.getUniqueValues', column },
      'engine.uniqueValues'
    ) as Promise<EngineResponseByType<'engine.uniqueValues'>>;
  }

  async getVariableStats(
    column: string,
    variableType?: VariableType,
    orderedScoring?: OrderedScoring,
    binCount?: number,
    missingValues?: MissingValueDef,
  ): Promise<EngineResponseByType<'engine.variableStats'>> {
    return this.send(
      { type: 'engine.getVariableStats', column, variableType, orderedScoring, binCount, missingValues },
      'engine.variableStats'
    ) as Promise<EngineResponseByType<'engine.variableStats'>>;
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  async runCrosstab(
    options: CrosstabQueryOptions & { includeDistributions?: boolean },
    context: WorkerAnalysisContext,
    analysisSettings?: WorkerAnalysisSettings,
  ): Promise<EngineResponseByType<'engine.queryResult'>> {
    return this.send(
      { type: 'engine.runCrosstab', options, context, analysisSettings },
      'engine.queryResult'
    ) as Promise<EngineResponseByType<'engine.queryResult'>>;
  }

  async processData(
    data: AggregatedRow[],
    options: {
      rowVariables: Variable[];
      colVariable: Variable | null;
      isWeighted?: boolean;
      isMultipleResponse?: boolean;
    },
    chartType?: ChartType,
  ): Promise<EngineResponseByType<'engine.processedData'>> {
    return this.send(
      { type: 'engine.processData', data, options, chartType },
      'engine.processedData'
    ) as Promise<EngineResponseByType<'engine.processedData'>>;
  }

  // ==========================================================================
  // Transformations
  // ==========================================================================

  async recodeVariable(sourceCol: string, newColName: string, config: RecodeConfig): Promise<EngineResponseByType<'engine.recodeComplete'>> {
    return this.send(
      { type: 'engine.recodeVariable', sourceCol, newColName, config },
      'engine.recodeComplete'
    ) as Promise<EngineResponseByType<'engine.recodeComplete'>>;
  }

  async dropColumn(column: string): Promise<EngineResponseByType<'engine.columnDropped'>> {
    return this.send(
      { type: 'engine.dropColumn', column },
      'engine.columnDropped'
    ) as Promise<EngineResponseByType<'engine.columnDropped'>>;
  }

  async updateColumn(sourceCol: string, targetCol: string, config: RecodeConfig): Promise<EngineResponseByType<'engine.columnUpdated'>> {
    return this.send(
      { type: 'engine.updateColumn', sourceCol, targetCol, config },
      'engine.columnUpdated'
    ) as Promise<EngineResponseByType<'engine.columnUpdated'>>;
  }

  async fillSystemMissing(column: string, value: number | string): Promise<EngineResponseByType<'engine.fillSystemMissingComplete'>> {
    return this.send(
      { type: 'engine.fillSystemMissing', column, value },
      'engine.fillSystemMissingComplete'
    ) as Promise<EngineResponseByType<'engine.fillSystemMissingComplete'>>;
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  async exportArrow(sql: string, columns?: string[]): Promise<EngineResponseByType<'engine.arrowExported'>> {
    return this.send(
      { type: 'engine.exportArrow', sql, columns },
      'engine.arrowExported'
    ) as Promise<EngineResponseByType<'engine.arrowExported'>>;
  }

  // ==========================================================================
  // Harmonization
  // ==========================================================================

  async getValueFrequencies(tableName: string, columnName: string): Promise<EngineResponseByType<'engine.valueFrequencies'>> {
    return this.send(
      { type: 'engine.getValueFrequencies', tableName, columnName },
      'engine.valueFrequencies'
    ) as Promise<EngineResponseByType<'engine.valueFrequencies'>>;
  }

  async buildHarmonizedTable(
    sourceTable: string,
    targetTable: string,
    mappings: VariableMapping[],
    outputTableName: string,
    sourceVarNames?: Record<string, string>,
    targetVarNames?: Record<string, string>,
  ): Promise<EngineResponseByType<'engine.harmonizedTableCreated'>> {
    return this.send(
      { type: 'engine.buildHarmonizedTable', sourceTable, targetTable, mappings, outputTableName, sourceVarNames, targetVarNames },
      'engine.harmonizedTableCreated'
    ) as Promise<EngineResponseByType<'engine.harmonizedTableCreated'>>;
  }

  async getRespondentOverlap(sourceTable: string, targetTable: string, keyColumn: string): Promise<EngineResponseByType<'engine.respondentOverlap'>> {
    return this.send(
      { type: 'engine.getRespondentOverlap', sourceTable, targetTable, keyColumn },
      'engine.respondentOverlap'
    ) as Promise<EngineResponseByType<'engine.respondentOverlap'>>;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  dispose(): void {
    this.disposed = true;
    this.worker.removeEventListener('message', this.handleMessage);

    // Reject all pending requests
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('EngineProxy disposed'));
    }
    this.pending.clear();
  }

  /** Terminate the underlying worker and dispose. */
  terminate(): void {
    this.dispose();
    this.worker.terminate();
  }

  /** Get the underlying Worker instance (for backward compat during migration). */
  getWorker(): Worker {
    return this.worker;
  }

  // ==========================================================================
  // Internal
  // ==========================================================================

  private send(
    payload: Record<string, unknown> & { type: string },
    expectedType: string | string[],
    transfer?: Transferable[],
  ): Promise<EngineWorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new Error('EngineProxy is disposed'));
    }

    const requestId = crypto.randomUUID();
    const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];

    return new Promise<EngineWorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`EngineProxy timeout after ${this.timeoutMs}ms for ${payload.type}`));
      }, this.timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });

      const message = { ...payload, requestId } as EngineWorkerRequest;
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(message, transfer);
      } else {
        this.worker.postMessage(message);
      }
    });
  }

  private handleMessage = (event: MessageEvent<EngineWorkerResponse>): void => {
    const msg = event.data;

    // Ignore non-engine messages (legacy protocol during migration)
    if (!msg || typeof msg.type !== 'string' || !isEngineMessage(msg)) {
      return;
    }

    // Handle broadcast messages (no matching pending request)
    if (msg.type === 'engine.loadProgress') {
      this.onProgress?.(msg as EngineResponseByType<'engine.loadProgress'>);
      return;
    }
    if (msg.type === 'engine.persistenceStatus') {
      this.onPersistenceStatus?.(msg as EngineResponseByType<'engine.persistenceStatus'>);
      // Also route to pending if there's a matching request
    }
    if (msg.type === 'engine.corruptionDetected') {
      this.onCorruption?.(msg as EngineResponseByType<'engine.corruptionDetected'>);
      // Also route to pending if there's a matching request
    }

    // Route to pending request by requestId
    const requestId = msg.requestId;
    if (!requestId) return;

    const pending = this.pending.get(requestId);
    if (!pending) return;

    // Error responses reject the promise
    if (msg.type === 'engine.error') {
      this.pending.delete(requestId);
      clearTimeout(pending.timer);
      pending.reject(new Error((msg as EngineResponseByType<'engine.error'>).message));
      return;
    }

    // Persistence status and corruption are broadcast but also sent with requestId during init
    // They are intermediate — don't resolve the pending init request.
    if (msg.type === 'engine.persistenceStatus' || msg.type === 'engine.corruptionDetected') {
      return;
    }

    // Success response resolves the promise
    this.pending.delete(requestId);
    clearTimeout(pending.timer);
    pending.resolve(msg);
  };
}
