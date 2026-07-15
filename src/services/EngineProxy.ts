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
  WorkerProcessDataOptions,
} from '../types/engineWorker';
import type { ResultEnvelope } from '../engine/types';
import { isEngineMessage } from '../types/engineWorker';
import type { Variable, AggregatedRow, TableStats, RecodeConfig, MissingValueDef } from '../types';
import type { OrderedScoring, VariableType } from '../types';
import type { ProcessedAnalysisData } from '../types/processedData';
import type { ChartType } from '../types/charts';
import type { CrosstabQueryOptions, WorkerAnalysisSettings, WorkerAnalysisContext } from '../types/worker';
import type { BootTraceEvent } from '../types/bootTrace';
import { mergeBootTraceEvent, recordBootTrace } from './bootTrace';

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
type BootTraceCallback = (event: BootTraceEvent) => void;

export interface EngineProxyOptions {
  /** Timeout per request in ms. Defaults to 120_000 (2 min). */
  timeoutMs?: number;
  /** Called on load-progress messages during file loading. */
  onProgress?: ProgressCallback;
  /** Called on persistence status updates during init. */
  onPersistenceStatus?: PersistenceStatusCallback;
  /** Called on corruption detection. */
  onCorruption?: CorruptionCallback;
  /** Called when the underlying worker throws a runtime or message error. */
  onWorkerError?: (message: string) => void;
  /** Called for bounded structured lifecycle events emitted by the worker. */
  onBootTrace?: BootTraceCallback;
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
  private onWorkerError?: (message: string) => void;
  private onBootTrace?: BootTraceCallback;
  private disposed = false;
  private datasetContext = { datasetName: 'unloaded', rowCount: 0 };

  constructor(worker: Worker, options: EngineProxyOptions = {}) {
    this.worker = worker;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onProgress = options.onProgress;
    this.onPersistenceStatus = options.onPersistenceStatus;
    this.onCorruption = options.onCorruption;
    this.onWorkerError = options.onWorkerError;
    this.onBootTrace = options.onBootTrace;

    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerRuntimeError);
    this.worker.addEventListener('messageerror', this.handleWorkerMessageError);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async init(opts?: {
    forceCleanStart?: boolean;
    datasetId?: string;
    schemaVersion?: number;
    hasPersistedSource?: boolean;
    bootCorrelationId?: string;
    persistenceMode?: 'auto' | 'memory';
  }): Promise<EngineResponseByType<'engine.ready'>> {
    return this.send(
      {
        type: 'engine.init',
        forceCleanStart: opts?.forceCleanStart,
        datasetId: opts?.datasetId,
        schemaVersion: opts?.schemaVersion,
        hasPersistedSource: opts?.hasPersistedSource,
        bootCorrelationId: opts?.bootCorrelationId,
        persistenceMode: opts?.persistenceMode,
      },
      'engine.ready',
    ) as Promise<EngineResponseByType<'engine.ready'>>;
  }

  async ping(): Promise<EngineResponseByType<'engine.pong'>> {
    return this.send({ type: 'engine.ping' }, 'engine.pong') as Promise<EngineResponseByType<'engine.pong'>>;
  }

