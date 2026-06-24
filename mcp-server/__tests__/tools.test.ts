/**
 * MCP Tool Handler unit tests
 *
 * Tests that each tool handler:
 *  - Calls the correct engine method with correct arguments
 *  - Returns a properly formatted MCP response
 *  - Returns isError: true with a VelocityError code on failure
 */

import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerTools } from '../tools';
import { VelocityError } from '../../src/engine/index';
import { formatCrosstabMatrix } from '../../src/core/analysis/formatCrosstabMatrix';

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
    loadFileMetadata: vi.fn().mockResolvedValue({ data: { rowCount: 100, metadataOnly: true }, metadata: {}, operation: 'loadFileMetadata', inputs: {}, durationMs: 1, warnings: [] }),
    loadFileFull: vi.fn().mockResolvedValue({ data: { rowCount: 100, metadataOnly: false }, metadata: {}, operation: 'loadFileFull', inputs: {}, durationMs: 1, warnings: [] }),
    loadWorkspaceDataset: vi.fn().mockResolvedValue({ data: { id: 'ws-1', tableName: 'ws_ws_1' }, metadata: {}, operation: 'loadWorkspaceDataset', inputs: {}, durationMs: 1, warnings: [] }),
    listWorkspaceDatasets: vi.fn().mockReturnValue({ data: [], operation: 'listWorkspaceDatasets', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    setActiveWorkspaceDataset: vi.fn().mockReturnValue({ data: { id: 'ws-1', isActive: true }, operation: 'setActiveWorkspaceDataset', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    loadWorkspaceDatasetFull: vi.fn().mockResolvedValue({ data: { id: 'ws-1', metadataOnly: false }, metadata: {}, operation: 'loadWorkspaceDatasetFull', inputs: {}, durationMs: 1, warnings: [] }),
    proposeWorkspaceMappings: vi.fn().mockResolvedValue({ data: [], operation: 'proposeWorkspaceMappings', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    harmonizeWorkspaceDatasets: vi.fn().mockResolvedValue({
      data: { tableName: 'harm_out', rowCount: 10, sql: 'SELECT 1' },
      operation: 'harmonizeWorkspaceDatasets',
      inputs: {},
      durationMs: 1,
      warnings: [],
      metadata: {},
    }),
    describe: vi.fn().mockReturnValue({
      data: {
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
      },
      operation: 'describe',
      inputs: {},
      durationMs: 1,
      warnings: [],
      metadata: {},
    }),
    describeVariable: vi.fn().mockResolvedValue({ data: {}, operation: 'describeVariable', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    listAnalyses: vi.fn().mockReturnValue({ data: [{ id: 'crosstab', label: 'Crosstab', configSchema: {} }], operation: 'listAnalyses', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    runAnalysis: vi.fn().mockResolvedValue({ data: { rows: [] }, operation: 'runAnalysis', inputs: {}, durationMs: 5, warnings: [], metadata: { rowCount: 100, isWeighted: false } }),
    query: vi.fn().mockResolvedValue({ data: { rows: [] }, operation: 'query', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    recode: vi.fn().mockResolvedValue({ data: {}, operation: 'recode', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    addFilter: vi.fn().mockReturnValue({
      data: { filter: { id: 'f1', variableId: 'GENDER', operator: 'eq', value: '1' } },
      operation: 'addFilter',
      inputs: { filterId: 'f1', variableId: 'GENDER' },
      durationMs: 1,
      warnings: [],
      metadata: { datasetName: 'test.sav', rowCount: 100, filtersApplied: 1, isWeighted: false, engineVersion: 'test' },
    }),
    clearFilters: vi.fn().mockReturnValue({
      data: { clearedCount: 2 },
      operation: 'clearFilters',
      inputs: {},
      durationMs: 1,
      warnings: [],
      metadata: { datasetName: 'test.sav', rowCount: 100, filtersApplied: 0, isWeighted: false, engineVersion: 'test' },
    }),
    setWeight: vi.fn().mockReturnValue({
      data: { variableId: 'WEIGHT' },
      operation: 'setWeight',
      inputs: { variableId: 'WEIGHT' },
      durationMs: 1,
      warnings: [],
      metadata: { datasetName: 'test.sav', rowCount: 100, filtersApplied: 0, isWeighted: true, engineVersion: 'test' },
    }),
    buildDeck: vi.fn().mockResolvedValue({ data: { slides: [], errors: [], spec: {}, buildDurationMs: 1 }, operation: 'buildDeck', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    exportDeck: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), operation: 'exportDeck', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    commitDeck: vi.fn().mockReturnValue({
      data: { committedSlides: 1, committedSections: 1 },
      operation: 'commitDeck',
      inputs: { slideCount: 1, sectionCount: 1 },
      durationMs: 1,
      warnings: [],
      metadata: { datasetName: 'test.sav', rowCount: 100, filtersApplied: 0, isWeighted: false, engineVersion: 'test' },
    }),
    recommendChart: vi.fn().mockResolvedValue({ data: { default: 'horizontal-bar', alternatives: [], reason: 'test' }, operation: 'recommendChart', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    proposeMappings: vi.fn().mockResolvedValue({ data: [], operation: 'proposeMappings', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    buildHarmonizedTable: vi.fn().mockResolvedValue({ data: { sql: 'SELECT 1' }, operation: 'buildHarmonizedTable', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    exportSession: vi.fn().mockResolvedValue({ data: { formatVersion: 2, dataset: { originalFilename: 'test.sav' } }, operation: 'exportSession', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    importSession: vi.fn().mockResolvedValue({ data: {}, operation: 'importSession', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    getActiveFilters: vi.fn().mockReturnValue({ data: [], operation: 'getActiveFilters', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    listConcepts: vi.fn().mockReturnValue({ data: [], operation: 'listConcepts', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    createConcept: vi.fn().mockReturnValue({ data: { id: 'concept-1', name: 'Test', aliases: [], variableRefs: [] }, operation: 'createConcept', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    listVariablesByCategory: vi.fn().mockReturnValue({ data: [], operation: 'listVariablesByCategory', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
    suggestBreaks: vi.fn().mockReturnValue({ data: [], operation: 'suggestBreaks', inputs: {}, durationMs: 1, warnings: [], metadata: {} }),
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

function expectEnvelopeShape(parsed: Record<string, unknown>, operation: string) {
  expect(parsed).toMatchObject({
    operation,
    inputs: expect.any(Object),
    durationMs: expect.any(Number),
    warnings: expect.any(Array),
    metadata: expect.objectContaining({
      datasetName: expect.any(String),
      rowCount: expect.any(Number),
      filtersApplied: expect.any(Number),
      isWeighted: expect.any(Boolean),
      engineVersion: expect.any(String),
    }),
  });
  expect(parsed).toHaveProperty('data');
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

describe('velocity_load_metadata', () => {
  it('calls engine.loadFileMetadata with the provided path', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_load_metadata', { path: '/data/large.sav' });
    expect(engine.loadFileMetadata).toHaveBeenCalledWith('/data/large.sav');
  });
});

describe('velocity_load_full', () => {
  it('calls engine.loadFileFull with the provided path', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_load_full', { path: '/data/large.sav' });
    expect(engine.loadFileFull).toHaveBeenCalledWith('/data/large.sav');
  });
});

describe('velocity_workspace_load', () => {
  it('calls engine.loadWorkspaceDataset with path and options', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_workspace_load', {
      path: '/data/wave4.sav',
      metadataOnly: true,
      waveNumber: 4,
      makeActive: true,
    });
    expect(engine.loadWorkspaceDataset).toHaveBeenCalledWith('/data/wave4.sav', {
      metadataOnly: true,
      waveNumber: 4,
      makeActive: true,
    });
  });
});

describe('velocity_workspace_harmonize', () => {
  it('calls engine.harmonizeWorkspaceDatasets with dataset ids and mappings', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_workspace_harmonize', {
      sourceDatasetId: 'ws-a',
      targetDatasetId: 'ws-b',
      mappings: [{ id: 'm1', sourceVariableId: 'Q1', targetVariableId: 'Q1', confirmed: true }],
      outputTableName: 'harm_eval',
    });
    expect(engine.harmonizeWorkspaceDatasets).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDatasetId: 'ws-a',
        targetDatasetId: 'ws-b',
        outputTableName: 'harm_eval',
      })
    );
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
    expect(parsed.operation).toBe('describe');
    expect(parsed.data.dataset.name).toBe('test.sav');
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

  it('passes format to engine.runAnalysis when provided', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_crosstab', {
      rowVars: ['GENDER'],
      colVar: 'BRAND',
      format: 'matrix',
    });
    expect(engine.runAnalysis).toHaveBeenCalledWith('crosstab', expect.objectContaining({
      format: 'matrix',
    }));
  });

  it('returns matrix-shaped data when format is matrix', async () => {
    const longRows = [
      { rowKey_0: 'Male', colKey: 'Brand A', count: 10 },
      { rowKey_0: 'Male', colKey: 'Brand B', count: 30 },
      { rowKey_0: 'Female', colKey: 'Brand A', count: 40 },
      { rowKey_0: 'Female', colKey: 'Brand B', count: 20 },
    ];
    const matrix = formatCrosstabMatrix(longRows, { isWeighted: false });
    const engine = makeEngine({
      runAnalysis: vi.fn().mockResolvedValue({
        data: {
          format: 'matrix',
          columns: matrix.columns,
          rows: matrix.rows,
          grandTotal: matrix.grandTotal,
          tableStats: { chiSquare: { statistic: 5.4, df: 1, pValue: 0.02 } },
        },
        operation: 'runAnalysis:crosstab',
        inputs: {},
        durationMs: 5,
        warnings: [],
        metadata: { isWeighted: false },
      }),
    });

    const result = await callTool(engine, 'velocity_crosstab', {
      rowVars: ['GENDER'],
      colVar: 'BRAND',
      format: 'matrix',
    }) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.format).toBe('matrix');
    expect(parsed.data.columns).toEqual([
      { key: 'Brand A', label: 'Brand A', base: 50 },
      { key: 'Brand B', label: 'Brand B', base: 50 },
    ]);
    expect(parsed.data.rows).toHaveLength(2);
    expect(parsed.data.rows[0].cells['Brand A'].percent).toBe(20);
    expect(parsed.data.tableStats.chiSquare.pValue).toBe(0.02);
  });

  it('returns guardrail warnings from the engine envelope', async () => {
    const engine = makeEngine({
      runAnalysis: vi.fn().mockResolvedValue({
        data: { rows: [] },
        operation: 'runAnalysis:crosstab',
        inputs: {},
        durationMs: 5,
        warnings: [
          'High cardinality (25 categories): "Region" as a row variable may produce sparse or unreadable cross-tabs. Look for a condensed version with fewer categories.',
        ],
        metadata: { isWeighted: false },
      }),
    });

    const result = await callTool(engine, 'velocity_crosstab', {
      rowVars: ['REGION'],
    }) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toContain('High cardinality');
  });

  it('uses weighted counts for matrix output when weightVar is passed per call', async () => {
    const longRows = [
      { rowKey_0: 'Male', colKey: 'Brand A', count: 10, weightedCount: 100 },
      { rowKey_0: 'Female', colKey: 'Brand A', count: 40, weightedCount: 100 },
    ];
    const matrix = formatCrosstabMatrix(longRows, { isWeighted: true });
    const engine = makeEngine({
      runAnalysis: vi.fn().mockResolvedValue({
        data: {
          format: 'matrix',
          columns: matrix.columns,
          rows: matrix.rows,
          grandTotal: matrix.grandTotal,
        },
        operation: 'runAnalysis:crosstab',
        inputs: {},
        durationMs: 5,
        warnings: [],
        metadata: { isWeighted: true },
      }),
    });

    const result = await callTool(engine, 'velocity_crosstab', {
      rowVars: ['GENDER'],
      colVar: 'BRAND',
      weightVar: 'WEIGHT',
      format: 'matrix',
    }) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.metadata.isWeighted).toBe(true);
    expect(parsed.data.columns).toEqual([{ key: 'Brand A', label: 'Brand A', base: 200 }]);
    expect(parsed.data.rows[0].cells['Brand A']).toEqual({ count: 100, percent: 50 });
    expect(parsed.data.rows[1].cells['Brand A']).toEqual({ count: 100, percent: 50 });
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

  it('returns a ResultEnvelope with the staged filter', async () => {
    const engine = makeEngine();
    const filter = { id: 'f1', variableId: 'GENDER', operator: 'eq', value: '1' };
    const result = await callTool(engine, 'velocity_filter', { filter }) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expectEnvelopeShape(parsed, 'addFilter');
    expect(parsed.data).toEqual({ filter: { id: 'f1', variableId: 'GENDER', operator: 'eq', value: '1' } });
  });
});

describe('velocity_clear_filters', () => {
  it('calls engine.clearFilters', async () => {
    const engine = makeEngine();
    await callTool(engine, 'velocity_clear_filters');
    expect(engine.clearFilters).toHaveBeenCalled();
  });

  it('returns a ResultEnvelope with the cleared count', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_clear_filters') as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expectEnvelopeShape(parsed, 'clearFilters');
    expect(parsed.data).toEqual({ clearedCount: 2 });
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

  it('returns a ResultEnvelope with the active weight variable', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_set_weight', { variableId: 'WEIGHT' }) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expectEnvelopeShape(parsed, 'setWeight');
    expect(parsed.data).toEqual({ variableId: 'WEIGHT' });
    expect(parsed.metadata).toMatchObject({ isWeighted: true });
  });
});

describe('velocity_build_deck', () => {
  it('calls engine.buildDeck with the spec', async () => {
    const engine = makeEngine();
    const spec = { title: 'My Deck', sections: [] };
    await callTool(engine, 'velocity_build_deck', { spec });
    expect(engine.buildDeck).toHaveBeenCalledWith(spec);
  });

  it('returns a single content part for small decks', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_build_deck', {
      spec: { title: 'T', sections: [] },
    }) as { content: { text: string }[] };
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.transport).toBeUndefined();
  });

  it('returns chunked content parts when the deck has many slides', async () => {
    const slides = Array.from({ length: 9 }, (_, index) => ({
      spec: { rowVars: [`Q${index}`] },
      sectionTitle: 'Results',
      result: {
        data: { rows: [{ row: 'a', col: 'b', count: 1 }] },
        operation: 'runAnalysis:crosstab',
        inputs: {},
        durationMs: 1,
        warnings: [],
        metadata: {},
      },
      processed: { rows: [] },
      resolvedTitle: `Slide ${index}`,
      resolvedSubtitle: 'N = 100',
    }));
    const engine = makeEngine({
      buildDeck: vi.fn().mockResolvedValue({
        data: {
          spec: { title: 'Large', sections: [] },
          slides,
          errors: [],
          buildDurationMs: 100,
        },
        operation: 'buildDeck',
        inputs: {},
        durationMs: 100,
        warnings: [],
        metadata: {},
      }),
    });

    const result = await callTool(engine, 'velocity_build_deck', {
      spec: { title: 'Large', sections: [] },
    }) as { content: { text: string }[] };

    expect(result.content.length).toBeGreaterThan(1);
    const manifest = JSON.parse(result.content[0].text);
    expect(manifest.transport).toBe('chunked');
    expect(manifest.data.slideCount).toBe(9);
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

describe('velocity_commit_deck', () => {
  it('calls engine.commitDeck and returns a commit envelope', async () => {
    const engine = makeEngine();
    const deck = {
      spec: { title: 'T', sections: [{ title: 'Results', slides: [] }] },
      slides: [{ resolvedTitle: 'Slide 1' }],
      errors: [],
      buildDurationMs: 0,
    };

    const result = await callTool(engine, 'velocity_commit_deck', { deck }) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(engine.commitDeck).toHaveBeenCalledWith(deck);
    expectEnvelopeShape(parsed, 'commitDeck');
    expect(parsed.data).toEqual({
      committedSlides: 1,
      committedSections: 1,
    });
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
    expect(parsed.operation).toBe('exportSession');
    expect(parsed.data).toHaveProperty('formatVersion');
  });

  it('writes the session file when outputPath is provided', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'velocity-tools-test-'));
    const outputPath = join(tempDir, 'session-output');
    const engine = makeEngine();

    const result = await callTool(engine, 'velocity_export_session', { outputPath }) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0].text);
    const savedPath = `${outputPath}.velocity`;
    const written = JSON.parse(await readFile(savedPath, 'utf8'));

    expect(parsed.outputPath).toBe(savedPath);
    expect(written.formatVersion).toBe(2);
  });
});

describe('velocity_list_variables_by_category', () => {
  it('calls engine.listVariablesByCategory with category and includeUnannotated', async () => {
    const engine = makeEngine({
      listVariablesByCategory: vi.fn().mockReturnValue({
        data: [{ variable: { id: 'age' }, datasetId: 'ds1', relevance: 0.9, matchedOn: ['category'] }],
        operation: 'listVariablesByCategory', inputs: {}, durationMs: 1, warnings: [], metadata: {},
      }),
    });
    const result = await callTool(engine, 'velocity_list_variables_by_category', { category: 'demographic' }) as { content: { text: string }[] };
    expect(engine.listVariablesByCategory).toHaveBeenCalledWith('demographic', { includeUnannotated: true, limit: undefined });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data[0].variable.id).toBe('age');
  });

  it('passes limit when provided', async () => {
    const engine = makeEngine({
      listVariablesByCategory: vi.fn().mockReturnValue({
        data: [], operation: 'listVariablesByCategory', inputs: {}, durationMs: 1, warnings: [], metadata: {},
      }),
    });
    await callTool(engine, 'velocity_list_variables_by_category', { category: 'attitude', limit: 10 });
    expect(engine.listVariablesByCategory).toHaveBeenCalledWith('attitude', { includeUnannotated: true, limit: 10 });
  });
});

describe('velocity_suggest_breaks', () => {
  it('calls engine.suggestBreaks with variableId', async () => {
    const engine = makeEngine({
      suggestBreaks: vi.fn().mockReturnValue({
        data: [{ variable: { id: 'gender' }, score: 0.85, rationale: 'demographic variable' }],
        operation: 'suggestBreaks', inputs: {}, durationMs: 1, warnings: [], metadata: {},
      }),
    });
    const result = await callTool(engine, 'velocity_suggest_breaks', { variableId: 'q5_sat' }) as { content: { text: string }[] };
    expect(engine.suggestBreaks).toHaveBeenCalledWith('q5_sat', { limit: undefined });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data[0].variable.id).toBe('gender');
  });

  it('passes limit when provided', async () => {
    const engine = makeEngine({
      suggestBreaks: vi.fn().mockReturnValue({
        data: [], operation: 'suggestBreaks', inputs: {}, durationMs: 1, warnings: [], metadata: {},
      }),
    });
    await callTool(engine, 'velocity_suggest_breaks', { variableId: 'q1', limit: 3 });
    expect(engine.suggestBreaks).toHaveBeenCalledWith('q1', { limit: 3 });
  });

  it('returns isError when engine throws', async () => {
    const engine = makeEngine({
      suggestBreaks: vi.fn().mockImplementation(() => {
        throw new VelocityError('INVALID_VARIABLE', 'Unknown variable: bad_id');
      }),
    });
    const result = await callTool(engine, 'velocity_suggest_breaks', { variableId: 'bad_id' }) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_VARIABLE');
  });

  it('returns topic guidance warnings in the envelope', async () => {
    const engine = makeEngine({
      suggestBreaks: vi.fn().mockReturnValue({
        data: [],
        operation: 'suggestBreaks',
        inputs: {},
        durationMs: 1,
        warnings: [
          '"weight" has a weight-like name but appears to be a respondent measurement (e.g. body weight), not a sampling weight.',
        ],
        metadata: {},
      }),
    });
    const result = await callTool(engine, 'velocity_suggest_breaks', { variableId: 'weight' }) as {
      content: { text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.warnings[0]).toContain('body weight');
  });
});

describe('unknown tool', () => {
  it('returns isError for unrecognized tool names', async () => {
    const engine = makeEngine();
    const result = await callTool(engine, 'velocity_nonexistent') as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});
