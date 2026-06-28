import { beforeAll, describe, expect, it } from 'vitest';
import type { AnalysisRunner } from '../core/analysis/AnalysisRunner';
import { analysisRegistry } from '../core/analysis/registry';
import type { DatabaseAdapter, QueryResult } from '../core/DatabaseAdapter';
import type { Filter, Variable, VariableSet } from '../types';
import { VelocityEngine, VelocityError } from './VelocityEngine';

class MockAdapter implements DatabaseAdapter {
  public closed = false;
  public loadCsvCalls: string[] = [];

  async query(sql: string): Promise<QueryResult> {
    if (sql === `PRAGMA table_info('main')`) {
      return {
        columns: ['name', 'type'],
        rows: [
          { name: 'gender', type: 'VARCHAR' },
          { name: 'score', type: 'DOUBLE' },
        ],
        rowCount: 2,
      };
    }

    if (sql === 'SELECT 1 as one') {
      return {
        columns: ['one'],
        rows: [{ one: 1 }],
        rowCount: 1,
      };
    }

    if (sql.includes('SELECT COUNT(*) as cnt FROM main WHERE')) {
      return {
        columns: ['cnt'],
        rows: [{ cnt: 0 }],
        rowCount: 1,
      };
    }

    if (sql.includes('SELECT COUNT(*) as cnt FROM main')) {
      return {
        columns: ['cnt'],
        rows: [{ cnt: 4 }],
        rowCount: 1,
      };
    }

    if (sql.includes('GROUP BY "gender"')) {
      return {
        columns: ['value', 'cnt'],
        rows: [
          { value: 'Female', cnt: 2 },
          { value: 'Male', cnt: 2 },
        ],
        rowCount: 2,
      };
    }

    throw new Error(`Unhandled SQL in test adapter: ${sql}`);
  }

  async execute(): Promise<void> {}

  async insertArrowBuffer(): Promise<void> {}

  async getTableNames(): Promise<string[]> {
    return ['main'];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async loadCSV(filePath: string): Promise<number> {
    this.loadCsvCalls.push(filePath);
    return 4;
  }

  async loadSav(filePath: string): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number }> {
    if (filePath.includes('sleep')) {
      return {
        rowCount: 500,
        variables: [
          {
            id: 'weight',
            name: 'weight',
            label: 'weight',
            type: 'numeric',
            valueLabels: [],
            missingValues: { discrete: [] },
          },
          {
            id: 'gender',
            name: 'gender',
            label: 'Gender',
            type: 'nominal',
            valueLabels: [
              { value: 1, label: 'Male' },
              { value: 2, label: 'Female' },
            ],
            missingValues: {},
          },
        ],
        variableSets: [
          { id: 'weight', name: 'weight', variableIds: ['weight'], structure: 'single', type: 'numeric' },
          { id: 'gender', name: 'Gender', variableIds: ['gender'], structure: 'single', type: 'nominal' },
        ],
      };
    }

    return {
      rowCount: 1200,
      variables: [
        {
          id: 'Q1',
          name: 'Q1',
          label: 'Overall Satisfaction',
          type: 'ordinal',
          valueLabels: [
            { value: 1, label: 'Very Dissatisfied' },
            { value: 2, label: 'Dissatisfied' },
            { value: 3, label: 'Neutral' },
            { value: 4, label: 'Satisfied' },
            { value: 5, label: 'Very Satisfied' },
          ],
          missingValues: { discrete: [99] },
        },
        {
          id: 'GENDER',
          name: 'GENDER',
          label: 'Respondent Gender',
          type: 'nominal',
          valueLabels: [
            { value: 1, label: 'Male' },
            { value: 2, label: 'Female' },
          ],
          missingValues: {},
        },
        {
          id: 'WEIGHT',
          name: 'WEIGHT',
          label: 'Population Weight',
          type: 'scale',
          valueLabels: [],
          missingValues: {},
        },
      ],
      variableSets: [
        { id: 'Q1', name: 'Overall Satisfaction', variableIds: ['Q1'], structure: 'single', type: 'ordinal' },
        { id: 'GENDER', name: 'Respondent Gender', variableIds: ['GENDER'], structure: 'single', type: 'nominal' },
        { id: 'WEIGHT', name: 'Population Weight', variableIds: ['WEIGHT'], structure: 'single', type: 'scale' },
      ],
    };
  }
}

