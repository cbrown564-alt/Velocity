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
          missingValues: { type: 'discrete', values: [99] },
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
    expect(description.dataset?.name).toBe('demo.csv');
    expect(description.dataset?.variables.map((variable) => variable.id)).toEqual(['gender', 'score']);
    expect(description.variableSets.map((variableSet) => variableSet.id)).toEqual(['gender', 'score']);
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
    expect(engine.listAnalyses()).toContainEqual({
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

    await expect(engine.query('SELECT 1 as one')).rejects.toMatchObject<Partial<VelocityError>>({
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
    const variables = description.dataset?.variables ?? [];

    // Variable labels (human-readable question text) must be preserved
    expect(variables.find(v => v.id === 'Q1')?.label).toBe('Overall Satisfaction');
    expect(variables.find(v => v.id === 'GENDER')?.label).toBe('Respondent Gender');

    // Value labels (the integer→string mapping) must survive the load
    const q1 = variables.find(v => v.id === 'Q1');
    expect(q1?.valueLabels).toHaveLength(5);
    expect(q1?.valueLabels[0]).toEqual({ value: 1, label: 'Very Dissatisfied' });
    expect(q1?.valueLabels[4]).toEqual({ value: 5, label: 'Very Satisfied' });

    // Missing value definitions must survive
    expect(q1?.missingValues).toEqual({ type: 'discrete', values: [99] });

    // Types must not be re-inferred from SQL schema — they come from the SAV metadata
    expect(variables.find(v => v.id === 'Q1')?.type).toBe('ordinal');
    expect(variables.find(v => v.id === 'GENDER')?.type).toBe('nominal');
    expect(variables.find(v => v.id === 'WEIGHT')?.type).toBe('scale');

    // VariableSets must reflect SAV structure
    expect(description.variableSets).toHaveLength(3);
    expect(description.variableSets.find(vs => vs.id === 'Q1')?.name).toBe('Overall Satisfaction');
  });

  it('unwraps a ResultEnvelope returned by a registry runner rather than double-wrapping', async () => {
    const WRAPPING_RUNNER_ID = 'engine-test-wrapping';

    class WrappingRunner implements AnalysisRunner<Record<string, unknown>, Record<string, unknown>> {
      readonly id = WRAPPING_RUNNER_ID;
      readonly label = 'Wrapping Runner';
      readonly configSchema = {};

      async run(_adapter: DatabaseAdapter) {
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
});
