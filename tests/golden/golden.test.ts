/**
 * Golden Tests
 *
 * Snapshot regression tests that verify statistical correctness
 * by comparing CLI output against expected JSON snapshots.
 * Uses DuckDBNodeAdapter directly (no CLI subprocess).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DuckDBNodeAdapter } from '../../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../../src/core/analysis/crosstabRunner';
import { getVariableStats } from '../../src/core/analysis/variableStatsRunner';

const FIXTURES = resolve(__dirname, 'fixtures');
const EXPECTED = resolve(__dirname, 'expected');

function loadExpected(name: string): any {
  return JSON.parse(readFileSync(resolve(EXPECTED, name), 'utf-8'));
}

/** Sort array of row objects by all string keys for stable comparison */
function sortRows(rows: any[]): any[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Compare with numeric tolerance for floating point values */
function expectCloseDeep(actual: any, expected: any, tolerance = 1e-6): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(actual).toBeCloseTo(expected, -Math.log10(tolerance));
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expectCloseDeep(actual[i], expected[i], tolerance);
    }
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    expect(typeof actual).toBe('object');
    for (const key of Object.keys(expected)) {
      expectCloseDeep(actual[key], expected[key], tolerance);
    }
    return;
  }
  expect(actual).toEqual(expected);
}

describe('Golden Tests', () => {
  let db: DuckDBNodeAdapter;

  beforeAll(async () => {
    db = await DuckDBNodeAdapter.create();
    await db.loadCSV(resolve(FIXTURES, 'simple_crosstab.csv'));
  });

  afterAll(async () => {
    await db.close();
  });

  it('gender counts', async () => {
    const results = await runCrosstab(db, {
      rowVars: ['gender'],
      colVar: null,
      weightVar: null,
      filters: [],
    }, { variables: {}, variableSets: {} });

    const expected = loadExpected('gender_counts.json');
    expectCloseDeep(sortRows(results), sortRows(expected));
  });

  it('region by gender crosstab', async () => {
    const results = await runCrosstab(db, {
      rowVars: ['region'],
      colVar: 'gender',
      weightVar: null,
      filters: [],
    }, { variables: {}, variableSets: {} });

    const expected = loadExpected('region_by_gender.json');
    expectCloseDeep(sortRows(results), sortRows(expected));
  });

  it('weighted gender counts', async () => {
    const results = await runCrosstab(db, {
      rowVars: ['gender'],
      colVar: null,
      weightVar: 'weight',
      filters: [],
    }, { variables: {}, variableSets: {} });

    const expected = loadExpected('gender_weighted.json');
    expectCloseDeep(sortRows(results), sortRows(expected));
  });

  it('age variable stats', async () => {
    const results = await getVariableStats(db, 'age', 'numeric', 10);
    const expected = loadExpected('age_stats.json');
    expectCloseDeep(results, expected);
  });
});
