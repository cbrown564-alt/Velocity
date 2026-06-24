import { describe, it, expect, vi } from 'vitest';
import { runCrosstabForExport } from '../runCrosstabForExport';
import type { CrosstabEnginePort } from '../crosstabEnginePort';

vi.mock('../../analysis/buildCrosstabRequest', () => ({
  buildCrosstabRequest: () => ({
    isWeighted: false,
    options: {},
    context: {},
  }),
}));

vi.mock('../../analysis/mapCrosstabRows', () => ({
  mapCrosstabRows: (rows: any[]) => rows,
}));

function makeEnvelope(data: unknown) {
  return {
    data,
    operation: 'runCrosstab',
    inputs: {},
    durationMs: 10,
    warnings: [],
    metadata: { datasetName: 'test', rowCount: 0, filtersApplied: 0, isWeighted: false, engineVersion: 'browser-wasm' },
  };
}

function createMockEngineProxy(overrides: Partial<CrosstabEnginePort> = {}): CrosstabEnginePort {
  return {
    runCrosstab: vi.fn().mockResolvedValue(makeEnvelope({ rows: [], tableStats: null })),
    ...overrides,
  } as unknown as EngineProxy;
}

describe('runCrosstabForExport', () => {
  it('returns mapped data on successful response', async () => {
    const engineProxy = createMockEngineProxy({
      runCrosstab: vi.fn().mockResolvedValue(makeEnvelope({ rows: [{ foo: 'bar' }], tableStats: null })),
    });

    const result = await runCrosstabForExport({
      engineProxy,
      dataset: { id: 'x', name: 'x', rowCount: 0, variables: [] } as any,
      variableSets: [],
      rowVars: ['gender'],
      colVar: null,
      filters: [],
      weightVar: null,
    });

    expect(result.data).toEqual([{ foo: 'bar' }]);
  });

  it('returns empty data on error', async () => {
    const engineProxy = createMockEngineProxy({
      runCrosstab: vi.fn().mockRejectedValue(new Error('timeout')),
    });

    const result = await runCrosstabForExport({
      engineProxy,
      dataset: { id: 'x', name: 'x', rowCount: 0, variables: [] } as any,
      variableSets: [],
      rowVars: ['gender'],
      colVar: null,
      filters: [],
      weightVar: null,
    });

    expect(result.data).toEqual([]);
  });
});
