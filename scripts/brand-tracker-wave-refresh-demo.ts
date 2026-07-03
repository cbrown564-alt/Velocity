/**
 * Brand Tracker Wave-Refresh Demo (Phase D — PILOT-DEMO-4)
 *
 * Demonstrates the closing beat of the tracker-update wedge
 *   docs/workstreams/deck_native/10_brand_tracker_demo_plan.md §5.3 / §6:
 *
 *   1. Build the Wave 4 deck (a subset of the story-template slides) and commit it,
 *      so we have saved slide recipes referencing shipped, analysis-ready variables.
 *   2. Import Wave 5 (the next-quarter refresh wave).
 *   3. Run the dataset-replacement review (`assessDatasetReplacement`) on the saved
 *      slide recipes against the Wave 5 schema — all slides resolve (READY).
 *   4. Apply the `wave_refresh` template mode: recompute each action title's
 *      direction/magnitude against Wave 5 and FLAG the recomputed titles for human
 *      confirmation — never silently rewritten (per 08 §4).
 *   5. Flag the previously significant unaided-awareness mover as a DEMOTION
 *      candidate now that it is flat W4->W5.
 *   6. Make the RECIPE-REPLAY limitation legible: recipe-derived nets (recode
 *      targets) do NOT survive dataset replacement and block the review, which is
 *      exactly INF-04 (RECIPE-REPLAY) — do not build the replay engine here.
 *
 * This is a *demonstration composed of shipped primitives* (plan §8): no recipe
 * manager, no replay engine, no new engine surface.
 *
 * Run: `npm run demo:brand-tracker-wave-refresh` (must exit 0).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { VelocityEngine } from '../src/engine/VelocityEngine.js';
import { assessDatasetReplacement } from '../src/core/export/slideRecipe.js';
import type { TemplateRefreshMode } from '../src/core/export/types.js';
import type { DeckSpec } from '../src/engine/types.js';
import type { Slide } from '../src/types/slides.js';
import type { Variable, VariableSet } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const W4 = 'public/examples/brandtracker_w4.sav';
const W5 = 'test_data/fixtures/brand_tracker/brandtracker_w5.sav';
const GROUND_TRUTH = path.resolve(REPO_ROOT, 'validation/brand_tracker_ground_truth.json');

// wave_refresh: recompute bindings for the new wave, preserve untouched slide
// content, and surface recomputed titles for confirmation (never silent rewrite).
const REFRESH_MODE: TemplateRefreshMode = 'wave_refresh';
const GROWTH_SEGMENT_CODE = 2; // 1=Core, 2=Growth, 3=Value

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

type WaveMetrics = {
  unaidedOverall: number;
  aidedOverall: number;
  considerT2BOverall: number;
  unaidedGrowth: number;
};

async function measureActiveWave(engine: VelocityEngine): Promise<WaveMetrics> {
  const pct = async (expr: string, baseExpr = 'wt'): Promise<number> => {
    const res = unwrap(
      await engine.query(`SELECT SUM(${expr}) / NULLIF(SUM(${baseExpr}), 0) * 100 AS pct FROM main`),
      `weighted pct (${expr})`,
    );
    return Number((res.rows[0] as { pct: number }).pct);
  };
  return {
    unaidedOverall: await pct('CASE WHEN unaided_any_atlas = 1 THEN wt ELSE 0 END'),
    aidedOverall: await pct('CASE WHEN aware_atlas = 1 THEN wt ELSE 0 END'),
    considerT2BOverall: await pct('CASE WHEN consider_atlas IN (4, 5) THEN wt ELSE 0 END'),
    unaidedGrowth: await pct(
      `CASE WHEN unaided_any_atlas = 1 AND segment = ${GROWTH_SEGMENT_CODE} THEN wt ELSE 0 END`,
      `CASE WHEN segment = ${GROWTH_SEGMENT_CODE} THEN wt ELSE 0 END`,
    ),
  };
}

function refreshTitle(
  label: string,
  before: number,
  after: number,
  significant: boolean,
  wasHeadlineMover: boolean,
) {
  const delta = after - before;
  const dir = delta >= 0 ? 'up' : 'down';
  // Defensibility guard (08 §4): a non-significant W4->W5 move is titled
  // "broadly stable", never as a directional gain/loss the test does not support.
  const recomputed = significant
    ? `${label} moved ${dir} ${Math.abs(delta).toFixed(1)}pts to ${after.toFixed(0)}% (W5)`
    : `${label} is broadly stable at ${after.toFixed(0)}% (W5)`;
  const demotionCandidate = wasHeadlineMover && !significant;
  return { before, after, delta, significant, recomputed, demotionCandidate };
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VELOCITY — Brand Tracker WAVE REFRESH (Phase D)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const gt = JSON.parse(readFileSync(GROUND_TRUTH, 'utf-8')) as {
    deltas: { w4_w5: { funnel: { atlas: Record<string, { delta_pts: number; significant_95: boolean }> } } };
  };
  const w4w5 = gt.deltas.w4_w5.funnel.atlas;

  const engine = await VelocityEngine.create({ runtime: 'node', dataDir: REPO_ROOT });

  // ── Step 1: Build + commit the Wave 4 deck (saved slide recipes) ──────────
  section('STEP 1 · Build + commit Wave 4 deck (saved slide recipes)');
  unwrap(await engine.loadFile(W4), 'loadFile W4');
  const vars = unwrap(engine.describe(), 'describe W4').dataset!.variables;
  const byName = new Map(vars.map((v) => [v.name.toLowerCase(), v.id]));
  const id = (name: string): string => {
    const vid = byName.get(name.toLowerCase());
    if (!vid) throw new Error(`Expected variable "${name}" not found in W4`);
    return vid;
  };
  const wt = id('wt');
  unwrap(engine.setWeight(wt), 'setWeight W4');

  // Slides reference only shipped analysis-ready variables (present in every wave),
  // so the saved recipes survive dataset replacement.
  const deckSpec: DeckSpec = {
    title: 'Atlas Brand Tracker — Wave 4 Readout (refresh source)',
    subtitle: 'Saved slide recipes for the next-quarter wave refresh.',
    sections: [
      {
        title: 'Brand health & funnel',
        slides: [
          {
            rowVars: [id('unaided_any_atlas')],
            weightVar: wt,
            title: 'The gain is at the top: unaided awareness jumped 6pts to 37%',
            visualizationType: 'chart' as const,
            chartType: 'horizontal-bar' as const,
          },
          {
            rowVars: [id('aware_atlas')],
            weightVar: wt,
            title: 'Atlas aided awareness rose 6pts to 73%, its first significant gain in four waves',
            visualizationType: 'chart' as const,
            chartType: 'donut' as const,
          },
          {
            rowVars: [id('consider_atlas')],
            weightVar: wt,
            title: 'Consideration climbed 5pts to 38% of the market, tracking the awareness gain',
            visualizationType: 'chart' as const,
            chartType: 'horizontal-bar' as const,
          },
        ],
      },
      {
        title: 'Segment differences',
        slides: [
          {
            rowVars: [id('unaided_any_atlas')],
            colVar: id('segment'),
            weightVar: wt,
            title: "Atlas's awareness gain is concentrated in the Growth segment, up 13pts to 46%",
            visualizationType: 'chart' as const,
            chartType: 'grouped-bar' as const,
          },
        ],
      },
    ],
  };

  const deck = unwrap(await engine.buildDeck(deckSpec), 'buildDeck W4');
  if (deck.errors.length > 0) throw new Error(`Deck built with ${deck.errors.length} slide errors`);
  unwrap(engine.commitDeck(deck), 'commitDeck W4');
  const savedSlides: Slide[] = unwrap(engine.getSession(), 'getSession').slides ?? [];
  console.log(`  ✓ Committed ${savedSlides.length} saved slide recipes (all reference shipped variables).`);

  const w4Metrics = await measureActiveWave(engine);
  console.log(
    `  W4 weighted: unaided=${w4Metrics.unaidedOverall.toFixed(1)}%  aided=${w4Metrics.aidedOverall.toFixed(1)}%  ` +
      `considerT2B=${w4Metrics.considerT2BOverall.toFixed(1)}%  Growth-unaided=${w4Metrics.unaidedGrowth.toFixed(1)}%`,
  );

  // ── Step 2: Import Wave 5 (the next-quarter refresh wave) ─────────────────
  section('STEP 2 · Import Wave 5 refresh wave');
  unwrap(await engine.loadFile(W5), 'loadFile W5');
  unwrap(engine.setWeight(id('wt')), 'setWeight W5');
  const w5Desc = unwrap(engine.describe(), 'describe W5');
  const w5Vars: Variable[] = w5Desc.dataset!.variables;
  const w5VarSets: VariableSet[] = w5Desc.variableSets;
  console.log(`  ✓ Wave 5 loaded: ${w5Vars.length} variables, ${w5VarSets.length} variable sets.`);

  // ── Step 3: Dataset-replacement review on the saved slide recipes ─────────
  section('STEP 3 · Dataset-replacement review (assessDatasetReplacement)');
  const review = assessDatasetReplacement(savedSlides, w5VarSets, w5Vars);
  console.log(
    `  refreshMode="${REFRESH_MODE}"  slides=${review.totalSlides}  ready=${review.ready}  ` +
      `blocked=${review.blockedSlides}  issues=${review.issues.length}`,
  );
  for (const issue of review.issues) console.log(`    • [${issue.severity}] ${issue.message}`);
  if (!review.ready) {
    throw new Error('Wave-5 replacement review should be READY for shipped-variable recipes');
  }
  console.log('  ✓ All saved slide recipes resolve on Wave 5 — the deck can be refreshed in place.');

  // ── Step 4: wave_refresh — recompute titles, FLAG for confirmation ────────
  section('STEP 4 · wave_refresh: recompute action titles (flag for confirmation)');
  const w5Metrics = await measureActiveWave(engine);
  console.log(
    `  W5 weighted: unaided=${w5Metrics.unaidedOverall.toFixed(1)}%  aided=${w5Metrics.aidedOverall.toFixed(1)}%  ` +
      `considerT2B=${w5Metrics.considerT2BOverall.toFixed(1)}%  Growth-unaided=${w5Metrics.unaidedGrowth.toFixed(1)}%`,
  );

  const growthSig = (
    gt.deltas.w4_w5 as unknown as {
      segments_atlas_unaided_by_segment: Record<string, { significant_95: boolean }>;
    }
  ).segments_atlas_unaided_by_segment[String(GROWTH_SEGMENT_CODE)].significant_95;

  const recomputes = [
    {
      slide: 'The gain is at the top: unaided awareness…',
      ...refreshTitle(
        'Unaided awareness',
        w4Metrics.unaidedOverall,
        w5Metrics.unaidedOverall,
        w4w5.unaided_any.significant_95,
        true,
      ),
    },
    {
      slide: 'Atlas aided awareness rose 6pts…',
      ...refreshTitle('Aided awareness', w4Metrics.aidedOverall, w5Metrics.aidedOverall, w4w5.aided.significant_95, false),
    },
    {
      slide: 'Consideration climbed 5pts…',
      ...refreshTitle(
        'Consideration (T2B)',
        w4Metrics.considerT2BOverall,
        w5Metrics.considerT2BOverall,
        w4w5.consider_t2b_of_total.significant_95,
        false,
      ),
    },
    {
      slide: "Atlas's awareness gain is concentrated in Growth…",
      ...refreshTitle(
        'Growth-segment unaided awareness',
        w4Metrics.unaidedGrowth,
        w5Metrics.unaidedGrowth,
        growthSig,
        false,
      ),
    },
  ];

  console.log('  Recomputed titles (NOT applied — queued for human confirmation, per 08 §4):');
  for (const r of recomputes) {
    const verdict = r.significant ? 'significant' : 'not significant';
    console.log(`    • ${r.slide}`);
    console.log(
      `        W4 ${r.before.toFixed(1)}% → W5 ${r.after.toFixed(1)}%  (Δ ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}pts, ${verdict})`,
    );
    console.log(`        proposed W5 title: "${r.recomputed}"   [confirm before publishing]`);
    if (r.demotionCandidate) console.log('        ⤵ demotion candidate (was a headline mover, now flat)');
  }

  // ── Step 5: Flat-mover demotion ───────────────────────────────────────────
  section('STEP 5 · Flat-mover demotion candidate');
  const unaidedDemoted = !w4w5.unaided_any.significant_95;
  console.log(
    `  Unaided awareness: significant headline mover W3→W4, but W4→W5 Δ=${w4w5.unaided_any.delta_pts.toFixed(1)}pts, ` +
      `significant_95=${w4w5.unaided_any.significant_95}.`,
  );
  if (unaidedDemoted) {
    console.log('  ✓ DEMOTION CANDIDATE: the unaided-awareness headline flattens on Wave 5 → demote toward appendix.');
    console.log('    Growth-segment story consolidates, so the segment slide is retained as the live headline.');
  } else {
    throw new Error('Expected the unaided-awareness mover to flatten W4->W5 (demotion candidate)');
  }

  // ── Step 6: RECIPE-REPLAY limitation (derived nets do NOT survive) ────────
  section('STEP 6 · RECIPE-REPLAY limitation (derived nets block replacement)');
  // A slide whose recipe references a recipe-derived net (e.g. consider_atlas_t2b,
  // produced by a recode) does not resolve on a freshly ingested Wave 5, because
  // recode transforms are not replayed across datasets.
  const derivedSlide: Slide = {
    ...savedSlides[0],
    id: 'derived-net-slide',
    title: 'Atlas consideration (T2B net) by segment',
    analysisState: {
      rowVars: ['consider_atlas_t2b'],
      colVar: id('segment'),
      filters: [],
      weightVar: id('wt'),
    },
  };
  const derivedReview = assessDatasetReplacement([derivedSlide], w5VarSets, w5Vars);
  console.log(
    `  Derived-net slide review: ready=${derivedReview.ready}  blocked=${derivedReview.blockedSlides}  ` +
      `missing=${derivedReview.missingReferenceIds.join(', ') || 'none'}`,
  );
  if (!derivedReview.ready) {
    logGap(
      'INF-04',
      'recipe-derived nets (recode targets like consider_atlas_t2b) do NOT survive dataset replacement — ' +
        'the wave refresh re-runs on shipped variables only; replaying recodes across waves is RECIPE-REPLAY ' +
        '(do not build the replay engine in this workstream).',
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section('GAP LOG (internal signals — NOT external pilot evidence)');
  for (const g of gapSignals) console.log(`  ${g}`);

  section('COMPLETE');
  console.log('  Wave refresh: Wave-5 review READY, titles recomputed + flagged for confirmation,');
  console.log('  flat mover demoted, RECIPE-REPLAY limitation logged. Zero new engine surface.\n');

  await engine.close();
}

main().catch((err) => {
  console.error('\n✗ Brand tracker wave-refresh demo failed:', err);
  process.exit(1);
});
