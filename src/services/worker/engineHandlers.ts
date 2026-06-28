import { processAnalysisData } from '../../core/analysis/analysisProcessor';
import { runCrosstab as coreRunCrosstab } from '../../core/analysis/crosstabRunner';
import { analysisRegistry } from '../../core/analysis/registry';
import { getVariableStats as coreGetVariableStats } from '../../core/analysis/variableStatsRunner';
import { buildCaseSql } from '../../core/transforms/recodeSql';
import type { EngineWorkerRequest } from '../../types/engineWorker';
import type { EngineMessageHandler } from './engineHandlerTypes';
import { transformChartData } from '../chartDataTransformer';
import { buildOpfsDbPath } from './duckdbOpfs';
import {
  checkPersistedData,
  clearPersistedData,
  flushPersistedData,
  getPersistenceStatus,
  init,
  isWriteModeCommitError,
  reopenInMemoryDatabase,
  reopenWritableDatabase,
  updateMeta,
} from './duckdbPersistence';
import { engineHandlersHarmonization } from './engineHandlersHarmonization';
import { toEngineLoadProgress } from './loadProgress';
import { postEngineResponse } from './engineMessaging';
import { loadCSV, loadSAV, loadSAVMetadata, loadSAVSample } from './workerIngestion';
import { fillSystemMissing, getSchema, getUniqueValues, recodeVariable, runQuery } from './workerQueries';
import { OPFS_SCHEMA_VERSION, workerDbState } from './workerDbState';

export type { EngineMessageHandler } from './engineHandlerTypes';