  /**
   * Gracefully tear down the worker: ask it to release its OPFS handle + lock,
   * wait for the acknowledgement (bounded), then terminate. Falls back to a hard
   * terminate if the worker is wedged or the ack times out — so callers can
   * always safely spawn a replacement worker afterwards.
   */
  async shutdown(ackTimeoutMs = 3000): Promise<void> {
    if (this.disposed) return;
    try {
      await this.send({ type: 'engine.shutdown' }, 'engine.shutdownComplete', undefined, ackTimeoutMs);
    } catch {
      // Wedged worker or ack timeout — fall through to hard terminate.
    } finally {
      this.terminate();
    }
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  async checkPersistedData(): Promise<
    EngineResponseByType<'engine.persistedDataFound'> | EngineResponseByType<'engine.noPersistedData'>
  > {
    return this.send({ type: 'engine.checkPersistedData' }, [
      'engine.persistedDataFound',
      'engine.noPersistedData',
    ]) as Promise<EngineResponseByType<'engine.persistedDataFound'> | EngineResponseByType<'engine.noPersistedData'>>;
  }

  async clearPersistedData(): Promise<void> {
    await this.send({ type: 'engine.clearPersistedData' }, 'engine.persistedDataCleared');
  }

  async flushPersistedData(): Promise<EngineResponseByType<'engine.flushComplete'>> {
    return this.send({ type: 'engine.flushPersistedData' }, 'engine.flushComplete') as Promise<
      EngineResponseByType<'engine.flushComplete'>
    >;
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
    return this.send({ type: 'engine.loadCSV', fileName, content }, 'engine.csvLoaded') as Promise<
      EngineResponseByType<'engine.csvLoaded'>
    >;
  }

  async loadSAV(buffer: ArrayBuffer, forceChunked?: boolean): Promise<EngineResponseByType<'engine.savLoaded'>> {
    return this.send({ type: 'engine.loadSAV', buffer, forceChunked }, 'engine.savLoaded', [buffer]) as Promise<
      EngineResponseByType<'engine.savLoaded'>
    >;
  }

  async loadSAVMetadata(buffer: ArrayBuffer): Promise<EngineResponseByType<'engine.savMetadataLoaded'>> {
    return this.send({ type: 'engine.loadSAVMetadata', buffer }, 'engine.savMetadataLoaded', [buffer]) as Promise<
      EngineResponseByType<'engine.savMetadataLoaded'>
    >;
  }

  async loadSAVSample(
    buffer: ArrayBuffer,
    rowLimit: number,
    strategy?: 'sequential' | 'spread',
  ): Promise<EngineResponseByType<'engine.savSampleLoaded'>> {
    return this.send({ type: 'engine.loadSAVSample', buffer, rowLimit, strategy }, 'engine.savSampleLoaded', [
      buffer,
    ]) as Promise<EngineResponseByType<'engine.savSampleLoaded'>>;
  }

  // ==========================================================================
  // Querying
  // ==========================================================================

  async query(sql: string): Promise<EngineResponseByType<'engine.queryResult'>> {
    return this.send({ type: 'engine.query', sql }, 'engine.queryResult') as Promise<
      EngineResponseByType<'engine.queryResult'>
    >;
  }

  async getSchema(): Promise<EngineResponseByType<'engine.schema'>> {
    return this.send({ type: 'engine.getSchema' }, 'engine.schema') as Promise<EngineResponseByType<'engine.schema'>>;
  }

  async getUniqueValues(column: string): Promise<EngineResponseByType<'engine.uniqueValues'>> {
    return this.send({ type: 'engine.getUniqueValues', column }, 'engine.uniqueValues') as Promise<
      EngineResponseByType<'engine.uniqueValues'>
    >;
  }

  async getVariableStats(
    column: string,
    variableType?: VariableType,
    orderedScoring?: OrderedScoring,
    binCount?: number,
    missingValues?: MissingValueDef,
  ): Promise<ResultEnvelope<VariableStatsResult>> {
    const t0 = performance.now();
    const raw = (await this.send(
      { type: 'engine.getVariableStats', column, variableType, orderedScoring, binCount, missingValues },
      'engine.variableStats',
    )) as EngineResponseByType<'engine.variableStats'>;
    return this.wrapResult(
      'getVariableStats',
      { column, variableType: variableType ?? null },
      raw.stats,
      performance.now() - t0,
    );
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  async runCrosstab(
    options: CrosstabQueryOptions & { includeDistributions?: boolean },
    context: WorkerAnalysisContext,
    analysisSettings?: WorkerAnalysisSettings,
    includeProcessedData?: WorkerProcessDataOptions,
  ): Promise<
    ResultEnvelope<{
      rows: AggregatedRow[];
      tableStats: TableStats | null;
      processedData?: ProcessedAnalysisData | null;
      timings?: EngineResponseByType<'engine.queryResult'>['timings'];
    }>
  > {
    const raw = (await this.send(
      { type: 'engine.runCrosstab', options, context, analysisSettings, includeProcessedData },
      'engine.queryResult',
    )) as EngineResponseByType<'engine.queryResult'>;
    return this.wrapResult(
      'runCrosstab',
      { rowVars: options.rowVars, colVar: options.colVar ?? null },
      {
        rows: raw.data as AggregatedRow[],
        tableStats: raw.tableStats ?? null,
        processedData: raw.processedData,
        timings: raw.timings,
      },
      raw.durationMs,
      options.filters?.length ?? 0,
      !!options.weightVar,
    );
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
    return this.send({ type: 'engine.processData', data, options, chartType }, 'engine.processedData') as Promise<
      EngineResponseByType<'engine.processedData'>
    >;
  }

  // ==========================================================================
  // Transformations
  // ==========================================================================

  async recodeVariable(
    sourceCol: string,
    newColName: string,
    config: RecodeConfig,
  ): Promise<EngineResponseByType<'engine.recodeComplete'>> {
    return this.send(
      { type: 'engine.recodeVariable', sourceCol, newColName, config },
      'engine.recodeComplete',
    ) as Promise<EngineResponseByType<'engine.recodeComplete'>>;
  }

  async dropColumn(column: string): Promise<EngineResponseByType<'engine.columnDropped'>> {
    return this.send({ type: 'engine.dropColumn', column }, 'engine.columnDropped') as Promise<
      EngineResponseByType<'engine.columnDropped'>
    >;
  }

  async updateColumn(
    sourceCol: string,
    targetCol: string,
    config: RecodeConfig,
  ): Promise<EngineResponseByType<'engine.columnUpdated'>> {
    return this.send({ type: 'engine.updateColumn', sourceCol, targetCol, config }, 'engine.columnUpdated') as Promise<
      EngineResponseByType<'engine.columnUpdated'>
    >;
  }

  async fillSystemMissing(
    column: string,
    value: number | string,
  ): Promise<EngineResponseByType<'engine.fillSystemMissingComplete'>> {
    return this.send(
      { type: 'engine.fillSystemMissing', column, value },
      'engine.fillSystemMissingComplete',
    ) as Promise<EngineResponseByType<'engine.fillSystemMissingComplete'>>;
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  async exportArrow(sql: string, columns?: string[]): Promise<EngineResponseByType<'engine.arrowExported'>> {
    return this.send({ type: 'engine.exportArrow', sql, columns }, 'engine.arrowExported') as Promise<
      EngineResponseByType<'engine.arrowExported'>
    >;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  dispose(): void {
    this.disposed = true;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleWorkerRuntimeError);
    this.worker.removeEventListener('messageerror', this.handleWorkerMessageError);
    this.rejectAllPending(new Error('EngineProxy disposed'));
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

  /** Update dataset context used to populate ResultEnvelope metadata. Call after loadSAV/loadCSV. */
  setDatasetContext(datasetName: string, rowCount: number): void {
    this.datasetContext = { datasetName, rowCount };
  }

  // ==========================================================================
  // Internal
  // ==========================================================================

  private wrapResult<T>(
    operation: string,
    inputs: Record<string, unknown>,
    data: T,
    durationMs: number,
    filtersApplied = 0,
    isWeighted = false,
  ): ResultEnvelope<T> {
    return {
      data,
      operation,
      inputs,
      durationMs,
      warnings: [],
      metadata: {
        datasetName: this.datasetContext.datasetName,
        rowCount: this.datasetContext.rowCount,
        filtersApplied,
        isWeighted,
        engineVersion: 'browser-wasm',
      },
    };
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private handleWorkerRuntimeError = (event: ErrorEvent): void => {
    const message = event.message || 'Worker runtime error';
    recordBootTrace({ source: 'main', phase: 'analysis_worker.runtime', status: 'error', detail: { message } });
    console.error('[EngineProxy] Worker runtime error:', message);
    this.onWorkerError?.(message);
    this.rejectAllPending(new Error(message));
  };

  /**
   * Non-engine messages (Vite dev plumbing, DuckDB internals) can occasionally fail
   * structured clone on the worker port. Ignore them — engine protocol responses are
   * sanitized in postEngineResponse and handled in handleMessage.
   */
  private handleWorkerMessageError = (): void => {
    console.warn('[EngineProxy] Ignored worker message that failed deserialization');
  };

  private send(
    payload: Record<string, unknown> & { type: string },
    _expectedType: string | string[],
    transfer?: Transferable[],
    timeoutMs?: number,
  ): Promise<EngineWorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new Error('EngineProxy is disposed'));
    }

    const requestId = crypto.randomUUID();
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;

    return new Promise<EngineWorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        recordBootTrace({
          source: 'main',
          phase: payload.type,
          status: 'timeout',
          detail: { timeoutMs: effectiveTimeout },
        });
        reject(new Error(`EngineProxy timeout after ${effectiveTimeout}ms for ${payload.type}`));
      }, effectiveTimeout);

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
    if (msg.type === 'engine.bootTrace') {
      const event = (msg as EngineResponseByType<'engine.bootTrace'>).event;
      mergeBootTraceEvent(event);
      this.onBootTrace?.(event);
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
