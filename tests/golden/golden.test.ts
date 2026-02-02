/**
 * Golden Tests
 *
 * Snapshot regression tests that verify statistical correctness
 * by comparing CLI output against expected JSON snapshots.
 * Uses DuckDBNodeAdapter directly (no CLI subprocess).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, readdirSync, appendFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { DuckDBNodeAdapter } from '../../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../../src/core/analysis/crosstabRunner';
import { getVariableStats } from '../../src/core/analysis/variableStatsRunner';

const FIXTURES = resolve(__dirname, 'fixtures');
const EXPECTED = resolve(__dirname, 'expected');
const PERF_LOG = resolve(__dirname, 'perf_log.jsonl');

function loadExpected(name: string): any {
  const path = resolve(EXPECTED, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Sort array of row objects by all string keys for stable comparison */
function sortRows(rows: any[]): any[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Compare with numeric tolerance and bootstrap if missing */
function expectCloseDeepWithBootstrap(actual: any, expectedName: string, toleranceLength = 1e-6): void {
  const expected = loadExpected(expectedName);
  if (!expected) {
    console.warn(`WARNING: Expected file ${expectedName} not found. Writing current results as golden.`);
    writeFileSync(resolve(EXPECTED, expectedName), JSON.stringify(actual, null, 2));
    return;
  }
  expectCloseDeep(actual, expected, toleranceLength);
}

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

describe('Golden Tests (Legacy)', () => {
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

    expectCloseDeepWithBootstrap(sortRows(results), 'gender_counts.json');
  });

  it('region by gender crosstab', async () => {
    const results = await runCrosstab(db, {
      rowVars: ['region'],
      colVar: 'gender',
      weightVar: null,
      filters: [],
    }, { variables: {}, variableSets: {} });

    expectCloseDeepWithBootstrap(sortRows(results), 'region_by_gender.json');
  });

  it('weighted gender counts', async () => {
    const results = await runCrosstab(db, {
      rowVars: ['gender'],
      colVar: null,
      weightVar: 'weight',
      filters: [],
    }, { variables: {}, variableSets: {} });

    expectCloseDeepWithBootstrap(sortRows(results), 'gender_weighted.json');
  });

  it('age variable stats', async () => {
    const results = await getVariableStats(db, 'age', 'numeric', 10);
    expectCloseDeepWithBootstrap(results, 'age_stats.json');
  });
});

describe('Dynamic Golden Tests', () => {
  const configs = readdirSync(FIXTURES).filter(f => f.endsWith('.config.json'));

  for (const configFile of configs) {
    it(`fixture: ${configFile}`, async () => {
      const configPath = resolve(FIXTURES, configFile);
      const testConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

      const db = await DuckDBNodeAdapter.create();
      try {
        await db.loadCSV(resolve(FIXTURES, testConfig.csvFile));

        const start = process.hrtime();
        const results = await runCrosstab(db, testConfig.config, testConfig.context);
        const [s, ns] = process.hrtime(start);
        const durationMs = (s * 1e3) + (ns / 1e6);

        // Performance logging for large datasets
        if (testConfig.csvFile.includes('large_perf')) {
          const logEntry = {
            timestamp: new Date().toISOString(),
            fixture: testConfig.csvFile,
            durationMs: durationMs.toFixed(2),
          };
          appendFileSync(PERF_LOG, JSON.stringify(logEntry) + '\n');
        }

        expectCloseDeepWithBootstrap(sortRows(results), testConfig.expectedFile);
      } finally {
        await db.close();
      }
    });
  }
});
