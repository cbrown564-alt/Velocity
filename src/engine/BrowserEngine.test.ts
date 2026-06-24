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

    const filters: Filter[] = [{
      id: 'f1',
      variableId: 'gender',
      operator: 'eq',
      value: 'Female',
    }];

    await engine.runAnalysis('crosstab', {
      rowVars: ['gender'],
      colVar: 'score',
      filters,
      weightVar: null,
      analysisSettings: {
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        significanceLevel: 0.95,
      },
    }, { dataset, variableSets });

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
});
