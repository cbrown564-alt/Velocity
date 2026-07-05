// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { VelocityEngine } from '../VelocityEngine';
import type { EngineRecodeConfig } from '../types';

/**
 * Brand Tracker recipe session round-trip (Phase B — PILOT-DEMO-2).
 *
 * Drives the transformation recipe's derive steps (plan §4.1 steps 4–7) on the
 * raw Wave 4 file, exports the session, imports it into a fresh engine, and
 * replays the persisted `transformLog` to prove the recipe restores every
 * derived variable — the reopen contract in arch_07 §8 ("Replay transformLog in
 * order on a fresh ingest"). Uses only shipped primitives; no replay engine.
 */

const RAW_W4 = 'brandtracker_w4_raw.sav';

/** Replay one persisted recode transform onto an engine (recreates the column + variable). */
async function replayRecode(
  engine: VelocityEngine,
  transform: { sourceColId: string; newColId: string; label: string; config: EngineRecodeConfig },
): Promise<void> {
  await engine.recode(transform.sourceColId, {
    ...transform.config,
    targetVariableName: transform.newColId,
    label: transform.label,
  });
}

/** Distribution of a derived column as a stable label→count map. */
async function distribution(engine: VelocityEngine, column: string, where = ''): Promise<Record<string, number>> {
  const res = await engine.query(`SELECT "${column}" AS k, COUNT(*) AS n FROM main ${where} GROUP BY 1 ORDER BY 1`);
  const out: Record<string, number> = {};
  for (const row of res.data.rows as Array<{ k: unknown; n: unknown }>) {
    out[String(row.k)] = Number(row.n);
  }
  return out;
}

describe('Brand tracker recipe session round-trip', () => {
  let sourceEngine: VelocityEngine;
  let targetEngine: VelocityEngine;

  beforeAll(async () => {
    const dataDir = path.resolve(__dirname, '../../../test_data/fixtures/brand_tracker');
    sourceEngine = await VelocityEngine.create({ runtime: 'node', dataDir, engineVersion: 'test-bt-recipe' });
    targetEngine = await VelocityEngine.create({ runtime: 'node', dataDir, engineVersion: 'test-bt-recipe' });
  });

  afterAll(async () => {
    await sourceEngine.close();
    await targetEngine.close();
  });

  it('replays recode steps 4–7 to restore derived variables in a fresh engine', async () => {
    // ── Source: run the recipe derive steps on raw W4 ──────────────────────
    await sourceEngine.loadFile(RAW_W4);
    sourceEngine.setWeight('rim_wt_final');

    // Step 4: reverse the consideration scale to canonical direction (value remap).
    await sourceEngine.recode('consider_atlas', {
      mode: 'categorical',
      mappings: { '1': '5', '2': '4', '3': '3', '4': '2', '5': '1', '98': '98' },
      targetVariableName: 'consider_atlas_fixed',
      label: 'Consideration atlas (canonical direction)',
    });
    // Step 5: derive age_band (binning).
    await sourceEngine.recode('age', {
      mode: 'binning',
      rules: [
        { min: 18, max: 35, label: '18-34' },
        { min: 35, max: 55, label: '35-54' },
        { min: 55, max: 200, label: '55+' },
      ],
      targetVariableName: 'age_band',
      label: 'Age band (derived)',
    });
    // Step 6: derive consideration T2B from the fixed scale (depends on step 4).
    await sourceEngine.recode('consider_atlas_fixed', {
      mode: 'categorical',
      mappings: { '4': 'T2B', '5': 'T2B', '1': 'Not T2B', '2': 'Not T2B', '3': 'Not T2B', '98': 'DK' },
      targetVariableName: 'consider_atlas_t2b',
      label: 'Atlas consideration T2B',
    });
    // Step 7: derive NPS classes (binning).
    await sourceEngine.recode('nps_atlas', {
      mode: 'binning',
      rules: [
        { min: 0, max: 7, label: 'Detractor' },
        { min: 7, max: 9, label: 'Passive' },
        { min: 9, max: 11, label: 'Promoter' },
      ],
      targetVariableName: 'nps_atlas_class',
      label: 'Atlas NPS class (derived)',
    });

    const derivedIds = ['consider_atlas_fixed', 'age_band', 'consider_atlas_t2b', 'nps_atlas_class'];
    const sourceDistributions = {
      age_band: await distribution(sourceEngine, 'age_band'),
      consider_atlas_t2b: await distribution(sourceEngine, 'consider_atlas_t2b'),
      nps_atlas_class: await distribution(sourceEngine, 'nps_atlas_class', 'WHERE nps_atlas IS NOT NULL'),
    };

    // ── Export the session (the recipe travels in transformLog) ────────────
    const exported = await sourceEngine.exportSession();
    expect(exported.operation).toBe('exportSession');
    const exportedRecodes = exported.data.transformLog.filter((t) => t.type === 'recode');
    expect(exportedRecodes.map((t) => t.newColId)).toEqual(derivedIds);

    // ── Import into a fresh engine loaded from the same raw file ────────────
    await targetEngine.loadFile(RAW_W4);
    const imported = await targetEngine.importSession(exported.data);
    expect(imported.operation).toBe('importSession');

    // Recipe is preserved on import…
    const importedTransforms = targetEngine.getSession().data.transformLog.filter((t) => t.type === 'recode');
    expect(importedTransforms.map((t) => t.newColId)).toEqual(derivedIds);

    // …but derived variables are not materialised until the log is replayed.
    const preReplayVars = new Set(targetEngine.describe().data.dataset!.variables.map((v) => v.id));
    for (const id of derivedIds) expect(preReplayVars.has(id)).toBe(false);

    // ── Replay the transformLog in order (arch_07 §8 reopen contract) ──────
    for (const transform of importedTransforms) {
      await replayRecode(targetEngine, {
        sourceColId: transform.sourceColId,
        newColId: transform.newColId,
        label: transform.label,
        config: transform.config as EngineRecodeConfig,
      });
    }

    // ── Assert derived variables restored, with identical values ───────────
    const postReplayVars = new Set(targetEngine.describe().data.dataset!.variables.map((v) => v.id));
    for (const id of derivedIds) expect(postReplayVars.has(id)).toBe(true);

    expect(await distribution(targetEngine, 'age_band')).toEqual(sourceDistributions.age_band);
    expect(await distribution(targetEngine, 'consider_atlas_t2b')).toEqual(sourceDistributions.consider_atlas_t2b);
    expect(await distribution(targetEngine, 'nps_atlas_class', 'WHERE nps_atlas IS NOT NULL')).toEqual(
      sourceDistributions.nps_atlas_class,
    );

    // Weighted crosstab runs on a replayed derived variable (recipe → analysis-ready).
    const crosstab = await targetEngine.runAnalysis('crosstab', {
      rowVars: ['consider_atlas_t2b'],
      colVar: 'segment',
      weightVar: 'rim_wt_final',
      resolveLabels: true,
    });
    expect(crosstab.metadata.isWeighted).toBe(true);
    expect(((crosstab.data as { rows?: unknown[] }).rows ?? []).length).toBeGreaterThan(0);
  }, 60000);
});
