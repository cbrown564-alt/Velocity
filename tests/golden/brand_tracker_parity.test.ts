/**
 * Brand Tracker Golden Parity Tests
 *
 * Validates Velocity crosstabs on the committed brand tracker .sav fixtures
 * reproduce weighted funnel metrics in validation/brand_tracker_ground_truth.json.
 *
 * Metric definitions (see ground truth `definitions` block):
 * - aided_pct / unaided_any_pct / used_p3m: weighted frequency of code 1 on total base
 * - consider_t2b_pct_of_total: sum weightedCount(codes 4,5) / total weighted base
 * - weight_mean: unweighted mean of wt (raked to ~1.0)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DuckDBNodeAdapter } from '../../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../../src/core/analysis/crosstabRunner';
import type { Variable, VariableSet } from '../../src/types';

const GROUND_TRUTH_PATH = resolve(__dirname, '../../validation/brand_tracker_ground_truth.json');
const DEMO_W4 = resolve(__dirname, '../../public/examples/brandtracker_w4.sav');
const FIXTURE_DIR = resolve(__dirname, '../../test_data/fixtures/brand_tracker');

const BRANDS = ['atlas', 'beacon', 'meridian', 'solstice', 'cardinal'] as const;

type GroundTruth = {
  waves: Record<
    string,
    {
      funnel: Record<
        string,
        {
          aided_pct: number;
          unaided_any_pct: number;
          consider_t2b_pct_of_total: number;
        }
      >;
      weighting: { weight_mean: number; design_effect: number };
    }
  >;
  definitions: Record<string, string>;
};

type CrosstabRow = {
  rowKey_0: number | string;
  colKey: string;
  count: number;
  weightedCount?: number;
  mean?: number;
};

type DbContext = {
  db: DuckDBNodeAdapter;
  vars: Record<string, Variable>;
  varSets: Record<string, VariableSet>;
};

function loadGroundTruth(): GroundTruth {
  return JSON.parse(readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
}

function totalWeightedBase(rows: CrosstabRow[]): number {
  return rows.reduce((sum, row) => sum + (row.weightedCount ?? row.count), 0);
}

function weightedPctOfCode(rows: CrosstabRow[], code: number): number {
  const total = totalWeightedBase(rows);
  const match = rows.find((row) => Number(row.rowKey_0) === code);
  return total > 0 ? ((match?.weightedCount ?? 0) / total) * 100 : 0;
}

function sumWeightedCodes(rows: CrosstabRow[], codes: number[]): number {
  return rows
    .filter((row) => codes.includes(Number(row.rowKey_0)))
    .reduce((sum, row) => sum + (row.weightedCount ?? 0), 0);
}

async function loadSav(path: string): Promise<DbContext> {
  const db = await DuckDBNodeAdapter.create();
  const result = await db.loadSav(path);
  return {
    db,
    vars: Object.fromEntries(result.variables.map((v) => [v.id, v])),
    varSets: Object.fromEntries(result.variableSets.map((vs) => [vs.id, vs])),
  };
}

async function weightedBinaryPct(ctx: DbContext, varName: string, weightVar: string | null): Promise<number> {
  const results = await runCrosstab(
    ctx.db,
    {
      rowVars: [varName],
      colVar: null,
      weightVar,
      filters: [],
    },
    { variables: ctx.vars, variableSets: ctx.varSets },
  );
  return weightedPctOfCode(results.rows as CrosstabRow[], 1);
}

async function weightedConsiderT2BPctOfTotal(ctx: DbContext, brand: string, weightVar: string): Promise<number> {
  const [considerResults, baseResults] = await Promise.all([
    runCrosstab(
      ctx.db,
      {
        rowVars: [`consider_${brand}`],
        colVar: null,
        weightVar,
        filters: [],
      },
      { variables: ctx.vars, variableSets: ctx.varSets },
    ),
    runCrosstab(
      ctx.db,
      {
        rowVars: [`aware_${brand}`],
        colVar: null,
        weightVar,
        filters: [],
      },
      { variables: ctx.vars, variableSets: ctx.varSets },
    ),
  ]);
  const totalBase = totalWeightedBase(baseResults.rows as CrosstabRow[]);
  const t2bWeighted = sumWeightedCodes(considerResults.rows as CrosstabRow[], [4, 5]);
  return totalBase > 0 ? (t2bWeighted / totalBase) * 100 : 0;
}

async function weightMean(ctx: DbContext, weightVar: string): Promise<number> {
  const results = await runCrosstab(
    ctx.db,
    {
      rowVars: [],
      colVar: null,
      measureVar: weightVar,
      measureLabel: weightVar,
      weightVar: null,
      filters: [],
    },
    { variables: ctx.vars, variableSets: ctx.varSets },
  );
  const row = results.rows[0] as CrosstabRow;
  expect(row?.mean, `mean of ${weightVar}`).toBeDefined();
  return row.mean!;
}

describe('Brand Tracker Parity: demo W4 (public/examples/brandtracker_w4.sav)', () => {
  let ctx: DbContext;
  const gt = loadGroundTruth();
  const expectedW4 = gt.waves.w4.funnel;

  beforeAll(async () => {
    ctx = await loadSav(DEMO_W4);
  }, 30_000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it('documents engine metric definitions in ground truth', () => {
    expect(gt.definitions.aided_pct).toMatch(/weighted frequency of code 1/i);
    expect(gt.definitions.consider_t2b_pct_of_total).toMatch(/weightedCount\(codes 4,5\)/i);
  });

  it('weighted aided-awareness % for all 5 brands matches ground truth within 0.1pt', async () => {
    for (const brand of BRANDS) {
      const actual = await weightedBinaryPct(ctx, `aware_${brand}`, 'wt');
      expect(actual, `aided ${brand}`).toBeCloseTo(expectedW4[brand].aided_pct, 1);
    }
  });

  it('Atlas consideration T2B (of total) W4 matches ground truth within 0.1pt', async () => {
    const actual = await weightedConsiderT2BPctOfTotal(ctx, 'atlas', 'wt');
    expect(actual).toBeCloseTo(expectedW4.atlas.consider_t2b_pct_of_total, 1);
  });

  it('Beacon consideration T2B exceeds Meridian in W4 (rank-change fact)', async () => {
    const beacon = await weightedConsiderT2BPctOfTotal(ctx, 'beacon', 'wt');
    const meridian = await weightedConsiderT2BPctOfTotal(ctx, 'meridian', 'wt');
    expect(beacon).toBeGreaterThan(meridian);
    expect(beacon).toBeCloseTo(expectedW4.beacon.consider_t2b_pct_of_total, 1);
    expect(meridian).toBeCloseTo(expectedW4.meridian.consider_t2b_pct_of_total, 1);
  });

  it('wt mean is approximately 1.0', async () => {
    const mean = await weightMean(ctx, 'wt');
    expect(mean).toBeCloseTo(gt.waves.w4.weighting.weight_mean, 2);
    expect(mean).toBeCloseTo(1.0, 2);
  });
});

describe('Brand Tracker Parity: W3 cross-wave comparability', () => {
  let ctx: DbContext;
  const gt = loadGroundTruth();

  beforeAll(async () => {
    ctx = await loadSav(resolve(FIXTURE_DIR, 'brandtracker_w3.sav'));
  }, 30_000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it('weighted Atlas aided awareness W3 matches ground truth within 0.1pt', async () => {
    const actual = await weightedBinaryPct(ctx, 'aware_atlas', 'wt');
    expect(actual).toBeCloseTo(gt.waves.w3.funnel.atlas.aided_pct, 1);
  });
});

describe('Brand Tracker Parity: raw W4 agency file', () => {
  let ctx: DbContext;

  beforeAll(async () => {
    ctx = await loadSav(resolve(FIXTURE_DIR, 'brandtracker_w4_raw.sav'));
  }, 30_000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it('loads with rim_wt_final and body_weight_kg, no age_band or wt', () => {
    const ids = Object.keys(ctx.vars);
    expect(ids).toContain('rim_wt_final');
    expect(ids).toContain('body_weight_kg');
    expect(ids).not.toContain('age_band');
    expect(ids).not.toContain('wt');
  });

  it('has att_value_atlas and att_value_beacon but not att_worth_atlas or att_worth_beacon', () => {
    const ids = Object.keys(ctx.vars);
    expect(ids).toContain('att_value_atlas');
    expect(ids).toContain('att_value_beacon');
    expect(ids).not.toContain('att_worth_atlas');
    expect(ids).not.toContain('att_worth_beacon');
  });
});

describe('Brand Tracker Parity: weight mean across clean waves', () => {
  const gt = loadGroundTruth();
  const cleanWaves = [
    { key: 'w1', path: resolve(FIXTURE_DIR, 'brandtracker_w1.sav') },
    { key: 'w3', path: resolve(FIXTURE_DIR, 'brandtracker_w3.sav') },
    { key: 'w4', path: DEMO_W4 },
    { key: 'w5', path: resolve(FIXTURE_DIR, 'brandtracker_w5.sav') },
  ] as const;

  for (const wave of cleanWaves) {
    it(`${wave.key}: wt mean ≈ 1.0`, async () => {
      const ctx = await loadSav(wave.path);
      try {
        const mean = await weightMean(ctx, 'wt');
        expect(mean).toBeCloseTo(gt.waves[wave.key].weighting.weight_mean, 2);
        expect(mean).toBeCloseTo(1.0, 2);
      } finally {
        await ctx.db.close();
      }
    });
  }
});
