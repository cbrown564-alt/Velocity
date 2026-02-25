/**
 * SPSS Parity Tests
 *
 * These tests verify that Velocity's statistical calculations match
 * SPSS Statistics output decimal-for-decimal. Reference values are
 * mathematically calculated and documented.
 *
 * To regenerate from SPSS:
 * 1. Load the CSV into SPSS
 * 2. Use MEANS procedure with /CELLS=MEAN STDDEV COUNT
 * 3. For weighted: use WEIGHT BY weight_var
 * 4. Compare results to expected values
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import { DuckDBNodeAdapter } from '../../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../../src/core/analysis/crosstabRunner';
import { calculateTScore, calculateESS, calculatePValue } from '../../src/services/statistics';

const FIXTURES = resolve(__dirname, 'fixtures');

describe('SPSS Parity: Weighted Statistics', () => {
  let db: DuckDBNodeAdapter;

  beforeAll(async () => {
    db = await DuckDBNodeAdapter.create();
    await db.loadCSV(resolve(FIXTURES, 'weighted_validation_simple.csv'));
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Weighted Mean Calculation', () => {
    it('computes correct weighted mean for Group A (equal weights)', async () => {
      // Group A: values [10, 20, 30, 40], weights all 1.0
      // Expected: (10+20+30+40)/4 = 25.0
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupA = results.rows.find((r: any) => r.colKey === 'A');
      expect(groupA.mean).toBeCloseTo(25.0, 6);
    });

    it('computes correct weighted mean for Group B (unequal weights)', async () => {
      // Group B: values [15, 25, 35, 45], weights [2.0, 0.5, 1.5, 1.0]
      // SumXW = 15*2 + 25*0.5 + 35*1.5 + 45*1 = 30 + 12.5 + 52.5 + 45 = 140
      // SumW = 2 + 0.5 + 1.5 + 1 = 5.0
      // Expected: 140/5 = 28.0
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupB = results.rows.find((r: any) => r.colKey === 'B');
      expect(groupB.mean).toBeCloseTo(28.0, 6);
    });
  });

  describe('Weighted Standard Deviation', () => {
    it('computes correct weighted stddev for Group A', async () => {
      // Group A: variance = (100+400+900+1600)/4 - 25^2 = 750 - 625 = 125
      // StdDev = sqrt(125) = 11.1803398875...
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupA = results.rows.find((r: any) => r.colKey === 'A');
      expect(groupA.stdDev).toBeCloseTo(11.180339887498949, 6);
    });

    it('computes correct weighted stddev for Group B', async () => {
      // Group B: SumX2W = 225*2 + 625*0.5 + 1225*1.5 + 2025*1 = 450 + 312.5 + 1837.5 + 2025 = 4625
      // Variance = 4625/5 - 28^2 = 925 - 784 = 141
      // StdDev = sqrt(141) = 11.8743420870379...
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupB = results.rows.find((r: any) => r.colKey === 'B');
      expect(groupB.stdDev).toBeCloseTo(11.874342087037917, 6);
    });
  });

  describe('Effective Sample Size (ESS)', () => {
    it('ESS equals n for equal weights', async () => {
      // Group A: all weights = 1.0, so ESS = n = 4
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupA = results.rows.find((r: any) => r.colKey === 'A');
      expect(groupA.stats.effN).toBeCloseTo(4.0, 6);
    });

    it('ESS is penalized for unequal weights', async () => {
      // Group B: weights [2.0, 0.5, 1.5, 1.0]
      // SumW = 5, SumW2 = 4 + 0.25 + 2.25 + 1 = 7.5
      // ESS = 25/7.5 = 3.333...
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupB = results.rows.find((r: any) => r.colKey === 'B');
      expect(groupB.stats.effN).toBeCloseTo(3.333333333, 6);
    });
  });

  describe('Sum Decomposition Fields', () => {
    it('captures sumXW for variance decomposition', async () => {
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupA = results.rows.find((r: any) => r.colKey === 'A');
      const groupB = results.rows.find((r: any) => r.colKey === 'B');

      expect(groupA.sumXW).toBeCloseTo(100, 6);
      expect(groupB.sumXW).toBeCloseTo(140, 6);
    });

    it('captures sumX2W for variance decomposition', async () => {
      const results = await runCrosstab(db, {
        rowVars: [],
        colVar: 'group',
        measureVar: 'value',
        measureLabel: 'Value',
        weightVar: 'weight',
        filters: [],
      }, { variables: {}, variableSets: {} });

      const groupA = results.rows.find((r: any) => r.colKey === 'A');
      const groupB = results.rows.find((r: any) => r.colKey === 'B');

      expect(groupA.sumX2W).toBeCloseTo(3000, 6);
      expect(groupB.sumX2W).toBeCloseTo(4625, 6);
    });
  });
});

describe('SPSS Parity: Weighted Denominator Integrity', () => {
  it('excludes NULL measure rows from weighted denominators', async () => {
    const db = await DuckDBNodeAdapter.create();
    await db.execute(`
      CREATE OR REPLACE TABLE main AS
      SELECT * FROM (VALUES
        ('A', 10.0, 1.0),
        ('A', NULL, 100.0),
        ('A', 20.0, 1.0)
      ) AS t("group", "value", "weight")
    `);

    const results = await runCrosstab(db, {
      rowVars: [],
      colVar: 'group',
      measureVar: 'value',
      measureLabel: 'Value',
      weightVar: 'weight',
      filters: [],
    }, { variables: {}, variableSets: {} });

    await db.close();

    const groupA = results.rows.find((r: any) => r.colKey === 'A');
    expect(groupA.mean).toBeCloseTo(15.0, 6);
    expect(groupA.validCount).toBe(2);
    expect(groupA.count).toBe(3);
    expect(groupA.weightedCount).toBeCloseTo(2.0, 6);
  });

  it('preserves unweighted and weighted bases for weighted frequency queries', async () => {
    const db = await DuckDBNodeAdapter.create();
    await db.execute(`
      CREATE OR REPLACE TABLE main AS
      SELECT * FROM (VALUES
        ('A', 1.0),
        ('A', 100.0),
        ('A', 1.0),
        ('B', 0.5)
      ) AS t("group", "weight")
    `);

    const results = await runCrosstab(db, {
      rowVars: ['group'],
      colVar: null,
      weightVar: 'weight',
      filters: [],
    }, { variables: {}, variableSets: {} });

    await db.close();

    const groupA = results.rows.find((r: any) => r.rowKey_0 === 'A');
    const groupB = results.rows.find((r: any) => r.rowKey_0 === 'B');

    expect(groupA.count).toBe(3);
    expect(groupA.weightedCount).toBeCloseTo(102.0, 6);
    expect(groupB.count).toBe(1);
    expect(groupB.weightedCount).toBeCloseTo(0.5, 6);
  });
});

describe('SPSS Parity: Cell-vs-Rest Significance', () => {
  it('uses exact rest mean (not total mean) for t-test', async () => {
    // When comparing Cell A vs Rest:
    // - Cell A: mean=25, stdDev=11.18, ESS=4
    // - Rest (B): mean=28, stdDev=11.87, ESS=3.33
    //
    // The t-score should be calculated using REST values, not TOTAL values.
    // If we incorrectly used TOTAL, the t-score would be different.

    const db = await DuckDBNodeAdapter.create();
    await db.loadCSV(resolve(FIXTURES, 'weighted_validation_simple.csv'));

    const results = await runCrosstab(db, {
      rowVars: [],
      colVar: 'group',
      measureVar: 'value',
      measureLabel: 'Value',
      weightVar: 'weight',
      filters: [],
    }, { variables: {}, variableSets: {} });

    await db.close();

    const groupA = results.rows.find((r: any) => r.colKey === 'A');

    // Verify the t-score matches expected Cell-vs-Rest calculation
    // Cell A vs Rest B: t = (25 - 28) / sqrt(125/4 + 141/3.33) = -3 / 8.58 ≈ -0.35
    expect(groupA.stats.tScore).toBeCloseTo(-0.34, 1);

    // Not significant at 80% level (|t| < 1.28)
    expect(groupA.sig).toBeUndefined();
  });
});

describe('Statistics Utility Functions', () => {
  describe('calculateTScore', () => {
    it('returns correct t-score for known values', () => {
      // Mean difference of 10, pooled SE of 5 should give t = 2.0
      const t = calculateTScore(20, 10, 30, 10, 10, 30);
      // SE = sqrt(100/30 + 100/30) = sqrt(6.67) = 2.58
      // t = 10 / 2.58 = 3.87
      expect(t).toBeCloseTo(3.872983, 4);
    });

    it('returns 0 for identical means', () => {
      const t = calculateTScore(25, 5, 100, 25, 5, 100);
      expect(t).toBe(0);
    });
  });

  describe('calculateESS', () => {
    it('returns n for equal weights', () => {
      // 10 respondents, all weight 1.0
      // sumW = 10, sumW2 = 10
      // ESS = 100/10 = 10
      expect(calculateESS(10, 10)).toBe(10);
    });

    it('penalizes for extreme weight variation', () => {
      // 2 respondents: weights 0.1 and 1.9
      // sumW = 2, sumW2 = 0.01 + 3.61 = 3.62
      // ESS = 4/3.62 = 1.105
      expect(calculateESS(2, 3.62)).toBeCloseTo(1.105, 2);
    });
  });

  describe('calculatePValue', () => {
    it('returns ~0.05 for z = 1.96', () => {
      const p = calculatePValue(1.96);
      expect(p).toBeCloseTo(0.05, 2);
    });

    it('returns ~0.32 for z = 1.0', () => {
      const p = calculatePValue(1.0);
      expect(p).toBeCloseTo(0.317, 2);
    });

    it('returns 1.0 for z = 0', () => {
      expect(calculatePValue(0)).toBe(1);
    });
  });
});