const TEST_RUNNER_ID = 'engine-test-echo';

class EchoRunner implements AnalysisRunner<Record<string, unknown>, Record<string, unknown>> {
  readonly id = TEST_RUNNER_ID;
  readonly label = 'Echo Runner';
  readonly configSchema = {
    type: 'object',
    properties: {
      hello: { type: 'string' },
    },
  };

  async run(_adapter: DatabaseAdapter, config: Record<string, unknown>) {
    return { received: config };
  }
}

beforeAll(() => {
  analysisRegistry.register(new EchoRunner());
});

describe('VelocityEngine', () => {
  it('loads CSV metadata and exposes dataset description', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });

    const envelope = await engine.loadFile('/tmp/demo.csv');
    const description = engine.describe();

    expect(adapter.loadCsvCalls).toEqual(['/tmp/demo.csv']);
    expect(envelope.data).toMatchObject({
      datasetName: 'demo.csv',
      rowCount: 4,
      variableCount: 2,
      variableSetCount: 2,
      source: 'csv',
    });
    expect(envelope.metadata).toMatchObject({
      datasetName: 'demo.csv',
      rowCount: 4,
      filtersApplied: 0,
      isWeighted: false,
    });
    expect(description.operation).toBe('describe');
    expect(description.data.dataset?.name).toBe('demo.csv');
    expect(description.data.dataset?.variables.map((variable) => variable.id)).toEqual(['gender', 'score']);
    expect(description.data.variableSets.map((variableSet) => variableSet.id)).toEqual(['gender', 'score']);
  });

  it('wraps describeVariable, query, and registered analysis results in provenance envelopes', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });
    await engine.loadFile('/tmp/demo.csv');

    const filter: Filter = {
      id: 'filter-1',
      variableId: 'gender',
      operator: 'eq',
      value: 'Female',
    };

    engine.addFilter(filter);
    engine.setWeight('score');

    const variableEnvelope = await engine.describeVariable('gender');
    const queryEnvelope = await engine.query('SELECT 1 as one');
    const analysisEnvelope = await engine.runAnalysis(TEST_RUNNER_ID, { hello: 'world' });

    expect(variableEnvelope.data.variable.id).toBe('gender');
    expect(variableEnvelope.data.stats.frequencies).toEqual([
      { value: 'Female', count: 2 },
      { value: 'Male', count: 2 },
    ]);

    expect(queryEnvelope.data.rows).toEqual([{ one: 1 }]);
    expect(queryEnvelope.metadata).toMatchObject({
      datasetName: 'demo.csv',
      rowCount: 4,
      filtersApplied: 1,
      isWeighted: true,
    });

    expect(analysisEnvelope.data).toEqual({ received: { hello: 'world' } });
    expect(engine.listAnalyses().data).toContainEqual({
      id: TEST_RUNNER_ID,
      label: 'Echo Runner',
      configSchema: {
        type: 'object',
        properties: {
          hello: { type: 'string' },
        },
      },
    });
  });

  it('throws a structured error when queried before a dataset is loaded', async () => {
    const engine = await VelocityEngine.create({ runtime: 'node', adapter: new MockAdapter() });

    await expect(engine.query('SELECT 1 as one')).rejects.toMatchObject({
      code: 'NO_DATASET_LOADED',
    });
  });

  it('preserves SAV metadata: value labels, missing values, human-readable label, and type', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });

    const envelope = await engine.loadFile('/data/brand_tracker.sav');
    expect(envelope.data).toMatchObject({
      datasetName: 'brand_tracker.sav',
      rowCount: 1200,
      variableCount: 3,
      source: 'sav',
    });

    const description = engine.describe();
    const variables = description.data.dataset?.variables ?? [];

    // Variable labels (human-readable question text) must be preserved
    expect(variables.find((v) => v.id === 'Q1')?.label).toBe('Overall Satisfaction');
    expect(variables.find((v) => v.id === 'GENDER')?.label).toBe('Respondent Gender');

    // Value labels (the integer→string mapping) must survive the load
    const q1 = variables.find((v) => v.id === 'Q1');
    expect(q1?.valueLabels).toHaveLength(5);
    expect(q1?.valueLabels[0]).toEqual({ value: 1, label: 'Very Dissatisfied' });
    expect(q1?.valueLabels[4]).toEqual({ value: 5, label: 'Very Satisfied' });

    // Missing value definitions must survive
    expect(q1?.missingValues).toEqual({ discrete: [99] });

    // Types must not be re-inferred from SQL schema — they come from the SAV metadata
    expect(variables.find((v) => v.id === 'Q1')?.type).toBe('ordinal');
    expect(variables.find((v) => v.id === 'GENDER')?.type).toBe('nominal');
    expect(variables.find((v) => v.id === 'WEIGHT')?.type).toBe('scale');

    // VariableSets must reflect SAV structure
    expect(description.data.variableSets).toHaveLength(3);
    expect(description.data.variableSets.find((vs) => vs.id === 'Q1')?.name).toBe('Overall Satisfaction');
  });

  it('unwraps a ResultEnvelope returned by a registry runner rather than double-wrapping', async () => {
    const WRAPPING_RUNNER_ID = 'engine-test-wrapping';

    class WrappingRunner implements AnalysisRunner<Record<string, unknown>, Record<string, unknown>> {
      readonly id = WRAPPING_RUNNER_ID;
      readonly label = 'Wrapping Runner';
      readonly configSchema = {};

      async run() {
        // Simulates a runner that mistakenly returns a ResultEnvelope
        return {
          data: { innerResult: true },
          operation: 'inner',
          inputs: {},
          durationMs: 1,
          warnings: [],
          metadata: { datasetName: 'x', rowCount: 0, filtersApplied: 0, isWeighted: false, engineVersion: 'test' },
        };
      }
    }

    analysisRegistry.register(new WrappingRunner());

    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });
    await engine.loadFile('/data/brand_tracker.sav');

    const envelope = await engine.runAnalysis(WRAPPING_RUNNER_ID, {});

    // The outer envelope's data should be the inner result, not the inner envelope itself
    expect(envelope.data).toEqual({ innerResult: true });
    expect((envelope.data as Record<string, unknown>).operation).toBeUndefined();
  });

  it('surfaces body-weight and cardinality guardrails on suggestBreaks', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });
    await engine.loadFile('/data/sleep.sav');
    await engine.annotateDataset();

    const breaks = engine.suggestBreaks('weight');
    expect(breaks.warnings.some((warning) => warning.includes('body weight'))).toBe(true);
  });

  it('supports metadata-first load then full load for analysis', async () => {
    const { DuckDBNodeAdapter } = await import('../adapters/DuckDBNodeAdapter');
    const adapter = await DuckDBNodeAdapter.create();
    const engine = await VelocityEngine.create({
      runtime: 'node',
      adapter,
      dataDir: process.cwd(),
    });

    const savPath = 'test_data/sleep.sav';
    const metadata = await engine.loadFileMetadata(savPath);
    expect(metadata.data.metadataOnly).toBe(true);
    expect(metadata.data.variableCount).toBeGreaterThan(0);

    const described = engine.describe();
    const firstVarId = described.data.dataset?.variables[0]?.id;
    expect(firstVarId).toBeTruthy();

    await expect(engine.runAnalysis('crosstab', { rowVars: [firstVarId!] })).rejects.toMatchObject({
      code: 'METADATA_ONLY',
    });

    const full = await engine.loadFileFull(savPath);
    expect(full.data.metadataOnly).toBe(false);

    const crosstab = await engine.runAnalysis('crosstab', { rowVars: [firstVarId!] });
    expect(crosstab.operation).toContain('crosstab');
  }, 120_000);

  it('registers workspace datasets and proposes cross-wave mappings', async () => {
    const { DuckDBNodeAdapter } = await import('../adapters/DuckDBNodeAdapter');
    const adapter = await DuckDBNodeAdapter.create();
    const engine = await VelocityEngine.create({
      runtime: 'node',
      adapter,
      dataDir: process.cwd(),
    });

    const wave4 = await engine.loadWorkspaceDataset('test_data/sleep.sav', { waveNumber: 4 });
    const wave5 = await engine.loadWorkspaceDataset('test_data/sleep.sav', { waveNumber: 5 });
    expect(wave4.data.id).not.toBe(wave5.data.id);

    const listed = engine.listWorkspaceDatasets();
    expect(listed.data).toHaveLength(2);

    const mappings = await engine.proposeWorkspaceMappings(wave4.data.id, wave5.data.id);
    expect(mappings.data.length).toBeGreaterThan(0);
  }, 120_000);

  it('wraps session getters and exportSession in provenance envelopes', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter, engineVersion: 'test-engine' });
    await engine.loadFile('/data/brand_tracker.sav');

    engine.addFilter({
      id: 'filter-q1',
      variableId: 'Q1',
      operator: 'eq',
      value: 1,
    });
    engine.setWeight('WEIGHT');

    const session = engine.getSession();
    const exported = await engine.exportSession();
    const activeFilters = engine.getActiveFilters();

    expect(session.operation).toBe('getSession');
    expect(session.data.formatVersion).toBe(2);
    expect(session.metadata).toMatchObject({
      datasetName: 'brand_tracker.sav',
      rowCount: 1200,
      filtersApplied: 1,
      isWeighted: true,
      engineVersion: 'test-engine',
    });

    expect(exported.operation).toBe('exportSession');
    expect(exported.data.dataset.originalFilename).toBe('brand_tracker.sav');
    expect(activeFilters.data).toEqual([
      {
        id: 'filter-q1',
        variableId: 'Q1',
        operator: 'eq',
        value: 1,
      },
    ]);
  });

  it('wraps session mutation methods in provenance envelopes', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter, engineVersion: 'test-engine' });
    await engine.loadFile('/data/brand_tracker.sav');

    const filter = {
      id: 'filter-q1',
      variableId: 'Q1',
      operator: 'eq' as const,
      value: 1,
    };

    const addFilterEnvelope = engine.addFilter(filter);
    const setWeightEnvelope = engine.setWeight('WEIGHT');
    const clearFiltersEnvelope = engine.clearFilters();
    const removeFilterEnvelope = engine.removeFilter('missing-filter');

    expect(addFilterEnvelope.operation).toBe('addFilter');
    expect(addFilterEnvelope.data.filter).toEqual(filter);
    expect(addFilterEnvelope.metadata.filtersApplied).toBe(1);

    expect(setWeightEnvelope.operation).toBe('setWeight');
    expect(setWeightEnvelope.data.variableId).toBe('WEIGHT');
    expect(setWeightEnvelope.metadata.isWeighted).toBe(true);

    expect(clearFiltersEnvelope.operation).toBe('clearFilters');
    expect(clearFiltersEnvelope.data.clearedCount).toBe(1);
    expect(clearFiltersEnvelope.metadata.filtersApplied).toBe(0);

    expect(removeFilterEnvelope.operation).toBe('removeFilter');
    expect(removeFilterEnvelope.data).toEqual({ filterId: 'missing-filter', removed: false });

    const commitEnvelope = engine.commitDeck({
      spec: {
        title: 'Commit Test',
        sections: [{ title: 'Results', slides: [] }],
      },
      slides: [
        {
          spec: { rowVars: ['Q1'] },
          sectionTitle: 'Results',
          result: {
            data: { rows: [] },
            operation: 'runAnalysis:crosstab',
            inputs: { rowVars: ['Q1'] },
            durationMs: 1,
            warnings: [],
            metadata: {
              datasetName: 'brand_tracker.sav',
              rowCount: 1200,
              filtersApplied: 0,
              isWeighted: false,
              engineVersion: 'test-engine',
            },
          },
          processed: {
            rows: [],
            series: [],
            columns: [],
            grandTotal: 0,
            isMetric: false,
            isGrid: false,
            rowVariables: [],
            colVariable: null,
            isMultipleResponse: false,
          },
          resolvedTitle: 'Slide 1',
          resolvedSubtitle: 'N = 1200',
        },
      ],
      errors: [],
      buildDurationMs: 1,
    });

    expect(commitEnvelope.operation).toBe('commitDeck');
    expect(commitEnvelope.data.committedSlides).toBe(1);
    expect(commitEnvelope.data.committedSections).toBe(1);
    expect(commitEnvelope.metadata.engineVersion).toBe('test-engine');
  });

  it('drafts approval-required deck actions without mutating slide state', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter, engineVersion: 'test-engine' });
    await engine.loadFile('/data/brand_tracker.sav');

    const spec = {
      title: 'Pilot Draft',
      sections: [
        {
          title: 'Results',
          slides: [
            {
              rowVars: ['Q1'],
              colVar: 'GENDER',
              title: 'Satisfaction by Gender',
              notes: 'Check significance before sending.',
              visualizationType: 'table' as const,
            },
          ],
        },
      ],
    };

    const envelope = engine.draftDeckPlan(spec);

    expect(envelope.operation).toBe('draftDeckPlan');
    expect(envelope.data.approvalRequired).toBe(true);
    expect(envelope.data.actions).toEqual([
      expect.objectContaining({
        type: 'create_section',
        label: 'Create section "Results"',
        requiresApproval: true,
      }),
      expect.objectContaining({
        type: 'create_slide',
        label: 'Add slide "Satisfaction by Gender"',
        requiresApproval: true,
        slideSpec: expect.objectContaining({
          rowVars: ['Q1'],
          colVar: 'GENDER',
          notes: 'Check significance before sending.',
        }),
        caveats: expect.arrayContaining(['Review generated notes before commit/export.']),
      }),
    ]);
    expect(envelope.data.deckSpec).toEqual(spec);
    expect(envelope.metadata.engineVersion).toBe('test-engine');
    expect(engine.state.slides).toEqual([]);
  });

  it('drafts caveats for every unknown slide variable reference without mutating state', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter, engineVersion: 'test-engine' });
    await engine.loadFile('/data/brand_tracker.sav');

    const spec = {
      title: 'Draft With Gaps',
      sections: [
        {
          title: 'Risks',
          slides: [
            {
              rowVars: ['MISSING_ROW'],
              colVar: 'MISSING_COL',
              filters: [{ id: 'f1', variableId: 'MISSING_FILTER', operator: 'eq' as const, value: 1 }],
              weightVar: 'MISSING_WEIGHT',
              title: 'Incomplete slide',
            },
          ],
        },
      ],
    };

    const envelope = engine.draftDeckPlan(spec);
    const slideAction = envelope.data.actions.find((action) => action.type === 'create_slide');

    expect(envelope.operation).toBe('draftDeckPlan');
    expect(envelope.warnings).toEqual(
      expect.arrayContaining([
        'Slide "Incomplete slide" references unknown row variable "MISSING_ROW".',
        'Slide "Incomplete slide" references unknown column variable "MISSING_COL".',
        'Slide "Incomplete slide" references unknown filter variable "MISSING_FILTER".',
        'Slide "Incomplete slide" references unknown weight variable "MISSING_WEIGHT".',
      ]),
    );
    expect(slideAction?.caveats).toEqual(
      expect.arrayContaining([
        'Variable "MISSING_ROW" is not in the active dataset.',
        'Column variable "MISSING_COL" is not in the active dataset.',
        'Filter variable "MISSING_FILTER" is not in the active dataset.',
        'Weight variable "MISSING_WEIGHT" is not in the active dataset.',
      ]),
    );
    expect(engine.state.slides).toEqual([]);
  });

  it('rejects invalid deck draft specs with a structured VelocityError', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter, engineVersion: 'test-engine' });
    await engine.loadFile('/data/brand_tracker.sav');

    expect(() => engine.draftDeckPlan({ title: 'Broken' } as never)).toThrow(VelocityError);
    expect(() => engine.draftDeckPlan({ title: 'Broken' } as never)).toThrow(
      'Deck spec must include a sections array.',
    );
  });
});