export const engineHandlers: Record<EngineWorkerRequest['type'], EngineMessageHandler> = {
  'engine.init': async (request) => {
    if (request.type !== 'engine.init') return;
    const { requestId } = request;
    if (request.datasetId || request.schemaVersion) {
      workerDbState.persistenceContext = {
        datasetId: request.datasetId,
        schemaVersion: request.schemaVersion ?? OPFS_SCHEMA_VERSION,
      };
    }
    const initResult = await init(request.forceCleanStart);
    if (initResult.corruptionDetected) {
      postEngineResponse({
        type: 'engine.corruptionDetected',
        requestId,
        message: initResult.corruptionMessage || 'OPFS database corruption detected',
      });
    }
    postEngineResponse({
      type: 'engine.persistenceStatus',
      requestId,
      ...getPersistenceStatus(),
    });
    postEngineResponse({
      type: 'engine.ready',
      requestId,
      opfsAvailable: initResult.opfsAvailable,
    });
  },

  'engine.ping': async (request) => {
    if (request.type !== 'engine.ping') return;
    const { requestId } = request;
    const { conn } = workerDbState;
    if (!conn) {
      postEngineResponse({ type: 'engine.pong', requestId, hasData: false });
      return;
    }
    try {
      const tableCheck = await conn.query(`
        SELECT COUNT(*) as cnt
        FROM information_schema.tables
        WHERE table_name = 'main'
      `);
      const mainTableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;
      if (mainTableExists) {
        const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
        const rowCount = Number(countResult.toArray()[0]?.cnt);
        postEngineResponse({ type: 'engine.pong', requestId, hasData: true, rowCount });
      } else {
        postEngineResponse({ type: 'engine.pong', requestId, hasData: false });
      }
    } catch {
      postEngineResponse({ type: 'engine.pong', requestId, hasData: false });
    }
  },

  'engine.setPersistenceContext': async (request) => {
    if (request.type !== 'engine.setPersistenceContext') return;
    workerDbState.persistenceContext = {
      datasetId: request.datasetId,
      schemaVersion: request.schemaVersion ?? OPFS_SCHEMA_VERSION,
    };
    if (!workerDbState.db) {
      workerDbState.activeDbPath = buildOpfsDbPath(
        workerDbState.persistenceContext.datasetId,
        workerDbState.persistenceContext.schemaVersion,
      );
    }
  },

  'engine.updatePersistenceMetadata': async (request) => {
    if (request.type !== 'engine.updatePersistenceMetadata') return;
    await updateMeta(request.metadata);
  },

  'engine.checkPersistedData': async (request) => {
    if (request.type !== 'engine.checkPersistedData') return;
    const { requestId } = request;
    const persistedResult = await checkPersistedData();
    if (persistedResult.exists) {
      postEngineResponse({
        type: 'engine.persistedDataFound',
        requestId,
        schema: persistedResult.schema!,
        rowCount: persistedResult.rowCount!,
        metadata: persistedResult.metadata || undefined,
      });
    } else {
      postEngineResponse({ type: 'engine.noPersistedData', requestId });
    }
  },

  'engine.clearPersistedData': async (request) => {
    if (request.type !== 'engine.clearPersistedData') return;
    await clearPersistedData();
    postEngineResponse({ type: 'engine.persistedDataCleared', requestId: request.requestId });
  },

  'engine.flushPersistedData': async (request) => {
    if (request.type !== 'engine.flushPersistedData') return;
    const flushResult = await flushPersistedData();
    postEngineResponse({
      type: 'engine.flushComplete',
      requestId: request.requestId,
      ok: flushResult.ok,
      durationMs: flushResult.durationMs,
      error: flushResult.error,
    });
  },

  'engine.loadCSV': async (request) => {
    if (request.type !== 'engine.loadCSV') return;
    const { requestId } = request;
    let csvResult;
    try {
      csvResult = await loadCSV(request.fileName, request.content);
    } catch (error: any) {
      if (!isWriteModeCommitError(error)) throw error;
      console.warn('🦆 [Worker/Engine] Detected OPFS write-mode commit failure during CSV load; recovering');
      await reopenWritableDatabase();
      try {
        csvResult = await loadCSV(request.fileName, request.content);
      } catch (retryError: any) {
        if (!isWriteModeCommitError(retryError)) throw retryError;
        console.warn('🦆 [Worker/Engine] CSV retry failed; forcing in-memory');
        await reopenInMemoryDatabase();
        csvResult = await loadCSV(request.fileName, request.content);
      }
    }
    postEngineResponse({
      type: 'engine.csvLoaded',
      requestId,
      schema: csvResult.schema,
      rowCount: csvResult.rowCount,
      durationMs: csvResult.durationMs,
    });
  },

  'engine.loadSAV': async (request) => {
    if (request.type !== 'engine.loadSAV') return;
    const { requestId } = request;
    let savResult;
    try {
      savResult = await loadSAV(request.buffer, request.forceChunked, (progress) => {
        postEngineResponse(toEngineLoadProgress(requestId, progress));
      });
    } catch (error: any) {
      if (!isWriteModeCommitError(error)) throw error;
      console.warn('🦆 [Worker/Engine] Detected OPFS write-mode commit failure during SAV load; recovering');
      await reopenWritableDatabase();
      try {
        savResult = await loadSAV(request.buffer.slice(0), request.forceChunked, (progress) => {
          postEngineResponse(toEngineLoadProgress(requestId, progress));
        });
      } catch (retryError: any) {
        if (!isWriteModeCommitError(retryError)) throw retryError;
        console.warn('🦆 [Worker/Engine] Retry failed; forcing in-memory');
        await reopenInMemoryDatabase();
        savResult = await loadSAV(request.buffer.slice(0), request.forceChunked, (progress) => {
          postEngineResponse(toEngineLoadProgress(requestId, progress));
        });
      }
    }
    postEngineResponse({
      type: 'engine.savLoaded',
      requestId,
      variables: savResult.variables,
      variableSets: savResult.variableSets,
      rowCount: savResult.rowCount,
      durationMs: savResult.durationMs,
    });
  },

  'engine.loadSAVMetadata': async (request) => {
    if (request.type !== 'engine.loadSAVMetadata') return;
    const savResult = await loadSAVMetadata(request.buffer);
    postEngineResponse({
      type: 'engine.savMetadataLoaded',
      requestId: request.requestId,
      variables: savResult.variables,
      variableSets: savResult.variableSets,
      rowCount: savResult.rowCount,
      durationMs: savResult.durationMs,
    });
  },

  'engine.loadSAVSample': async (request) => {
    if (request.type !== 'engine.loadSAVSample') return;
    const savResult = await loadSAVSample(request.buffer, request.rowLimit, request.strategy || 'spread');
    postEngineResponse({
      type: 'engine.savSampleLoaded',
      requestId: request.requestId,
      variables: savResult.variables,
      variableSets: savResult.variableSets,
      rowCount: savResult.rowCount,
      sampleRowCount: savResult.sampleRowCount,
      sampleStrategy: savResult.sampleStrategy,
      durationMs: savResult.durationMs,
    });
  },

  'engine.query': async (request) => {
    if (request.type !== 'engine.query') return;
    const queryResult = await runQuery(request.sql);
    postEngineResponse({
      type: 'engine.queryResult',
      requestId: request.requestId,
      data: queryResult.data,
      durationMs: queryResult.durationMs,
    });
  },

  'engine.getSchema': async (request) => {
    if (request.type !== 'engine.getSchema') return;
    const schemaResult = await getSchema();
    postEngineResponse({ type: 'engine.schema', requestId: request.requestId, data: schemaResult });
  },

  'engine.getUniqueValues': async (request) => {
    if (request.type !== 'engine.getUniqueValues') return;
    const uniqueVals = await getUniqueValues(request.column);
    postEngineResponse({ type: 'engine.uniqueValues', requestId: request.requestId, data: uniqueVals });
  },

  'engine.getVariableStats': async (request) => {
    if (request.type !== 'engine.getVariableStats') return;
    const { adapter } = workerDbState;
    if (!adapter) throw new Error('DB not initialized');
    const stats = await coreGetVariableStats(
      adapter,
      request.column,
      request.variableType,
      request.orderedScoring,
      request.binCount,
      request.missingValues,
    );
    postEngineResponse({ type: 'engine.variableStats', requestId: request.requestId, stats });
  },

  'engine.runCrosstab': async (request) => {
    if (request.type !== 'engine.runCrosstab') return;
    const { adapter } = workerDbState;
    if (!adapter) throw new Error('DB not initialized');
    const start = performance.now();
    const crosstabResult = await coreRunCrosstab(
      adapter,
      { ...request.options, significanceOptions: request.analysisSettings },
      request.context,
    );
    postEngineResponse({
      type: 'engine.queryResult',
      requestId: request.requestId,
      data: crosstabResult.rows,
      tableStats: crosstabResult.tableStats,
      durationMs: performance.now() - start,
    });
  },

  'engine.runAnalysis': async (request) => {
    if (request.type !== 'engine.runAnalysis') return;
    const { adapter } = workerDbState;
    if (!adapter) throw new Error('DB not initialized');
    const runner = analysisRegistry.get(request.id);
    if (!runner) throw new Error(`Analysis runner not found: ${request.id}`);
    const start = performance.now();
    const result = await runner.run(adapter, request.config);
    postEngineResponse({
      type: 'engine.analysisResult',
      requestId: request.requestId,
      id: request.id,
      result: result as Record<string, unknown>,
      durationMs: performance.now() - start,
    });
  },

  'engine.processData': async (request) => {
    if (request.type !== 'engine.processData') return;
    const processed = processAnalysisData({
      data: request.data,
      ...request.options,
    });
    if (!processed) {
      postEngineResponse({ type: 'engine.processedData', requestId: request.requestId, result: null });
      return;
    }
    let finalResult = processed;
    if (request.chartType) {
      const transformed = transformChartData(processed, request.chartType);
      if (transformed) finalResult = transformed;
    }
    postEngineResponse({ type: 'engine.processedData', requestId: request.requestId, result: finalResult });
  },

  'engine.recodeVariable': async (request) => {
    if (request.type !== 'engine.recodeVariable') return;
    const newCol = await recodeVariable(request.sourceCol, request.newColName, request.config);
    postEngineResponse({ type: 'engine.recodeComplete', requestId: request.requestId, newColName: newCol });
  },

  'engine.dropColumn': async (request) => {
    if (request.type !== 'engine.dropColumn') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DB not initialized');
    await conn.query(`ALTER TABLE main DROP COLUMN "${request.column}"`);
    postEngineResponse({ type: 'engine.columnDropped', requestId: request.requestId, column: request.column });
  },

  'engine.updateColumn': async (request) => {
    if (request.type !== 'engine.updateColumn') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DB not initialized');
    await conn.query(`UPDATE main SET "${request.targetCol}" = ${buildCaseSql(request.sourceCol, request.config)}`);
    postEngineResponse({ type: 'engine.columnUpdated', requestId: request.requestId, column: request.targetCol });
  },

  'engine.fillSystemMissing': async (request) => {
    if (request.type !== 'engine.fillSystemMissing') return;
    await fillSystemMissing(request.column, request.value);
    postEngineResponse({
      type: 'engine.fillSystemMissingComplete',
      requestId: request.requestId,
      column: request.column,
    });
  },

  ...engineHandlersHarmonization,

  'engine.close': async (request) => {
    if (request.type !== 'engine.close') return;
    const { adapter } = workerDbState;
    if (adapter) await adapter.close();
    postEngineResponse({ type: 'engine.closed', requestId: request.requestId });
  },
};
