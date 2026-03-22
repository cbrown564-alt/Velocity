// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { VelocityEngine } from '../VelocityEngine';

describe('VelocityEngine crosstab resolveLabels', () => {
  let engine: VelocityEngine;

  beforeAll(async () => {
    const dataDir = path.resolve(__dirname, '../../../test_data');
    engine = await VelocityEngine.create({ runtime: 'node', dataDir, engineVersion: 'test-resolve-labels' });
    await engine.loadFile('sleep.sav');
  });

  afterAll(async () => {
    await engine.close();
  });

  it('resolves row labels after promoting a sole numeric rowVar into measureVar', async () => {
    const bySex = await engine.runAnalysis('crosstab', {
      rowVars: ['age'],
      colVar: 'sex',
      resolveLabels: true,
    });
    const bySexRows = (bySex.data as { rows: Array<{ rowKey_0: string; colKey: string }> }).rows;

    expect(bySexRows.map((row) => row.rowKey_0)).toEqual(
      expect.arrayContaining(['female', 'male'])
    );
    expect(new Set(bySexRows.map((row) => row.colKey))).toEqual(new Set(['age']));

    const byMarital = await engine.runAnalysis('crosstab', {
      rowVars: ['age'],
      colVar: 'marital',
      resolveLabels: true,
    });
    const byMaritalRows = (byMarital.data as { rows: Array<{ rowKey_0: string; colKey: string }> }).rows;

    expect(byMaritalRows.map((row) => row.rowKey_0)).toEqual(
      expect.arrayContaining(['single', 'married/defacto', 'divorced', 'widowed'])
    );
    expect(new Set(byMaritalRows.map((row) => row.colKey))).toEqual(new Set(['age']));
  }, 30000);
});
