import { describe, expect, it, vi } from 'vitest';
import { BrowserEngine, createBrowserEngine } from './BrowserEngine';
import type { EngineProxy } from '../services/EngineProxy';
import type { Dataset, Filter, VariableSet } from '../types';
import type { EngineRecodeConfig } from './types';

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

// ============================================================================
// Pure transport delegation — characterizes the facade's pass-through contract:
// every method forwards its arguments verbatim to the matching EngineProxy method
// and returns the proxy's result unchanged. Void methods only assert delegation.
// ============================================================================

type AnyFn = (...args: unknown[]) => unknown;

/** Build a proxy whose methods each return a per-method sentinel, to prove pass-through. */
function fullMockProxy(): { proxy: EngineProxy; sentinels: Record<string, unknown> } {
  const methods = [
    'init',
    'ping',
    'checkPersistedData',
    'clearPersistedData',
    'flushPersistedData',
    'updatePersistenceMetadata',
    'loadCSV',
    'loadSAV',
    'loadSAVMetadata',
    'loadSAVSample',
    'query',
    'getSchema',
    'getUniqueValues',
    'getVariableStats',
    'runCrosstab',
    'processData',
    'recodeVariable',
    'dropColumn',
    'updateColumn',
    'fillSystemMissing',
    'exportArrow',
    'getValueFrequencies',
    'buildHarmonizedTable',
    'getRespondentOverlap',
    'dispose',
    'terminate',
    'getWorker',
    'setDatasetContext',
  ] as const;

  const sentinels: Record<string, unknown> = {};
  const obj: Record<string, AnyFn> = {};
  for (const name of methods) {
    const sentinel = { __sentinel: name };
    sentinels[name] = sentinel;
    obj[name] = vi.fn().mockReturnValue(sentinel);
  }
  return { proxy: obj as unknown as EngineProxy, sentinels };
}

describe('BrowserEngine transport delegation', () => {
  const buffer = new ArrayBuffer(8);
  const sentinelArg = (label: string) => ({ __arg: label });

  // method, args, whether the facade returns the proxy result (false for void methods)
  const cases: Array<{ method: string; args: unknown[]; passthrough: boolean }> = [
    { method: 'init', args: [{ forceCleanStart: true, datasetId: 'ds', schemaVersion: 3 }], passthrough: true },
    { method: 'ping', args: [], passthrough: true },
    { method: 'checkPersistedData', args: [], passthrough: true },
    { method: 'clearPersistedData', args: [], passthrough: true },
    { method: 'flushPersistedData', args: [], passthrough: true },
    { method: 'updatePersistenceMetadata', args: [sentinelArg('metadata')], passthrough: false },
    { method: 'loadCSV', args: ['f.csv', 'a,b\n1,2'], passthrough: true },
    { method: 'loadSAV', args: [buffer, true], passthrough: true },
    { method: 'loadSAVMetadata', args: [buffer], passthrough: true },
    { method: 'loadSAVSample', args: [buffer, 100, 'spread'], passthrough: true },
    { method: 'query', args: ['SELECT 2'], passthrough: true },
    { method: 'getSchema', args: [], passthrough: true },
    { method: 'getUniqueValues', args: ['gender'], passthrough: true },
    {
      method: 'getVariableStats',
      args: ['score', 'numeric', 'allow_numeric_stats', 5, { discrete: [99] }],
      passthrough: true,
    },
    {
      method: 'runCrosstab',
      args: [sentinelArg('options'), sentinelArg('context'), sentinelArg('settings'), sentinelArg('processOpts')],
      passthrough: true,
    },
    { method: 'processData', args: [[], sentinelArg('options'), 'bar'], passthrough: true },
    { method: 'recodeVariable', args: ['src', 'dst', sentinelArg('config')], passthrough: true },
    { method: 'dropColumn', args: ['col'], passthrough: true },
    { method: 'updateColumn', args: ['src', 'dst', sentinelArg('config')], passthrough: true },
    { method: 'fillSystemMissing', args: ['col', 99], passthrough: true },
    { method: 'exportArrow', args: ['SELECT 1', ['a', 'b']], passthrough: true },
    { method: 'getValueFrequencies', args: ['table', 'col'], passthrough: true },
    {
      method: 'buildHarmonizedTable',
      args: ['srcT', 'tgtT', [], 'outT', { a: 'b' }, { c: 'd' }],
      passthrough: true,
    },
    { method: 'getRespondentOverlap', args: ['srcT', 'tgtT', 'id'], passthrough: true },
    { method: 'dispose', args: [], passthrough: false },
    { method: 'terminate', args: [], passthrough: false },
    { method: 'getWorker', args: [], passthrough: true },
    { method: 'setDatasetContext', args: ['ds', 42], passthrough: false },
  ];

  it.each(cases)('$method forwards args and result to proxy.$method', async ({ method, args, passthrough }) => {
    const { proxy, sentinels } = fullMockProxy();
    const engine = new BrowserEngine(proxy);

    const result = await (engine as unknown as Record<string, AnyFn>)[method]!(...args);

    const proxyFn = (proxy as unknown as Record<string, ReturnType<typeof vi.fn>>)[method]!;
    expect(proxyFn).toHaveBeenCalledTimes(1);
    expect(proxyFn).toHaveBeenCalledWith(...args);
    if (passthrough) {
      expect(result).toBe(sentinels[method]);
    }
  });
});

