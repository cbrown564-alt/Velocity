/**
 * Brand Tracker Demo: SAV-to-deck flow on brandtracker_w4.sav
 *
 * Phase C of the Brand Tracker Demo plan
 * (docs/workstreams/deck_native/10_brand_tracker_demo_plan.md §5).
 *
 * Simulates the MCP-connected agent readout an analyst would drive:
 *   1. Load the analysis-ready Wave 4 tracker file
 *   2. Set the sampling weight (wt — the real rim weight, not a body-weight trap)
 *   3. Build the ~18-slide tracker deck per the story template
 *      (docs/workstreams/deck_native/08_brand_tracker_story_template.md §3)
 *   4. Export the PPTX golden artifact (tests/fixtures/export/brandtracker-report.pptx)
 *   5. Commit the deck to the session
 *
 * Action titles carry the planted-story numbers from
 * validation/brand_tracker_ground_truth.json — significant movers stated with
 * direction + magnitude, non-significant movers ("worth the price") titled
 * "broadly stable", and the low-base Atlas NPS caveat surfaced in the appendix.
 * Every exhibit is a weighted crosstab on the loaded wave; the wave-over-wave
 * comparator and significance verdict live in each slide subtitle (an on-slide
 * base/source note) and speaker notes, reproducible from the appendix + recipe.
 *
 * Run: npx tsx scripts/brand-tracker-demo.ts   (exit 0 on success)
 */

import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VelocityEngine } from '../src/engine/VelocityEngine.js';
import type { DeckSpec, SlideSpec } from '../src/engine/types.js';
import type { Variable } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../public/examples');
const OUT_PPTX = path.resolve(__dirname, '../tests/fixtures/export/brandtracker-report.pptx');
const DATASET = 'brandtracker_w4.sav';

const SOURCE_NOTE = 'Source: brandtracker_w4.sav · Wave 4 (2026-Q2) · n=1,200 · weighted (rim weight wt).';

