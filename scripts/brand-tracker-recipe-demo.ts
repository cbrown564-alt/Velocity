/**
 * Brand Tracker Transformation Recipe Demo (Phase B — PILOT-DEMO-2)
 *
 * Executes the numbered recipe in
 *   docs/workstreams/deck_native/10_brand_tracker_demo_plan.md §4.1 (steps 1–10)
 * end to end against the real VelocityEngine Node runtime, using only shipped
 * engine primitives (loadFile, workspace load, propose/harmonize mappings,
 * recode, runAnalysis, buildDeck, exportDeck, commitDeck, exportSession).
 *
 * This is a *demonstration composed of shipped primitives* (plan §8): it does
 * NOT introduce a recipe manager or replay engine. Friction encountered while
 * driving the real engine is captured as internal signals in
 *   docs/pilot_04a_processing_gap_discovery.md §7
 * and summarised in
 *   docs/workstreams/deck_native/brand_tracker_recipe_gap_log.md
 *
 * Run: `npx tsx scripts/brand-tracker-recipe-demo.ts` (must exit 0).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import { VelocityEngine } from '../src/engine/VelocityEngine.js';
import type { EngineAnalysisSettings } from '../src/engine/velocityEngineTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const FIXTURE_DIR = 'test_data/fixtures/brand_tracker';
const RAW_W4 = `${FIXTURE_DIR}/brandtracker_w4_raw.sav`;
const WAVE_FILES = [
  { rel: `${FIXTURE_DIR}/brandtracker_w1.sav`, wave: 1 },
  { rel: `${FIXTURE_DIR}/brandtracker_w2.sav`, wave: 2 },
  { rel: `${FIXTURE_DIR}/brandtracker_w3.sav`, wave: 3 },
];
const WAVE5 = `${FIXTURE_DIR}/brandtracker_w5.sav`;

const OUT_DIR = path.resolve(REPO_ROOT, 'tests/fixtures/export');
const DECK_OUT = path.join(OUT_DIR, 'brandtracker-recipe-report.pptx');
const SESSION_OUT = path.join(OUT_DIR, 'brandtracker-recipe-session.velocity.json');

const BRANDS = ['atlas', 'beacon', 'meridian', 'solstice', 'cardinal'] as const;

// 95% confidence, pairwise column comparisons, no multiplicity correction.
const SIG: EngineAnalysisSettings = {
  comparisonMethod: 'pairwise',
  correctionType: 'none',
  significanceLevel: 0.95,
};

const gapSignals: string[] = [];
function logGap(id: string, message: string): void {
  gapSignals.push(`${id}: ${message}`);
  console.log(`  ⚑ GAP ${id} — ${message}`);
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(64));
}

function unwrap<T>(env: { data?: T; error?: { message: string } }, what: string): T {
  if (env.error) throw new Error(`${what} failed: ${env.error.message}`);
  return env.data as T;
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VELOCITY — Brand Tracker transformation recipe (Phase B)  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const engine = await VelocityEngine.create({ runtime: 'node', dataDir: REPO_ROOT });

  // ── Step 1: Load raw wave 4 alongside waves 1–3 in the workspace ──────────
  section('STEP 1 · Multi-dataset workspace: waves 1–3 + raw W4');
  const workspaceIds: Record<string, string> = {};
  for (const { rel, wave } of WAVE_FILES) {
    const summary = unwrap(await engine.loadWorkspaceDataset(rel, { waveNumber: wave }), `workspace load W${wave}`);
    workspaceIds[`w${wave}`] = summary.id;
    console.log(`  ✓ Loaded ${summary.name} → ${summary.rowCount} rows, ${summary.variableCount} vars (wave ${wave})`);
  }
  const rawSummary = unwrap(await engine.loadWorkspaceDataset(RAW_W4, { waveNumber: 4 }), 'workspace load raw W4');
  workspaceIds.rawW4 = rawSummary.id;
  console.log(
    `  ✓ Loaded raw ${rawSummary.name} → ${rawSummary.rowCount} rows, ${rawSummary.variableCount} vars (wave 4, RAW)`,
  );

  // The recode/analysis primitives operate on the active `main` table, so load
  // the raw wave as the active analysis dataset for the transformation pipeline.
  const mainSummary = unwrap(await engine.loadFile(RAW_W4), 'loadFile raw W4');
  console.log(`  ✓ Active analysis dataset = ${mainSummary.datasetName} (${mainSummary.rowCount} rows)`);

  // ── Step 2: Identify the true weight (rim_wt_final, not the decoy) ────────
  section('STEP 2 · Weight discovery (rim_wt_final vs body_weight_kg decoy)');
  await engine.annotateDataset();
  const search = unwrap(
    await engine.searchVariables('survey sampling weight rim', { limit: 5 }),
    'searchVariables weight',
  );
  console.log('  Semantic search "survey sampling weight rim":');
  for (const r of search)
    console.log(`    ${r.variable.name.padEnd(16)} ${r.relevance.toFixed(3)}  ${r.variable.label ?? ''}`);

  const describe = unwrap(engine.describe(), 'describe');
  const varNames = new Set(describe.dataset!.variables.map((v) => v.name));
  const weightCandidates = [...varNames].filter((n) => /wt|weight|rim/i.test(n));
  console.log(`  Weight-shaped candidates: ${weightCandidates.join(', ')}`);

  // A valid analysis (rim) weight is centred on ~1.0; a body-weight decoy is not.
  const wStats = unwrap(
    await engine.query(
      `SELECT ROUND(AVG(rim_wt_final), 3) AS rim_mean, ROUND(AVG(body_weight_kg), 1) AS decoy_mean FROM main`,
    ),
    'weight stats query',
  );
  const { rim_mean, decoy_mean } = wStats.rows[0] as { rim_mean: number; decoy_mean: number };
  console.log(`  rim_wt_final mean = ${rim_mean} (≈1.0 → genuine rim weight)`);
  console.log(`  body_weight_kg mean = ${decoy_mean} (kg → respondent body-weight decoy, NOT a weight)`);
  const trueWeight = 'rim_wt_final';
  unwrap(engine.setWeight(trueWeight), 'setWeight');
  console.log(`  ✓ Applied analysis weight: ${trueWeight}`);
  if (Number(rim_mean) < 0.9 || Number(rim_mean) > 1.1) {
    throw new Error(`Weight discovery sanity check failed: ${trueWeight} mean ${rim_mean} not ≈ 1.0`);
  }

  // ── Step 3: Map renamed attribute variables to the prior wave ─────────────
  section('STEP 3 · Fuzzy variable mapping (att_value_* → att_worth_*)');
  const proposed = unwrap(
    await engine.proposeWorkspaceMappings(workspaceIds.rawW4, workspaceIds.w3),
    'proposeWorkspaceMappings',
  );
  const renameMatches = proposed.filter(
    (m) => m.sourceVariableId.startsWith('att_value_') && (m.targetVariableId ?? '').startsWith('att_worth_'),
  );
  console.log(`  ${proposed.length} candidate mappings; renamed-attribute matches:`);
  for (const m of renameMatches) {
    console.log(`    ${m.sourceVariableId.padEnd(18)} → ${m.targetVariableId}  (status=${m.status})`);
  }
  if (renameMatches.length < 2) {
    throw new Error(`Expected att_value_* → att_worth_* fuzzy matches, found ${renameMatches.length}`);
  }
  // Confirm the renamed-attribute mappings and produce a harmonized stacked table.
  const confirmed = proposed.map((m) => ({
    ...m,
    confirmed: renameMatches.some((rm) => rm.sourceVariableId === m.sourceVariableId) ? true : m.confirmed,
  }));
  const harmonized = unwrap(
    await engine.harmonizeWorkspaceDatasets({
      sourceDatasetId: workspaceIds.rawW4,
      targetDatasetId: workspaceIds.w3,
      mappings: confirmed,
      outputTableName: 'bt_harmonized_w3_w4',
      onlyConfirmed: true,
    }),
    'harmonizeWorkspaceDatasets',
  );
  console.log(`  ✓ Harmonized table "${harmonized.tableName}" → ${harmonized.rowCount} rows`);
  logGap(
    'INF-08',
    'harmonize produces a NEW stacked output table; there is no in-place rename on the active dataset, ' +
      'and harmonization mappings are not captured in transformLog/session for cross-wave replay (META-HYGIENE / RECIPE-REPLAY).',
  );

  // ── Step 4: Fix the reversed consideration scale (dual-state value remap) ─
  section('STEP 4 · Reverse consideration scale → canonical direction');
  // Raw W4 codes consideration 1=definitely consider … 5=definitely not; canonical
  // waves use the reverse (5=definitely consider). Remap 1↔5, 2↔4 so T2B = codes 4,5.
  const reverseMap = { '1': '5', '2': '4', '3': '3', '4': '2', '5': '1', '98': '98' };
  for (const brand of BRANDS) {
    unwrap(
      await engine.recode(`consider_${brand}`, {
        mode: 'categorical',
        mappings: reverseMap,
        targetVariableName: `consider_${brand}_fixed`,
        label: `Consideration ${brand} (canonical direction)`,
      }),
      `recode consider_${brand}_fixed`,
    );
  }
  console.log(`  ✓ Reversed & remapped consideration for ${BRANDS.length} brands (consider_<brand>_fixed)`);

  // ── Step 5: Derive age_band via recode binning ───────────────────────────
  section('STEP 5 · Derive age_band (18–34 / 35–54 / 55+)');
  unwrap(
    await engine.recode('age', {
      mode: 'binning',
      rules: [
        { min: 18, max: 35, label: '18-34' },
        { min: 35, max: 55, label: '35-54' },
        { min: 55, max: 200, label: '55+' },
      ],
      targetVariableName: 'age_band',
      label: 'Age band (derived)',
    }),
    'recode age_band',
  );
  const ageBands = unwrap(
    await engine.query(`SELECT age_band, COUNT(*) AS n FROM main GROUP BY 1 ORDER BY 1`),
    'age_band query',
  );
  console.log('  ✓ age_band:', ageBands.rows.map((r) => `${(r as any).age_band}=${(r as any).n}`).join('  '));

  // ── Step 6: Derive consideration T2B per brand ───────────────────────────
  section('STEP 6 · Derive consideration Top-2-Box per brand');
  const t2bMap = { '4': 'T2B', '5': 'T2B', '1': 'Not T2B', '2': 'Not T2B', '3': 'Not T2B', '98': 'DK' };
  for (const brand of BRANDS) {
    unwrap(
      await engine.recode(`consider_${brand}_fixed`, {
        mode: 'categorical',
        mappings: t2bMap,
        targetVariableName: `consider_${brand}_t2b`,
        label: `${brand} consideration T2B`,
      }),
      `recode consider_${brand}_t2b`,
    );
  }
  console.log(`  ✓ Derived consideration T2B for ${BRANDS.length} brands (consider_<brand>_t2b)`);
  logGap(
    'INF-06',
    'consideration T2B nets are derived one recode per brand (5 calls); there is no reusable "net" primitive ' +
      'to apply the {4,5}→T2B grouping across a brand grid in one step (NET-DERIVE).',
  );

  // ── Step 7: Derive NPS classes (promoter / passive / detractor) ──────────
  section('STEP 7 · Derive NPS classes for Atlas users');
  unwrap(
    await engine.recode('nps_atlas', {
      mode: 'binning',
      rules: [
        { min: 0, max: 7, label: 'Detractor' },
        { min: 7, max: 9, label: 'Passive' },
        { min: 9, max: 11, label: 'Promoter' },
      ],
      targetVariableName: 'nps_atlas_class',
      label: 'Atlas NPS class (derived)',
    }),
    'recode nps_atlas_class',
  );
  const npsDist = unwrap(
    await engine.query(
      `SELECT nps_atlas_class, COUNT(*) AS n FROM main WHERE nps_atlas IS NOT NULL GROUP BY 1 ORDER BY 1`,
    ),
    'nps class query',
  );
  console.log(
    '  ✓ nps_atlas_class:',
    npsDist.rows.map((r) => `${(r as any).nps_atlas_class}=${(r as any).n}`).join('  '),
  );
  logGap(
    'INF-07',
    'NPS *score* (%promoters − %detractors as one displayed stat) cannot be derived with current recode/crosstab; ' +
      'demo-around shows promoter/passive/detractor shares instead (NET-DERIVE).',
  );

  // ── Step 8: Weighted crosstabs with significance (funnel / competitive / segment) ─
  section('STEP 8 · Weighted crosstabs with significance');
  async function crosstab(label: string, rowVars: string[], colVar: string): Promise<void> {
    const res = await engine.runAnalysis('crosstab', {
      rowVars,
      colVar,
      resolveLabels: true,
      analysisSettings: SIG,
    });
    if (res.error) throw new Error(`crosstab ${label} failed: ${res.error.message}`);
    const rows = ((res.data as { rows?: unknown[] })?.rows ?? []) as Array<Record<string, unknown>>;
    const sigCells = rows.filter((r) => typeof r.sigLetters === 'string' && (r.sigLetters as string).length > 0).length;
    const weighted = (res.metadata as { isWeighted?: boolean })?.isWeighted;
    console.log(
      `  ✓ ${label.padEnd(42)} rows=${String(rows.length).padStart(3)}  weighted=${weighted}  sig-cells=${sigCells}`,
    );
  }

  // Funnel (Atlas): awareness → consideration T2B → usage, cut by segment.
  await crosstab('Funnel: Atlas aware × segment', ['aware_atlas'], 'segment');
  await crosstab('Funnel: Atlas consider T2B × segment', ['consider_atlas_t2b'], 'segment');
  await crosstab('Funnel: Atlas usage × segment', ['used_p3m_atlas'], 'segment');
  // Competitive: Beacon overtakes Meridian on consideration.
  await crosstab('Competitive: Beacon consider T2B × segment', ['consider_beacon_t2b'], 'segment');
  await crosstab('Competitive: Meridian consider T2B × segment', ['consider_meridian_t2b'], 'segment');
  // Segment / demographic divergence (Growth + under-35).
  await crosstab('Segment: Atlas consider T2B × age_band', ['consider_atlas_t2b'], 'age_band');
  // Drivers: innovative (mover) vs worth-the-price (broadly stable, renamed var).
  await crosstab('Driver: Atlas "innovative" × segment', ['att_innov_atlas'], 'segment');
  await crosstab('Driver: Atlas "worth the price" × segment', ['att_value_atlas'], 'segment');
  logGap(
    'INF-09',
    'multi-break banner tables are composed as one crosstab per break (segment, age_band, region …); ' +
      'there is no persistent banner plan reused across the deck (BANNER-PLAN).',
  );

  // ── Step 9: Build + export deck, commit deck, export session ──────────────
  section('STEP 9 · Build + export deck, commit, export session');
  const deckSpec = {
    title: 'Atlas Brand Tracker — Wave 4 Readout (recipe demo)',
    subtitle: 'Synthetic dataset; recipe replays derived variables on reopen',
    sections: [
      {
        title: 'Funnel',
        slides: [
          {
            rowVars: ['consider_atlas_t2b'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Atlas consideration (T2B) by segment',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
          {
            rowVars: ['used_p3m_atlas'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Atlas past-3-month usage by segment',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
        ],
      },
      {
        title: 'Competitive position',
        slides: [
          {
            rowVars: ['consider_beacon_t2b'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Beacon consideration (T2B) by segment',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
          {
            rowVars: ['consider_meridian_t2b'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Meridian consideration (T2B) by segment',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
        ],
      },
      {
        title: 'Segments & drivers',
        slides: [
          {
            rowVars: ['consider_atlas_t2b'],
            colVar: 'age_band',
            weightVar: trueWeight,
            title: 'Atlas consideration (T2B) by age band',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
          {
            rowVars: ['att_innov_atlas'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Atlas "innovative" association by segment',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
        ],
      },
      {
        title: 'Advocacy',
        slides: [
          {
            rowVars: ['nps_atlas_class'],
            colVar: 'segment',
            weightVar: trueWeight,
            title: 'Atlas NPS classes by segment (low base — Atlas users only)',
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
        ],
      },
    ],
  };

  const deck = unwrap(await engine.buildDeck(deckSpec), 'buildDeck');
  console.log(`  ✓ Deck "${deck.spec.title}" → ${deck.slides.length} slides, ${deck.errors.length} build errors`);
  for (const err of deck.errors) console.log(`    ⚠ slide ${err.slideIndex}: ${err.error.message}`);
  if (deck.errors.length > 0) throw new Error(`Deck built with ${deck.errors.length} slide errors`);

  const pptx = unwrap(await engine.exportDeck(deck, { format: 'pptx' }), 'exportDeck');
  writeFileSync(DECK_OUT, pptx);
  console.log(`  ✓ PPTX written: ${path.relative(REPO_ROOT, DECK_OUT)} (${(pptx.byteLength / 1024).toFixed(1)} KB)`);

  unwrap(engine.commitDeck(deck), 'commitDeck');
  console.log('  ✓ Deck committed to session state');

  const sessionEnv = await engine.exportSession();
  const session = unwrap(sessionEnv, 'exportSession');
  writeFileSync(SESSION_OUT, JSON.stringify(session, null, 2));
  const recodeTransforms = session.transformLog.filter((t) => t.type === 'recode');
  console.log(`  ✓ Session written: ${path.relative(REPO_ROOT, SESSION_OUT)}`);
  console.log(
    `    format=${session.formatVersion}  transforms=${session.transformLog.length} (recodes=${recodeTransforms.length})  slides=${session.slides?.length ?? 0}`,
  );
  console.log('    Recipe = transformLog; steps 4–7 replay on reopen (arch_07 §8). Derived variables in transformLog:');
  for (const t of recodeTransforms) console.log(`      • ${t.sourceColId} → ${t.newColId}`);

  // ── Step 10: Next quarter — swap in wave 5 (stub / log only; full refresh = Phase D) ─
  section('STEP 10 · Wave-5 swap (stub — full wave refresh is Phase D)');
  const w5 = unwrap(await engine.loadWorkspaceDataset(WAVE5, { waveNumber: 5 }), 'workspace load W5');
  console.log(`  ✓ Registered refresh wave ${w5.name} (${w5.rowCount} rows) in workspace`);
  console.log('  ℹ Wave refresh (assessDatasetReplacement + wave_refresh template mode) is out of Phase B scope.');
  logGap(
    'INF-04',
    'repeating steps 4–7 on wave 5 requires manual re-execution of every recode; there is no cross-dataset ' +
      'recipe replay. This is exactly RECIPE-REPLAY (already tracked as INF-04) made concrete by this demo.',
  );

  // ── Gap summary ───────────────────────────────────────────────────────────
  section('GAP LOG (internal signals — NOT external pilot evidence)');
  for (const g of gapSignals) console.log(`  ${g}`);

  section('COMPLETE');
  console.log('  Recipe steps 1–10 executed against the real engine with zero manual repair.');
  console.log(`  Artifacts: ${path.relative(REPO_ROOT, DECK_OUT)}, ${path.relative(REPO_ROOT, SESSION_OUT)}\n`);

  await engine.close();
}

main().catch((err) => {
  console.error('\n✗ Brand tracker recipe demo failed:', err);
  process.exit(1);
});