describe('BrowserEngine.recode', () => {
  it('sanitizes the target name, delegates to recodeVariable, and returns the column envelope', async () => {
    const proxy = createMockProxy({ recodeVariable: vi.fn().mockResolvedValue({ type: 'engine.recodeComplete' }) });
    const engine = new BrowserEngine(proxy);
    const config: EngineRecodeConfig = { mode: 'categorical', targetVariableName: '1 bad name!' };

    const result = await engine.recode('age', config);

    // Leading digit prefixed with "_" and non-identifier chars replaced with "_".
    expect(proxy.recodeVariable).toHaveBeenCalledWith('age', '_1_bad_name_', config);
    expect(result.data).toEqual({ column: '_1_bad_name_' });
    expect(result.operation).toBe('recode');
    expect(result.inputs).toMatchObject({ sourceVar: 'age' });
  });

  it('derives a default target name from the source variable when none is given', async () => {
    const proxy = createMockProxy({ recodeVariable: vi.fn().mockResolvedValue({ type: 'engine.recodeComplete' }) });
    const engine = new BrowserEngine(proxy);

    const result = await engine.recode('income', { mode: 'binning' });

    expect(proxy.recodeVariable).toHaveBeenCalledWith('income', 'income_recode', { mode: 'binning' });
    expect(result.data).toEqual({ column: 'income_recode' });
  });
});

describe('BrowserEngine.runAnalysis variableStats validation', () => {
  it('throws INVALID_VARIABLE when no column is supplied', async () => {
    const engine = new BrowserEngine(createMockProxy());

    await expect(engine.runAnalysis('variableStats', {})).rejects.toMatchObject({
      code: 'INVALID_VARIABLE',
    });
  });

  it('coerces a non-object config to an empty record (no column → INVALID_VARIABLE)', async () => {
    const engine = new BrowserEngine(createMockProxy());

    // Array/null configs are tolerated by toRecord() and treated as "{}".
    await expect(engine.runAnalysis('variableStats', [])).rejects.toMatchObject({
      code: 'INVALID_VARIABLE',
    });
  });
});

describe('createBrowserEngine', () => {
  it('constructs a BrowserEngine wired to the given proxy', async () => {
    const proxy = createMockProxy();
    const engine = createBrowserEngine(proxy);

    expect(engine).toBeInstanceOf(BrowserEngine);
    await engine.ping();
    expect(proxy.ping).toHaveBeenCalled();
  });
});
