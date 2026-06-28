import { describe, expect, it, vi } from 'vitest';
import { BrowserEngine } from './BrowserEngine';
import type { EngineProxy } from '../services/EngineProxy';
import type { Dataset, Filter, VariableSet } from '../types';

const mockEnvelope = {
  operation: 'runCrosstab',
  inputs: {},
  durationMs: 5,
  warnings: [] as string[],
  metadata: {
    datasetName: 'test.sav',
    rowCount: 100,
    filtersApplied: 0,
    isWeighted: false,
    engineVersion: 'browser-wasm',
  },
};

function createMockProxy(overrides: Partial<EngineProxy> = {}): EngineProxy {
  return {
    runCrosstab: vi.fn().mockResolvedValue({
      ...mockEnvelope,
      data: { rows: [], tableStats: null },
    }),
    getVariableStats: vi.fn().mockResolvedValue({
      ...mockEnvelope,
      operation: 'getVariableStats',
      data: { frequencies: [], total: 0 },
    }),
    query: vi.fn().mockResolvedValue({ type: 'engine.queryResult', data: [], durationMs: 1 }),
    loadSAV: vi.fn(),
    loadCSV: vi.fn(),
    setDatasetContext: vi.fn(),
    ping: vi.fn(),
    ...overrides,
  } as unknown as EngineProxy;
}

const dataset: Dataset = {
  id: 'ds-1',
  name: 'test.sav',
  rowCount: 100,
  source: 'sav',
  variables: [
    { id: 'gender', name: 'gender', label: 'Gender', type: 'nominal', valueLabels: [], missingValues: {} },
    { id: 'score', name: 'score', label: 'Score', type: 'numeric', valueLabels: [], missingValues: {} },
  ],
};

const variableSets: VariableSet[] = [
  { id: 'gender', name: 'Gender', variableIds: ['gender'], structure: 'single', type: 'nominal' },
  { id: 'score', name: 'Score', variableIds: ['score'], structure: 'single', type: 'numeric' },
];

describe('BrowserEngine', () => {
  it('delegates transport methods to EngineProxy', async () => {
    const proxy = createMockProxy();
    const engine = new BrowserEngine(proxy);

    await engine.ping();
    expect(proxy.ping).toHaveBeenCalled();
    expect(engine.getProxy()).toBe(proxy);
  });

  it('runAnalysis("crosstab") builds request and delegates to proxy.runCrosstab', async () => {
    const proxy = createMockProxy();
    const engine = new BrowserEngine(proxy);

    const filters: Filter[] = [
      {
        id: 'f1',
        variableId: 'gender',
        operator: 'eq',
        value: 'Female',
      },
    ];

    await engine.runAnalysis(
      'crosstab',
      {
        rowVars: ['gender'],
        colVar: 'score',
        filters,
        weightVar: null,
        analysisSettings: {
          comparisonMethod: 'cell_vs_rest',
          correctionType: 'none',
          significanceLevel: 0.95,
        },
      },
      { dataset, variableSets },
    );

    expect(proxy.runCrosstab).toHaveBeenCalledTimes(1);
    const [options, context, settings] = (proxy.runCrosstab as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(options.filters).toEqual(filters);
    expect(context.variables).toHaveProperty('gender');
    expect(settings).toMatchObject({ comparisonMethod: 'cell_vs_rest' });
  });

  it('runAnalysis("variableStats") delegates to proxy.getVariableStats', async () => {
    const proxy = createMockProxy();
    const engine = new BrowserEngine(proxy);

    await engine.runAnalysis('variableStats', {
      column: 'score',
      variableType: 'numeric',
      binCount: 8,
    });

    expect(proxy.getVariableStats).toHaveBeenCalledWith('score', 'numeric', undefined, 8, undefined);
  });

  it('runAnalysis("variableStats") forwards orderedScoring and missingValues', async () => {
    const proxy = createMockProxy();
    const engine = new BrowserEngine(proxy);
    const missingValues = { discrete: [99] };

    await engine.runAnalysis('variableStats', {
      column: 'likert',
      variableType: 'ordered',
      orderedScoring: 'allow_numeric_stats',
      binCount: 10,
      missingValues,
    });

    expect(proxy.getVariableStats).toHaveBeenCalledWith('likert', 'ordered', 'allow_numeric_stats', 10, missingValues);
  });

  it('throws ANALYSIS_NOT_FOUND for unknown analysis id', async () => {
    const engine = new BrowserEngine(createMockProxy());

    await expect(engine.runAnalysis('unknown', {})).rejects.toMatchObject({
      code: 'ANALYSIS_NOT_FOUND',
    });
  });

  it('requires context for crosstab in browser', async () => {
    const engine = new BrowserEngine(createMockProxy());

    await expect(engine.runAnalysis('crosstab', { rowVars: ['score'] })).rejects.toMatchObject({
      code: 'NO_DATASET_LOADED',
    });
  });

  it('delegates query to proxy', async () => {
    const proxy = createMockProxy();
    const engine = new BrowserEngine(proxy);

    await engine.query('SELECT 1');
    expect(proxy.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('loadBuffer("sav") orchestrates loadSAV and returns envelope + raw payload', async () => {
    const savLoaded = {
      type: 'engine.savLoaded' as const,
      requestId: 'req-1',
      variables: [{ id: 'q1', name: 'q1', label: 'Q1', type: 'nominal' as const, valueLabels: [], missingValues: {} }],
      variableSets: [
        { id: 'vs1', name: 'Q1', variableIds: ['q1'], structure: 'single' as const, type: 'nominal' as const },
      ],
      rowCount: 42,
      durationMs: 10,
    };
    const proxy = createMockProxy({
      loadSAV: vi.fn().mockResolvedValue(savLoaded),
    });
    const engine = new BrowserEngine(proxy);
    const buffer = new ArrayBuffer(8);

    const result = await engine.loadBuffer('survey.sav', buffer, 'sav');

    expect(proxy.loadSAV).toHaveBeenCalledWith(buffer);
    expect(proxy.setDatasetContext).toHaveBeenCalledWith('survey.sav', 42);
    expect(result.loaded).toBe(savLoaded);
    expect(result.envelope.data).toMatchObject({
      datasetName: 'survey.sav',
      rowCount: 42,
      variableCount: 1,
      variableSetCount: 1,
      source: 'sav',
    });
    expect(result.envelope.operation).toBe('loadBuffer');
  });

  it('loadBuffer("csv") orchestrates loadCSV and returns envelope + raw payload', async () => {
    const csvLoaded = {
      type: 'engine.csvLoaded' as const,
      requestId: 'req-2',
      schema: [
        { name: 'age', type: 'INTEGER' },
        { name: 'gender', type: 'VARCHAR' },
      ],
      rowCount: 99,
      durationMs: 5,
    };
    const proxy = createMockProxy({
      loadCSV: vi.fn().mockResolvedValue(csvLoaded),
    });
    const engine = new BrowserEngine(proxy);
    const buffer = new TextEncoder().encode('age,gender\n1,M').buffer;

    const result = await engine.loadBuffer('people.csv', buffer, 'csv');

    expect(proxy.loadCSV).toHaveBeenCalledWith('people.csv', 'age,gender\n1,M');
    expect(proxy.setDatasetContext).toHaveBeenCalledWith('people.csv', 99);
    expect(result.loaded).toBe(csvLoaded);
    expect(result.envelope.data).toMatchObject({
      datasetName: 'people.csv',
      rowCount: 99,
      variableCount: 2,
      variableSetCount: 2,
      source: 'csv',
    });
  });
});
