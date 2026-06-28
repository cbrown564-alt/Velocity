import { describe, expect, it, vi } from 'vitest';

const { mockLoadSAV, mockPostEngineResponse } = vi.hoisted(() => ({
  mockLoadSAV: vi.fn(),
  mockPostEngineResponse: vi.fn(),
}));

vi.mock('../../core/analysis/analysisProcessor', () => ({
  processAnalysisData: vi.fn(),
}));

vi.mock('../../core/analysis/crosstabRunner', () => ({
  runCrosstab: vi.fn(),
}));

vi.mock('../../core/analysis/registry', () => ({
  analysisRegistry: { get: vi.fn() },
}));

vi.mock('../../core/analysis/variableStatsRunner', () => ({
  getVariableStats: vi.fn(),
}));

vi.mock('../../core/transforms/recodeSql', () => ({
  buildCaseSql: vi.fn(),
}));

vi.mock('../chartDataTransformer', () => ({
  transformChartData: vi.fn(),
}));

vi.mock('./duckdbOpfs', () => ({
  buildOpfsDbPath: vi.fn(),
}));

vi.mock('./duckdbPersistence', () => ({
  checkPersistedData: vi.fn(),
  clearPersistedData: vi.fn(),
  flushPersistedData: vi.fn(),
  getPersistenceStatus: vi.fn(),
  init: vi.fn(),
  isWriteModeCommitError: vi.fn().mockReturnValue(false),
  reopenInMemoryDatabase: vi.fn(),
  reopenWritableDatabase: vi.fn(),
  updateMeta: vi.fn(),
}));

vi.mock('./engineHandlersHarmonization', () => ({
  engineHandlersHarmonization: {},
}));

vi.mock('./engineMessaging', () => ({
  postEngineResponse: mockPostEngineResponse,
}));

vi.mock('./workerIngestion', () => ({
  loadCSV: vi.fn(),
  loadSAV: mockLoadSAV,
  loadSAVMetadata: vi.fn(),
  loadSAVSample: vi.fn(),
}));

vi.mock('./workerQueries', () => ({
  fillSystemMissing: vi.fn(),
  getSchema: vi.fn(),
  getUniqueValues: vi.fn(),
  recodeVariable: vi.fn(),
  runQuery: vi.fn(),
}));

vi.mock('./workerDbState', () => ({
  OPFS_SCHEMA_VERSION: 1,
  workerDbState: { adapter: null, conn: null, db: null },
}));

import { engineHandlers } from './engineHandlers';
import { processAnalysisData } from '../../core/analysis/analysisProcessor';
import { runCrosstab } from '../../core/analysis/crosstabRunner';
import { workerDbState } from './workerDbState';

const mockProcessAnalysisData = vi.mocked(processAnalysisData);
const mockRunCrosstab = vi.mocked(runCrosstab);

describe('engineHandlers load progress forwarding', () => {
  it('forwards loadSAV progress as engine.loadProgress events', async () => {
    mockLoadSAV.mockImplementation(async (_buffer, _forceChunked, onProgress) => {
      onProgress?.({
        phase: 'inserting',
        progress: 0.58,
        rowsProcessed: 580,
        totalRows: 1000,
        message: 'Loaded 580 of 1,000 rows...',
      });
      return {
        variables: [],
        variableSets: [],
        rowCount: 1000,
        durationMs: 125,
      };
    });

    await engineHandlers['engine.loadSAV']({
      type: 'engine.loadSAV',
      requestId: 'req-upload',
      buffer: new ArrayBuffer(8),
    });

    expect(mockPostEngineResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'engine.loadProgress',
        requestId: 'req-upload',
        phase: 'inserting',
        progress: 0.58,
        rowsProcessed: 580,
        totalRows: 1000,
      }),
    );
    expect(mockPostEngineResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'engine.savLoaded',
        requestId: 'req-upload',
        rowCount: 1000,
      }),
    );
  });
});

describe('engineHandlers crosstab processing', () => {
  it('returns processed data with crosstab results when requested', async () => {
    workerDbState.adapter = {} as never;
    mockRunCrosstab.mockResolvedValue({
      rows: [{ rowKey_0: '1', colKey: 'Total', count: 10 }],
      tableStats: null,
    });
    mockProcessAnalysisData.mockReturnValue({
      rows: [],
      series: [],
      columns: [],
      grandTotal: 10,
      isMetric: false,
      isGrid: false,
      rowVariables: [],
      colVariable: null,
      isMultipleResponse: false,
    });

    await engineHandlers['engine.runCrosstab']({
      type: 'engine.runCrosstab',
      requestId: 'req-crosstab',
      options: { rowVars: ['gender'], colVar: null },
      context: { variables: {}, variableSets: {} },
      includeProcessedData: {
        rowVariables: [],
        colVariable: null,
        isWeighted: false,
        isMultipleResponse: false,
      },
    });

    expect(mockProcessAnalysisData).toHaveBeenCalledWith({
      data: [{ rowKeys: ['1'], colKey: 'Total', count: 10 }],
      rowVariables: [],
      colVariable: null,
      isWeighted: false,
      isMultipleResponse: false,
    });
    expect(mockPostEngineResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'engine.queryResult',
        requestId: 'req-crosstab',
        processedData: expect.objectContaining({ grandTotal: 10 }),
        timings: expect.objectContaining({
          queryMs: expect.any(Number),
          processMs: expect.any(Number),
          totalMs: expect.any(Number),
        }),
      }),
    );
  });
});
