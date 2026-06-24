import * as arrow from 'apache-arrow';
import type { EngineWorkerRequest } from '../../types/engineWorker';
import { postEngineResponse, postEngineTransfer } from './engineMessaging';
import { workerDbState } from './workerDbState';
import type { EngineMessageHandler } from './engineHandlerTypes';

export const engineHandlersHarmonization: Pick<
  Record<EngineWorkerRequest['type'], EngineMessageHandler>,
  'engine.exportArrow' | 'engine.getValueFrequencies' | 'engine.buildHarmonizedTable' | 'engine.getRespondentOverlap'
> = {
  'engine.exportArrow': async (request) => {
    if (request.type !== 'engine.exportArrow') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DB not initialized');
    const start = performance.now();
    const result = await conn.query(request.sql);
    const ipcBuffer = arrow.tableToIPC(result);
    postEngineTransfer(
      {
        type: 'engine.arrowExported',
        requestId: request.requestId,
        buffer: ipcBuffer.buffer as ArrayBuffer,
        rowCount: result.numRows,
        durationMs: performance.now() - start,
      },
      [ipcBuffer.buffer as Transferable],
    );
  },

  'engine.getValueFrequencies': async (request) => {
    if (request.type !== 'engine.getValueFrequencies') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DuckDB not initialized');
    const { buildValueFrequencyQuery } = await import('../../core/harmonization/harmonizationQueries');
    const sql = buildValueFrequencyQuery(request.tableName, request.columnName);
    const result = await conn.query(sql);
    const rows = result.toArray().map((r: any) => ({
      value: r.col_value,
      count: Number(r.count),
    }));
    postEngineResponse({
      type: 'engine.valueFrequencies',
      requestId: request.requestId,
      column: request.columnName,
      frequencies: rows,
    });
  },

  'engine.buildHarmonizedTable': async (request) => {
    if (request.type !== 'engine.buildHarmonizedTable') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DuckDB not initialized');
    const t0 = performance.now();
    const { buildHarmonizedTableQuery } = await import('../../core/harmonization/harmonizationQueries');
    const sourceVarNames: Record<string, string> = { ...(request.sourceVarNames ?? {}) };
    const targetVarNames: Record<string, string> = { ...(request.targetVarNames ?? {}) };
    for (const m of request.mappings) {
      if (m.sourceVariableId && !sourceVarNames[m.sourceVariableId]) {
        sourceVarNames[m.sourceVariableId] = m.sourceVariableId;
      }
      if (m.targetVariableId && !targetVarNames[m.targetVariableId]) {
        targetVarNames[m.targetVariableId] = m.targetVariableId;
      }
    }
    const sql = buildHarmonizedTableQuery(
      request.sourceTable,
      request.targetTable,
      request.mappings,
      sourceVarNames,
      targetVarNames,
    );
    await conn.query(`CREATE OR REPLACE TABLE "${request.outputTableName}" AS (${sql})`);
    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${request.outputTableName}"`);
    const rowCount = Number(countResult.toArray()[0]?.cnt ?? 0);
    postEngineResponse({
      type: 'engine.harmonizedTableCreated',
      requestId: request.requestId,
      tableName: request.outputTableName,
      rowCount,
      durationMs: performance.now() - t0,
    });
  },

  'engine.getRespondentOverlap': async (request) => {
    if (request.type !== 'engine.getRespondentOverlap') return;
    const { conn } = workerDbState;
    if (!conn) throw new Error('DuckDB not initialized');
    const { buildRespondentOverlapQuery } = await import('../../core/harmonization/harmonizationQueries');
    const sql = buildRespondentOverlapQuery(
      request.sourceTable,
      request.targetTable,
      request.keyColumn,
    );
    const result = await conn.query(sql);
    const row = result.toArray()[0] as any;
    postEngineResponse({
      type: 'engine.respondentOverlap',
      requestId: request.requestId,
      totalSource: Number(row?.total_source ?? 0),
      totalTarget: Number(row?.total_target ?? 0),
      overlap: Number(row?.overlap ?? 0),
    });
  },
};
