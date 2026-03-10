/**
 * MCP Tool Handler unit tests
 *
 * Tests that each tool handler:
 *  - Calls the correct engine method with correct arguments
 *  - Returns a properly formatted MCP response
 *  - Returns isError: true with a VelocityError code on failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTools } from '../tools';
import { VelocityError } from '../../src/engine/index';

// ---------------------------------------------------------------------------
// Minimal Server mock
// ---------------------------------------------------------------------------

type Handler = (request: { params: { name: string; arguments: Record<string, unknown> } }) => Promise<unknown>;

function makeServer() {
  const handlers: Record<string, Handler> = {};
  return {
    setRequestHandler: vi.fn((schema: { method?: string }, handler: Handler) => {
      // The schema objects have a .method or we identify them by registration order
      handlers[Object.keys(handlers).length === 0 ? 'list' : 'call'] = handler;
    }),
    handlers,
  };
}

function makeEngine(overrides: Record<string, unknown> = {}) {
  const base = {
    loadFile: vi.fn().mockResolvedValue({ data: { rowCount: 100 }, metadata: {}, operation: 'loadFile', inputs: {}, durationMs: 1, warnings: [] }),
    describe: vi.fn().mockReturnValue({
      dataset: {
        id: 'ds1',
        name: 'test.sav',
        rowCount: 100,
        variables: [
          { id: 'Q1', name: 'Q1', label: 'Q1 label', type: 'ordinal', valueLabels: [], missingValues: {} },
          { id: 'GENDER', name: 'GENDER', label: 'Gender', type: 'nominal', valueLabels: [], missingValues: {} },
        ],
        source: 'sav',
      },
      variableSets: [],
      folders: [],
      activeFilters: [],
      weightVariable: null,
    }),
    describeVariable: vi.fn().mockResolvedValue({ data: {}, operation: 'describeVariable', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    listAnalyses: vi.fn().mockReturnValue([{ id: 'crosstab', label: 'Crosstab', configSchema: {} }]),
    runAnalysis: vi.fn().mockResolvedValue({ data: { rows: [] }, operation: 'runAnalysis', inputs: {}, durationMs: 5, warnings: [], metadata: { rowCount: 100, isWeighted: false } }),
    query: vi.fn().mockResolvedValue({ data: { rows: [] }, operation: 'query', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    recode: vi.fn().mockResolvedValue({ data: {}, operation: 'recode', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    addFilter: vi.fn(),
    clearFilters: vi.fn(),
    setWeight: vi.fn(),
    buildDeck: vi.fn().mockResolvedValue({ data: { slides: [], errors: [], spec: {}, buildDurationMs: 1 }, operation: 'buildDeck', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    exportDeck: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), operation: 'exportDeck', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    recommendChart: vi.fn().mockResolvedValue({ data: { default: 'horizontal-bar', alternatives: [], reason: 'test' }, operation: 'recommendChart', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    proposeMappings: vi.fn().mockResolvedValue({ data: [], operation: 'proposeMappings', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    buildHarmonizedTable: vi.fn().mockResolvedValue({ data: { sql: 'SELECT 1' }, operation: 'buildHarmonizedTable', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    exportSession: vi.fn().mockResolvedValue({ formatVersion: '1.0.0' }),
    importSession: vi.fn().mockResolvedValue({ data: {}, operation: 'importSession', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    getActiveFilters: vi.fn().mockReturnValue([]),
    ...overrides,
  };
  return base;
}

async function callTool(engine: ReturnType<typeof makeEngine>, toolName: string, args: Record<string, unknown> = {}) {
  const server = makeServer();
  registerTools(server as never, engine as never);
  const callHandler = server.handlers['call'];
  return callHandler({ params: { name: toolName, arguments: args } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('velocity_load', () => {
  it('calls engine.loadFile with the provided path', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_load', { path: '/data/survey.sav' });
    expect(engine.loadFile).toHaveBeenCalledWith('/data/survey.sav');
  });

  it('returns content text on success', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_load', { path: '/data/test.sav' }) as { content: { type: string; text: string }[] };
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('rowCount');
  });

  it('returns isError: true when engine throws VelocityError', async () => {
    const engine = makeEngine({
      loadFile: vi.fn().mockRejectedValue(new VelocityError('FILE_LOAD_FAILED', 'Not found')),
    });
    const result = await callTool(engine, 'velocity_load', { path: '/bad.sav' }) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('FILE_LOAD_FAILED');
  });
});

describe('velocity_load — path traversal', () => {
  it('returns isError when engine throws PATH_TRAVERSAL_DENIED', async () => {
    const engine = makeEngine({
      loadFile: vi.fn().mockRejectedValue(
        new VelocityError('PATH_TRAVERSAL_DENIED', 'Path traversal not allowed')
      ),
    });
    const result = await callTool(engine, 'velocity_load', { path: '../../etc/passwd' }) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('PATH_TRAVERSAL_DENIED');
  });
});

describe('velocity_describe', () => {
  it('returns dataset description without calling runAnalysis', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_describe') as { content: { text: string }[] };
    expect(engine.describe).toHaveBeenCalled();
    expect(engine.runAnalysis).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dataset.name).toBe('test.sav');
  });
});

describe('velocity_crosstab', () => {
  it('calls engine.runAnalysis with "crosstab" and passes rowVars', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_crosstab', { rowVars: ['Q1'], colVar: 'GENDER' });
    expect(engine.runAnalysis).toHaveBeenCalledWith('crosstab', expect.objectContaining({
      rowVars: ['Q1'],
      colVar: 'GENDER',
    }));
  });
});

describe('velocity_stats', () => {
  it('calls engine.runAnalysis with "variableStats"', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_stats', { column: 'Q1' });
    expect(engine.runAnalysis).toHaveBeenCalledWith('variableStats', expect.objectContaining({
      column: 'Q1',
    }));
  });
});

describe('velocity_sql', () => {
  it('calls engine.query with the provided SQL', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_sql', { sql: 'SELECT 1' });
    expect(engine.query).toHaveBeenCalledWith('SELECT 1');
  });
});

describe('velocity_filter', () => {
  it('calls engine.addFilter with the filter object', async () => {
    const engine = makeEngine();
    const filter = { id: 'f1', variableId: 'GENDER', operator: 'eq', value: '1' };
    await callTool(engine, 'velocity_filter', { filter });
    expect(engine.addFilter).toHaveBeenCalledWith(filter);
  });
});

describe('velocity_clear_filters', () => {
  it('calls engine.clearFilters', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_clear_filters');
    expect(engine.clearFilters).toHaveBeenCalled();
  });
});

describe('velocity_set_weight', () => {
  it('calls engine.setWeight with the variableId', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_set_weight', { variableId: 'WEIGHT' });
    expect(engine.setWeight).toHaveBeenCalledWith('WEIGHT');
  });

  it('calls engine.setWeight with null to clear weight', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_set_weight', { variableId: null });
    expect(engine.setWeight).toHaveBeenCalledWith(null);
  });
});

describe('velocity_build_deck', () => {
  it('calls engine.buildDeck with the spec', async () => {
    const engine = makeEngine();
    const spec = { title: 'My Deck', sections: [] };
    await callTool(engine, 'velocity_build_deck', { spec });
    expect(engine.buildDeck).toHaveBeenCalledWith(spec);
  });

  it('returns isError when buildDeck throws', async () => {
    const engine = makeEngine({
      buildDeck: vi.fn().mockRejectedValue(new VelocityError('DECK_BUILD_FAILED', 'Failed')),
    });
    const result = await callTool(engine, 'velocity_build_deck', { spec: { title: 'T', sections: [] } }) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});

describe('velocity_export_deck', () => {
  it('returns base64-encoded bytes for pptx export', async () => {
    const engine = makeEngine();
    const deck = { spec: { title: 'T', sections: [] }, slides: [], errors: [], buildDurationMs: 0 };
    const result = await callTool(engine, 'velocity_export_deck', {
      deck,
      options: { format: 'pptx' },
    }) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.format).toBe('pptx');
    expect(typeof parsed.data.base64).toBe('string');
    expect(parsed.data.byteLength).toBe(3);
  });
});

describe('velocity_recommend_chart', () => {
  it('calls engine.recommendChart with var IDs and returns recommendation', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_recommend_chart', { rowVarIds: ['Q1'] }) as { content: { text: string }[] };
    expect(engine.recommendChart).toHaveBeenCalledWith(['Q1'], null);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data).toHaveProperty('default');
  });
});

describe('velocity_propose_mappings', () => {
  it('calls engine.proposeMappings with the raw variable ID strings', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_propose_mappings', {
      wave1VarIds: ['Q1'],
      wave2VarIds: ['GENDER'],
    });
    // Engine now owns the ID→Variable lookup; MCP layer passes IDs only.
    expect(engine.proposeMappings).toHaveBeenCalledWith(['Q1'], ['GENDER']);
  });
});

describe('velocity_export_session', () => {
  it('calls engine.exportSession and returns the session', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_export_session') as { content: { text: string }[] };
    expect(engine.exportSession).toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('formatVersion');
  });
});

describe('unknown tool', () => {
  it('returns isError for unrecognized tool names', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_nonexistent') as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});