function section(title: string) {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(64));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   VELOCITY AGENT — brand tracker Wave 4 deck readout   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ── Step 1: Boot engine ─────────────────────────────────────────────────
  section('STEP 1 · Boot engine (node runtime)');
  const engine = await VelocityEngine.create({ runtime: 'node', dataDir: DATA_DIR });
  console.log('  Engine online.');

  // ── Step 2: Load the analysis-ready Wave 4 file ─────────────────────────
  section(`STEP 2 · Load ${DATASET}`);
  const loadResult = await engine.loadFile(DATASET);
  if (loadResult.error) throw new Error(`Load failed: ${loadResult.error.message}`);
  console.log(`  ✓ Loaded in ${loadResult.durationMs}ms`);

  const vars = engine.describe().data.dataset!.variables;
  console.log(`  ${vars.length} variables loaded`);

  const byName = new Map(vars.map((v) => [v.name.toLowerCase(), v]));
  const need = (name: string): Variable => {
    const v = byName.get(name.toLowerCase());
    if (!v) throw new Error(`Expected variable "${name}" not found in ${DATASET}`);
    return v;
  };
  const id = (name: string) => need(name).id;

  // ── Step 3: Set the sampling weight (the real rim weight) ───────────────
  section('STEP 3 · Set weight variable (wt)');
  const weightResult = engine.setWeight(id('wt'));
  if (weightResult.error) throw new Error(`setWeight failed: ${weightResult.error.message}`);
  console.log('  ✓ Weight set to wt (rim weight, age × gender × region).');

  // ── Step 3b: Derive attribute Top-2-Box nets (recipe step 6) ────────────
  // The attribute battery ships as an ordered 1–5 scale with a DK=98 code, which
  // renders as a 1..98 gap-filled axis. Derive a clean agree/below net via the
  // shipped recode primitive so the driver slides show a legible top-two-box.
  section('STEP 3b · Derive attribute Top-2-Box nets (recode)');
  const T2B = 'Agree (top-two-box)';
  const BELOW = 'Below top-two-box';
  const DK = 'Don’t know';
  const t2bMappings = { '4': T2B, '5': T2B, '1': BELOW, '2': BELOW, '3': BELOW, '98': DK };
  const attT2B: Record<string, string> = {};
  for (const [attr, label] of [
    ['att_innov_atlas', 'Atlas “is innovative” — top-two-box'],
    ['att_worth_atlas', 'Atlas “is worth the price” — top-two-box'],
  ] as const) {
    const newId = `${attr}_t2b`;
    const res = await engine.recode(id(attr), {
      mode: 'categorical',
      mappings: t2bMappings,
      targetVariableName: newId,
      label,
    });
    if (res.error) throw new Error(`recode ${attr} failed: ${res.error.message}`);
    attT2B[attr] = res.data!.id;
    console.log(`  ✓ Derived ${newId} (top-two-box net) from ${attr}.`);
  }
  const excludeDk = (varId: string) => [
    { id: `no-dk-${varId}`, variableId: varId, operator: 'neq' as const, value: DK },
  ];

  // ── Step 4: Compose the deck spec (story template §3) ───────────────────
  section('STEP 4 · Compose deck spec (~18 slides)');

  const finding = (spec: Omit<SlideSpec, 'subtitle'> & { subtitle?: string }): SlideSpec => ({
    displayOptions: { showPercents: true },
    subtitle: SOURCE_NOTE,
    ...spec,
  });

  const deckSpec: DeckSpec = {
    title: 'Atlas Chilled-Coffee Brand Tracker — Wave 4 Client Readout',
    subtitle: 'Synthetic demo dataset, designed to exercise the significance guardrails.',
    sections: [
      // 0 · Title + context ------------------------------------------------
      {
        title: 'Context',
        slides: [
          finding({
            rowVars: [id('segment')],
            title: 'Atlas chilled-coffee brand tracker: Wave 4 readout (2026-Q2, n=1,200, weighted)',
            subtitle:
              'Fieldwork 13–26 Apr 2026 · category buyers, past 3 months · rim-weighted to national age × gender × region.',
            chartType: 'donut',
            notes:
              'Standing client question: is Atlas getting healthier, and what is moving it? Base: all category buyers (n=1,200), weighted to national profile (design effect ≈ 1.12). Brands shown: Atlas (client), Beacon, Meridian, Solstice, Cardinal.',
          }),
        ],
      },
      // 1 · Executive summary (SCR) ---------------------------------------
      {
        title: 'Executive summary',
        slides: [
          finding({
            rowVars: [id('brand_pref')],
            title: 'Atlas health is up and top-of-funnel; Beacon now leads Meridian on consideration',
            chartType: 'horizontal-bar',
            notes:
              'SCR. Situation: Atlas entered Q2 as the category #3, health flat across three waves. Complication: this wave unaided awareness jumped and Beacon overtook the legacy leader on consideration. Resolution: the gain is real and at the top of the funnel — the play is converting Growth-segment awareness, not more reach.\n\nTakeaways: (1) Aided awareness +6pts to 73%, first significant gain in four waves. (2) The gain is top-of-funnel: unaided +6pts, conversion flat. (3) Beacon overtook Meridian on consideration for the first time in four waves. (4) The awareness gain concentrates in the Growth segment (+13pts) and under-35s.',
          }),
        ],
      },
      // 2 · Brand health headline -----------------------------------------
      {
        title: 'Brand health',
        slides: [
          finding({
            rowVars: [id('aware_atlas')],
            title: 'Atlas aided awareness rose 6pts to 73%, its first significant gain in four waves',
            subtitle: `${SOURCE_NOTE} vs 67% in W3 (2026-Q1); +5.9pts, significant at 95%.`,
            chartType: 'donut',
            notes:
              'Aided awareness 72.7% (W4) vs 66.8% (W3), +5.9pts, z=2.96, p=0.003 — significant. The composite brand-health index (aided awareness, consideration T2B, P3M usage) rose 4.3pts to 42 over the same period (p=0.003), reversing three broadly flat waves.',
          }),
          finding({
            rowVars: [id('consider_atlas')],
            title: 'Consideration climbed 5pts to 38% of the market, tracking the awareness gain',
            subtitle: `${SOURCE_NOTE} Top-two-box vs 33% in W3; +4.5pts, significant at 95%.`,
            chartType: 'horizontal-bar',
            notes:
              'Consideration top-two-box (of total base) 37.7% (W4) vs 33.2% (W3), +4.5pts, z=2.18, p=0.029 — significant. Moves in step with the awareness gain rather than ahead of it.',
          }),
        ],
      },
      // 3 · The funnel ----------------------------------------------------
      {
        title: 'The funnel',
        slides: [
          finding({
            rowVars: [id('unaided_any_atlas')],
            title: 'The gain is at the top: unaided awareness jumped 6pts to 37%',
            subtitle: `${SOURCE_NOTE} vs 31% in W3; +5.7pts, significant at 95%.`,
            chartType: 'horizontal-bar',
            notes:
              'Unaided (any-mention) awareness 36.5% (W4) vs 30.8% (W3), +5.7pts, z=2.81, p=0.005 — significant. This is the biggest funnel mover and locates the story at the top of the funnel.',
          }),
          finding({
            rowVars: [id('consider_atlas')],
            title: 'Awareness-to-consideration conversion held flat near 53%, so the lift is reach not persuasion',
            subtitle: `${SOURCE_NOTE} Conversion among aware: 53% vs 51% in W3; change not significant.`,
            chartType: 'horizontal-bar',
            notes:
              'Awareness→consideration conversion 53.1% (W4) vs 51.1% (W3), +2.0pts, z=0.77, p=0.44 — not significant. Consideration grew because more people are aware, not because aware buyers are converting better.',
          }),
          finding({
            rowVars: [id('used_p3m_atlas')],
            title: 'Usage is broadly stable at 15%, so the new interest has yet to reach trial',
            subtitle: `${SOURCE_NOTE} vs 12% in W3; +2.4pts, within margin of error.`,
            chartType: 'horizontal-bar',
            notes:
              'Past-3-month usage 14.9% (W4) vs 12.4% (W3), +2.4pts, z=1.64, p=0.10 — not significant. Stated as "broadly stable": the upper-funnel gain has not yet converted to trial.',
          }),
        ],
      },
      // 4 · Competitive position ------------------------------------------
      {
        title: 'Competitive position',
        slides: [
          finding({
            rowVars: [id('consider_beacon')],
            title: 'Beacon overtook Meridian on consideration for the first time in four waves, at 42%',
            subtitle: `${SOURCE_NOTE} Beacon 42% vs Meridian 39% consideration T2B; Meridian led W1–W3.`,
            chartType: 'horizontal-bar',
            notes:
              'Beacon consideration T2B (of total) 41.7% vs Meridian 38.5% in W4. Across the history Meridian led (W1 41.6 vs 32.7; W3 40.8 vs 35.6); W4 is the first wave Beacon leads. Beacon is now the challenger to watch.',
          }),
          finding({
            rowVars: [id('brand_pref')],
            title: 'Beacon and Meridian lead preference near 25%, with Atlas third at 20%',
            subtitle: SOURCE_NOTE,
            chartType: 'horizontal-bar',
            notes:
              'Weighted first-choice preference: Meridian 24.9%, Beacon 24.8%, Atlas 19.5%, Solstice 8.4%, Cardinal 6.1%. Preference movement this wave is within margin of error; the competitive story is consideration, not preference.',
          }),
        ],
      },
      // 5 · Drivers / why -------------------------------------------------
      {
        title: 'Drivers',
        slides: [
          finding({
            rowVars: [attT2B['att_innov_atlas']],
            filters: excludeDk(attT2B['att_innov_atlas']),
            title: "'Innovative' associations rose 7pts to 37%, likely fuelling Atlas's awareness gain",
            subtitle: `${SOURCE_NOTE} Agree (T2B) vs 30% in W3; +6.7pts, significant at 95%.`,
            chartType: 'horizontal-bar',
            notes:
              '"Is innovative" agreement (T2B, of answering) 37.0% (W4) vs 30.4% (W3), +6.7pts, z=2.70, p=0.007 — significant, and the only attribute that moved. Tracks the awareness gain; stated as a likely driver (correlation, not proven causation). Top-two-box net derived via recode from the 1–5 scale (DK excluded).',
          }),
          finding({
            rowVars: [attT2B['att_worth_atlas']],
            filters: excludeDk(attT2B['att_worth_atlas']),
            title: "'Worth the price' is broadly stable at 35%, within margin of error versus Q1",
            subtitle: `${SOURCE_NOTE} Agree (T2B) vs 37% in W3; −1.9pts, not significant.`,
            chartType: 'horizontal-bar',
            notes:
              'Defensibility guard. "Is worth the price" agreement 35.3% (W4) vs 37.2% (W3), −1.9pts, z=−0.74, p=0.46 — not significant. Titled "broadly stable" to avoid claiming a decline the test does not support. Top-two-box net derived via recode from the 1–5 scale (DK excluded).',
          }),
          finding({
            rowVars: [id('adrecall_atlas')],
            title: 'Ad recall jumped 7pts to 26%, consistent with the awareness and innovation gains',
            subtitle: `${SOURCE_NOTE} vs 19% in W3; +7.4pts, significant at 95%.`,
            chartType: 'donut',
            notes:
              'Advertising recall 26.4% (W4) vs 19.0% (W3), +7.4pts, z=4.06, p<0.001 — significant. Consistent with media activity behind the awareness and "innovative" gains.',
          }),
        ],
      },
      // 6 · Segment differences (only where the action changes) -----------
      {
        title: 'Segment differences',
        slides: [
          finding({
            rowVars: [id('unaided_any_atlas')],
            colVar: id('segment'),
            title: "Atlas's awareness gain is concentrated in the Growth segment, up 13pts to 46%",
            subtitle: `${SOURCE_NOTE} Growth +13.4pts (significant); Core and Value flat.`,
            chartType: 'grouped-bar',
            displayOptions: { showPercents: true, showSignificance: true },
            notes:
              'Unaided awareness by attitudinal segment: Growth 46.2% (from 32.8%, +13.4pts, p<0.001) — the only significant segment divergence. Core 32.2% (+0.4, n.s.) and Value 27.7% (+1.4, n.s.) are flat. This is the one segment cut that changes the recommended action.',
          }),
          finding({
            rowVars: [id('unaided_any_atlas')],
            colVar: id('age_band'),
            title: 'Under-35s drove the gain, up 9pts to 42%; older buyers held steady',
            subtitle: `${SOURCE_NOTE} 18–34 +8.9pts (significant); 35–54 and 55+ not significant.`,
            chartType: 'grouped-bar',
            displayOptions: { showPercents: true, showSignificance: true },
            notes:
              'Unaided awareness by age band: 18–34 42.0% (from 33.1%, +8.9pts, p=0.006) — significant. 35–54 36.1% (+5.1, p=0.10) and 55+ 31.9% (+3.5, n.s.) held steady. The gain skews young, aligning with the Growth-segment story.',
          }),
        ],
      },
      // 7 · Implications / recommendations (evidence-separated) -----------
      {
        title: 'Recommendations',
        slides: [
          finding({
            rowVars: [id('consider_atlas')],
            colVar: id('segment'),
            title: "Convert Growth's new awareness: shift Q3 activation and trial offers to under-35s",
            subtitle: 'Recommendation — supported by the funnel (flat conversion) and segment slides.',
            chartType: 'grouped-bar',
            notes:
              'Human-authored. Ties to: (a) top-of-funnel gain with flat conversion (funnel section) and (b) the Growth / under-35 awareness divergence (segment section). Action: move Q3 spend from reach to conversion — sampling, trial offers, and activation targeting Growth-segment under-35s. Recommendation is flagged for human confirmation, not auto-generated.',
          }),
        ],
      },
      // 8 · Appendix ------------------------------------------------------
      {
        title: 'Appendix',
        slides: [
          finding({
            rowVars: [id('consider_atlas')],
            title: 'Appendix: Atlas consideration distribution and top-two-box base, Wave 4',
            subtitle: SOURCE_NOTE,
            visualizationType: 'table',
            displayOptions: { showPercents: true, showCounts: true },
            notes:
              'Full consideration scale distribution (weighted % and counts). Top-two-box (codes 4–5) = 37.7% of total base; DK (98) and structural missing excluded from the "of answering" conversion metric.',
          }),
          finding({
            rowVars: [id('nps_atlas')],
            title: 'Appendix: Atlas NPS rose to +7 on a low base (n=189 users) — read directionally',
            subtitle: `${SOURCE_NOTE} Asked of Atlas past-3-month users only; unweighted base n=189.`,
            chartType: 'horizontal-bar',
            notes:
              'Caveat / low-base flag. Atlas NPS +7 (W4) vs −2 (W3), +9.7pts, z=1.15, p=0.25 — not significant on n≈189 users. Directional only; do not report as a confirmed improvement. (NPS score = %promoters 9–10 minus %detractors 0–6.)',
          }),
          finding({
            rowVars: [id('age_band')],
            title: 'Appendix: method, weighting, and the raw-to-analysis-ready transformation recipe',
            subtitle: `${SOURCE_NOTE} Weighted to national age × gender × region; design effect ≈ 1.12.`,
            visualizationType: 'table',
            displayOptions: { showPercents: true, showCounts: true },
            notes:
              'Method. Weighting: rim weight (age band × gender × region) to national margins; mean weight ≈ 1.0, design effect ≈ 1.12; significance = two-proportion z-test on Kish effective bases (α=0.05). Recipe (raw agency wave → analysis-ready): 1) load raw wave alongside W1–W3; 2) identify the true weight (rim_wt_final, not the body-weight decoy); 3) map renamed attribute variables (att_value_* → att_worth_*); 4) fix the reversed consideration scale; 5) derive age_band (18–34/35–54/55+); 6) derive consideration T2B; 7) derive NPS classes; 8) run weighted crosstabs with significance; 9) build/export/commit deck and export session; 10) next quarter, swap in wave 5 via the saved slide recipes. Synthetic dataset, designed to exercise the significance guardrails.',
          }),
        ],
      },
    ],
  };

  const slideCount = deckSpec.sections.reduce((n, s) => n + s.slides.length, 0);
  console.log(`  Composed ${deckSpec.sections.length} sections, ${slideCount} slides.`);

  // ── Step 5: Build the deck ──────────────────────────────────────────────
  section('STEP 5 · Build deck');
  const deckResult = await engine.buildDeck(deckSpec);
  if (deckResult.error) throw new Error(`Deck build error: ${deckResult.error.message}`);
  const deck = deckResult.data!;
  console.log(`  Deck built: "${deck.spec.title}"`);
  console.log(
    `  Slides built: ${deck.slides.length} · Build errors: ${deck.errors.length} · ${Math.round(deck.buildDurationMs)}ms`,
  );
  if (deck.errors.length > 0) {
    for (const err of deck.errors) console.log(`  ⚠ Slide ${err.slideIndex}: ${err.error.message}`);
    throw new Error(`Deck built with ${deck.errors.length} slide error(s); see above.`);
  }
  for (const [i, slide] of deck.slides.entries()) {
    const rows = slide.processed?.rows?.length ?? 0;
    console.log(
      `  ✓ [${String(i + 1).padStart(2, '0')}] ${slide.resolvedTitle}  (${rows} rows, ${slide.resolvedChartType ?? slide.spec.visualizationType ?? 'table'})`,
    );
  }

  // ── Step 6: Export deck → PPTX golden artifact ──────────────────────────
  section('STEP 6 · Export deck → PPTX');
  const exportResult = await engine.exportDeck(deck, { format: 'pptx' });
  if (exportResult.error) throw new Error(`Export error: ${exportResult.error.message}`);
  const bytes = exportResult.data!;
  writeFileSync(OUT_PPTX, bytes);
  console.log(`  ✓ PPTX written: ${OUT_PPTX}`);
  console.log(
    `  File size: ${(bytes.byteLength / 1024).toFixed(1)} KB · ${deck.slides.length} slides · ${exportResult.durationMs?.toFixed(0)}ms`,
  );

  // ── Step 7: Commit deck to session ──────────────────────────────────────
  section('STEP 7 · Commit deck to session');
  const commitResult = engine.commitDeck(deck);
  if (commitResult.error) throw new Error(`Commit error: ${commitResult.error.message}`);
  const sessionSlides = engine.getSession().data.slides?.length ?? 0;
  console.log(`  ✓ Deck committed to session (${sessionSlides} slides in session state).`);

  section('COMPLETE');
  console.log('\n  Brand tracker Wave 4 deck built, exported, and committed.\n');

  await engine.close();
}

main().catch((err) => {
  console.error('\n✗ Brand tracker demo failed:', err);
  process.exit(1);
});
