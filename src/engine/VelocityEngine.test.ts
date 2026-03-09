import { beforeAll, describe, expect, it } from 'vitest';
import type { AnalysisRunner } from '../core/analysis/AnalysisRunner';
import { analysisRegistry } from '../core/analysis/registry';
import type { DatabaseAdapter, QueryResult } from '../core/DatabaseAdapter';
import type { Filter } from '../types';
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
});
