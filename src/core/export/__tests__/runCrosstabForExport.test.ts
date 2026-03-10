import { describe, it, expect, vi } from 'vitest';
import { runCrosstabForExport } from '../runCrosstabForExport';
import type { EngineProxy } from '../../../services/EngineProxy';

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

function createMockEngineProxy(overrides: Partial<EngineProxy> = {}): EngineProxy {
  return {
    runCrosstab: vi.fn().mockResolvedValue({ data: [], tableStats: null }),
    ...overrides,
  } as unknown as EngineProxy;
}

describe('runCrosstabForExport', () => {
  it('returns mapped data on successful response', async () => {
    const engineProxy = createMockEngineProxy({
      runCrosstab: vi.fn().mockResolvedValue({
        data: [{ foo: 'bar' }],
        tableStats: null,
      }),
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
