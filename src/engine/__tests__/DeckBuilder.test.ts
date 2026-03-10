/**
 * DeckBuilder unit tests
 *
 * Uses a mock VelocityEngine that returns canned crosstab data.
 * Tests deck composition, per-slide isolation, fail-soft error handling,
 * title/subtitle resolution, and export format routing.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeckBuilder } from '../DeckBuilder';
import type { DatasetDescription, DeckSpec, ResultEnvelope } from '../types';
import { VelocityError } from '../types';
import type { Filter, Variable } from '../../types';

// ---------------------------------------------------------------------------
// Mock engine
// ---------------------------------------------------------------------------

const MOCK_VARIABLE_Q1: Variable = {
  id: 'Q1',
  name: 'Q1',
  label: 'Overall Satisfaction',
  type: 'ordinal',
  valueLabels: [
    { value: 1, label: 'Dissatisfied' },
    { value: 2, label: 'Neutral' },
    { value: 3, label: 'Satisfied' },
  ],
  missingValues: {},
};

const MOCK_VARIABLE_GENDER: Variable = {
  id: 'GENDER',
  name: 'GENDER',
  label: 'Gender',
  type: 'nominal',
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
  missingValues: {},
};

const MOCK_DESCRIPTION: DatasetDescription = {
  dataset: {
    id: 'ds-1',
    name: 'test.sav',
    rowCount: 500,
    variables: [MOCK_VARIABLE_Q1, MOCK_VARIABLE_GENDER],
    source: 'sav',
  },
  variableSets: [],
  folders: [],
  activeFilters: [],
  weightVariable: null,
};

// Raw DuckDB crosstab format: rowKey_0, rowKey_1, ... colKey, count, weightedCount.
// DeckBuilder calls mapCrosstabRows() to convert this to AggregatedRow format.
const DEFAULT_ROWS = [
  { rowKey_0: '1', colKey: 'Total', count: 100, weightedCount: 100 },
  { rowKey_0: '2', colKey: 'Total', count: 200, weightedCount: 200 },
  { rowKey_0: '3', colKey: 'Total', count: 200, weightedCount: 200 },
];

function makeCrosstabEnvelope(rows: unknown[] = DEFAULT_ROWS): ResultEnvelope<unknown> {
  return {
    data: { rows },
    operation: 'runAnalysis:crosstab',
    inputs: {},
    durationMs: 5,
    warnings: [],
    metadata: {
      datasetName: 'test.sav',
      rowCount: 500,
      filtersApplied: 0,
      isWeighted: false,
      engineVersion: 'test',
    },
  };
}

function makeMockEngine(overrides: Partial<{
  runAnalysis: ReturnType<typeof vi.fn>;
  describe: ReturnType<typeof vi.fn>;
  getActiveFilters: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    runAnalysis: overrides.runAnalysis ?? vi.fn().mockResolvedValue(makeCrosstabEnvelope()),
    describe: overrides.describe ?? vi.fn().mockReturnValue(MOCK_DESCRIPTION),
    getActiveFilters: overrides.getActiveFilters ?? vi.fn().mockReturnValue([]),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckBuilder.build()', () => {
  it('builds a 1-section, 1-slide deck and returns BuiltDeck structure', async () => {
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);
    const spec: DeckSpec = {
      title: 'Test Deck',
      sections: [
        {
          title: 'Section A',
          slides: [{ rowVars: ['Q1'] }],
        },
      ],
    };

    const envelope = await builder.build(spec);

    expect(envelope.operation).toBe('buildDeck');
    expect(envelope.data.spec).toBe(spec);
    expect(envelope.data.slides).toHaveLength(1);
    expect(envelope.data.errors).toHaveLength(0);
    expect(envelope.data.buildDurationMs).toBeGreaterThanOrEqual(0);
    expect(envelope.data.slides[0].sectionTitle).toBe('Section A');
    expect(envelope.data.slides[0].resolvedTitle).toBe('Overall Satisfaction');
  });

  it('builds a multi-section deck with correct slide count and section titles', async () => {
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);
    const spec: DeckSpec = {
      title: 'Multi-Section Deck',
      sections: [
        { title: 'Demographics', slides: [{ rowVars: ['GENDER'] }, { rowVars: ['Q1'] }] },
        { title: 'Satisfaction', slides: [{ rowVars: ['Q1'], colVar: 'GENDER' }] },
      ],
    };

    const envelope = await builder.build(spec);

    expect(envelope.data.slides).toHaveLength(3);
    expect(envelope.data.slides[0].sectionTitle).toBe('Demographics');
    expect(envelope.data.slides[1].sectionTitle).toBe('Demographics');
    expect(envelope.data.slides[2].sectionTitle).toBe('Satisfaction');
    expect(envelope.data.errors).toHaveLength(0);
  });

  it('records error for slide with invalid variable and continues building other slides', async () => {
    // DeckBuilder validates rowVars before calling runAnalysis, so no rejected mock needed.
    // BADVAR is not in MOCK_DESCRIPTION.dataset.variables → validation error caught.
    // Q1 is valid → runAnalysis called once and succeeds.
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);
    const spec: DeckSpec = {
      title: 'Error Test',
      sections: [
        {
          title: 'Section',
          slides: [
            { rowVars: ['BADVAR'] },   // will fail
            { rowVars: ['Q1'] },        // should still succeed
          ],
        },
      ],
    };

    const envelope = await builder.build(spec);

    expect(envelope.data.errors).toHaveLength(1);
    expect(envelope.data.errors[0].slideIndex).toBe(0);
    expect(envelope.data.errors[0].error.code).toBe('INVALID_VARIABLE');
    expect(envelope.data.slides).toHaveLength(1);
    expect(envelope.data.slides[0].spec.rowVars).toEqual(['Q1']);
  });

  it('uses slide-level filters when provided (does not mix with global filters)', async () => {
    const globalFilter: Filter = {
      id: 'f1',
      variableId: 'GENDER',
      operator: 'eq',
      value: '1',
    };
    const slideFilter: Filter = {
      id: 'f2',
      variableId: 'GENDER',
      operator: 'eq',
      value: '2',
    };
    const runAnalysis = vi.fn().mockResolvedValue(makeCrosstabEnvelope());
    const engine = makeMockEngine({
      runAnalysis,
      getActiveFilters: vi.fn().mockReturnValue([globalFilter]),
    });
    const builder = new DeckBuilder(engine);

    await builder.build({
      title: 'Filter Test',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'], filters: [slideFilter] }] }],
    });

    const callArgs = runAnalysis.mock.calls[0][1] as { filters: Filter[] };
    // Should use slide's filter, not the global one
    expect(callArgs.filters).toEqual([slideFilter]);
    expect(callArgs.filters).not.toContainEqual(globalFilter);
  });

  it('falls back to global filters when slide has no explicit filters', async () => {
    const globalFilter: Filter = { id: 'g1', variableId: 'GENDER', operator: 'eq', value: '1' };
    const runAnalysis = vi.fn().mockResolvedValue(makeCrosstabEnvelope());
    const engine = makeMockEngine({
      runAnalysis,
      getActiveFilters: vi.fn().mockReturnValue([globalFilter]),
    });
    const builder = new DeckBuilder(engine);

    await builder.build({
      title: 'Global Filter Test',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'] }] }],
    });

    const callArgs = runAnalysis.mock.calls[0][1] as { filters: Filter[] };
    expect(callArgs.filters).toEqual([globalFilter]);
  });

  it('uses slide-level weight when provided', async () => {
    const runAnalysis = vi.fn().mockResolvedValue(makeCrosstabEnvelope());
    const engine = makeMockEngine({ runAnalysis });
    const builder = new DeckBuilder(engine);

    await builder.build({
      title: 'Weight Test',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'], weightVar: 'WEIGHT' }] }],
    });

    const callArgs = runAnalysis.mock.calls[0][1] as { weightVar: string };
    expect(callArgs.weightVar).toBe('WEIGHT');
  });

  it('resolves explicit title when provided in spec', async () => {
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);

    const envelope = await builder.build({
      title: 'T',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'], title: 'My Custom Title' }] }],
    });

    expect(envelope.data.slides[0].resolvedTitle).toBe('My Custom Title');
  });

  it('auto-generates title from variable labels when no title specified', async () => {
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);

    const envelope = await builder.build({
      title: 'T',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'], colVar: 'GENDER' }] }],
    });

    // resolveSlideTitle returns "Overall Satisfaction by Gender"
    expect(envelope.data.slides[0].resolvedTitle).toContain('Overall Satisfaction');
    expect(envelope.data.slides[0].resolvedTitle).toContain('Gender');
  });

  it('throws DECK_BUILD_FAILED wrapping non-VelocityError exceptions', async () => {
    const runAnalysis = vi.fn().mockRejectedValue(new Error('DuckDB crashed'));
    const engine = makeMockEngine({ runAnalysis });
    const builder = new DeckBuilder(engine);

    const envelope = await builder.build({
      title: 'T',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'] }] }],
    });

    expect(envelope.data.errors).toHaveLength(1);
    expect(envelope.data.errors[0].error.code).toBe('DECK_BUILD_FAILED');
  });

  it('throws NO_DATASET_LOADED when no dataset is in engine', async () => {
    const engine = {
      runAnalysis: vi.fn(),
      describe: vi.fn().mockReturnValue({ ...MOCK_DESCRIPTION, dataset: null }),
      getActiveFilters: vi.fn().mockReturnValue([]),
    };
    const builder = new DeckBuilder(engine);

    await expect(
      builder.build({ title: 'T', sections: [{ title: 'S', slides: [] }] })
    ).rejects.toMatchObject({ code: 'NO_DATASET_LOADED' });
  });
});

describe('DeckBuilder.export()', () => {
  it('routes pptx format to exportPptx pipeline', async () => {
    // exportPptx uses pptxgenjs which requires a DOM-ish environment.
    // We test only the routing logic (not the actual bytes) by mocking exportPptx.
    const { exportPptx } = await import('../../core/export');
    const spy = vi.spyOn({ exportPptx }, 'exportPptx').mockResolvedValue(new Uint8Array([1, 2, 3]));

    // Build a minimal deck with processed data so we can test export routing
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);
    const envelope = await builder.build({
      title: 'Export Test',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'] }] }],
    });

    // export() should not throw even if pptxgenjs isn't fully available in test env
    await expect(
      builder.export(envelope.data, { format: 'pptx' })
    ).resolves.toBeInstanceOf(Uint8Array);

    spy.mockRestore();
  });

  it('throws UNSUPPORTED_FORMAT for unknown formats', async () => {
    const engine = makeMockEngine();
    const builder = new DeckBuilder(engine);
    const envelope = await builder.build({
      title: 'T',
      sections: [{ title: 'S', slides: [{ rowVars: ['Q1'] }] }],
    });

    await expect(
      builder.export(envelope.data, { format: 'docx' as 'pptx' })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
  });
});
