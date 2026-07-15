# Brand Tracker Demo: Dataset, Recipe, and Deck Implementation Plan

**Status:** Adopted — Phases A–D complete (2026-07-03)
**Date:** 2026-07-03
**Workstream:** Deck-native SAV-to-deck experience
**Supports:** `07_report_quality_experience_plan_v2.md` §4 (north-star exemplar), §10 (fixtures card); `08_brand_tracker_story_template.md` (narrative contract); `09_action_title_eval_rubric.md` (scoring); PILOT-5 (bounded "tracker update" outcome); PILOT-6 (demo asset for paid-pilot recruiting).

> **Purpose.** `sleep.sav` is a serviceable backup demo (small, clean, committed at `public/examples/sleep.sav`), but it is the wrong archetype: a one-off clinical teaching dataset with no waves, no brands, no funnel, and no sampling weight. The pilot wedge is *tracker updates for boutique agencies*. This plan replaces the demo centerpiece with a purpose-built **multi-wave brand tracker**: the dataset, a fully specified **transformation recipe** from raw wave to analysis-ready file, and a **complete PowerPoint deck** conforming to the story template — closing the loop the north-star exemplar card in `07_..._v2.md` §10 has been waiting on.

---

## 1. Key decision: generate the data ourselves (grounded in public norms)

**Decision: generate synthetic data.** We surveyed candidate public sources (July 2026) and none survives the three hard requirements below. We de-risk the "synthetic data looks fake" failure mode by calibrating distributions against openly licensed reference data, not by sourcing microdata.

### 1.1 Hard requirements any source must meet

1. **Redistributable.** The demo file must be committed at `public/examples/` and fetched by the browser "Load Example" flow (`src/features/workspace/hooks/useFileUpload.ts`), shipped in the pilot build, and frozen in eval artifacts. Anything license-gated is disqualified outright.
2. **Tracker-shaped.** Respondent-level microdata; 3+ comparable waves; brand funnel (unaided/aided awareness → consideration → usage → preference → advocacy); named competitor set within one category; attribute battery (grid); demographic banner; sampling weight. This is the `Report Job` contract in `08_brand_tracker_story_template.md` §5.
3. **Story-controllable.** The demo must land the SCR narrative deterministically: a headline mover, a segment divergence that survives significance testing, a competitor rank change "for the first time in N waves," and at least one within-margin-of-error movement to exercise the "broadly stable" defensibility guard. Found data cannot guarantee any of this; a scripted demo that hunts for a story live is a liability.

### 1.2 Candidate sources evaluated and why each fails

| Source | What it is | License | Fails on |
| :--- | :--- | :--- | :--- |
| **BRAND** (Brand Recognition and Attitude Norms Database, City/Springer 2024, researchbox.org/1892) | Familiarity/liking/memory responses for ~597 real brands from 2,000 US consumers, 2020 + 2024 | CC-BY 4.0 (redistributable) | Structure: norms study, not a tracker. No funnel beyond awareness/attitude, no within-category competitor framing, no demographic banner depth, no weight, two "waves" four years apart with different brand lists. Real trademarks in a product demo are also a liability. |
| **UKDS Consumer Insights Tracker** (Food Standards Agency, SN 9457) | Genuine 12-wave monthly tracker, ~2,000/wave | UKDS End User Licence | License: EUL clause 4 explicitly forbids giving access to the data or derived datasets to non-registered users — cannot be bundled, cannot even ship a derived file. Also food-safety attitudes, not brand health. |
| **European CBBE study** (ReShare 852371, .sav available) | One-off consumer-based brand equity survey, ~1,800 respondents, 3 countries | Safeguarded / EUL terms | License (no redistribution); single wave; no funnel or tracker mechanics. |
| **BSA / ELSA / WVS** (already in `test_data/`) | Social attitude waves we use for harmonization evals | UKDS EUL (gitignored for this reason) | Not brand data; same redistribution bar — note we already treat these as local-only, which is exactly the constraint the demo cannot live with. |
| **Commercial trackers** (YouGov BrandIndex, Kantar) | The real thing | Paid, proprietary | Categorically non-redistributable. |

**Conclusion:** respondent-level brand tracker microdata is precisely the asset agencies sell; nobody reputable open-licenses it. The precedent inside this repo confirms the pattern — every redistributable fixture we have is either tiny-synthetic (`test_small.sav`, `brand_tracker_wave_*.csv`) or an old teaching file (`sleep.sav`, `bsa93.sav`).

### 1.3 The hybrid: synthetic microdata, public calibration

Generate, but anchor realism to openly licensed references so reviewers with tracker experience don't smell fakeness:

- **Metric levels and spreads:** BRAND (CC-BY) gives realistic familiarity/liking distributions for consumer brands by industry tier — use as calibration targets for awareness/consideration levels (leader ~90% aided awareness, challenger ~60%, insurgent ~25%).
- **Demographic margins:** ONS/Census-style age × gender × region margins as raking targets, so the shipped weight variable is a real rim weight with a defensible story ("weighted to national profile"), average weight ≈ 1.0, design effect ~1.1–1.3.
- **Design craft targets:** the exemplar references already committed (`demo/artifacts/report-quality/exemplars/EXEMPLAR_SOURCES.md` — Pew 2025, Kantar BrandZ curated slides) stay the visual/narrative bar; they are not data sources.
- **Fictional brands:** keep the **Atlas / Beacon** universe from `brand_tracker_north_star_candidate.md` for continuity, extend to a 5-brand category set. No real trademarks anywhere in data, labels, or deck.

---

## 2. Dataset specification

### 2.1 Shape

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| Category | Fictional ready-to-drink coffee ("chilled coffee") market, one country | Universally legible in a demo; supports imagery battery; no domain expertise needed to follow the story |
| Brands | **Atlas** (client), **Beacon** (challenger), **Meridian** (legacy leader), **Solstice** (insurgent), **Cardinal** (niche) | 5 brands: enough for competitive slides, small enough for readable grids |
| Waves | **4 committed waves** (2025-Q3 … 2026-Q2) + **1 refresh wave** (2026-Q3) | 4 waves enables "first time in N waves" phrasing (`08_...` §5); wave 5 exists solely to demo dataset replacement / wave refresh |
| Sample | n = 1,200 per wave (independent samples) | Big enough for significant subgroup movement at realistic effect sizes; total ~6,000 rows keeps each .sav well under 1 MB |
| Variables | ~70 per wave | Comparable to sleep.sav in navigability, but tracker-shaped |

### 2.2 Variable map (one wave)

| Block | Variables | Notes |
| :--- | :--- | :--- |
| Admin | `resp_id`, `wave`, `int_date` | `wave` labelled ("2026-Q2 (W4)") |
| Screener | `cat_buyer` (past-3-month category buyer) | Everyone qualifies (base definition lives in labels) |
| Demographics | `age` (numeric) , `age_band` (derived, see recipe), `gender`, `region` (4), `income_band` (5), `urbanicity` | Banner variables per `08_...` §6 |
| Segments | `segment` (Core / Growth / Value — attitudinal segment, pre-coded) | Continuity with existing CSV fixtures and north-star candidate |
| Unaided awareness | `unaided_first` (first mention, coded), `unaided_any_atlas` … `unaided_any_cardinal` (0/1 flags) | Dual-state codes + labels throughout |
| Aided awareness | `aware_atlas` … `aware_cardinal` (0/1) | Funnel stage 1 |
| Consideration | `consider_atlas` … `consider_cardinal` (5-pt scale) | T2B convention documented in labels |
| Usage | `used_p3m_atlas` … (0/1) | Funnel stage 3 |
| Preference | `brand_pref` (single code, 5 brands + none) | Funnel stage 4 |
| Advocacy | `nps_atlas` (0–10; asked of Atlas users only → structural missing) | Exercises low-base flagging |
| Attribute battery | `att_<attribute>_<brand>` grid: 8 attributes × 5 brands (agree/disagree 5-pt) | Attributes: tastes great, worth the price, innovative, for someone like me, widely available, premium, trustworthy, sustainable. Declared as a Variable Set (grid) — feature-matrix KEEP |
| Ad recall | `adrecall_atlas` … (0/1) | Driver-section support |
| Weight | `wt` (rim weight, age × gender × region) | The **real sampling weight** — deliberately contrasts with sleep.sav's body-weight trap documented in `guide_agent_quickstart.md` |

Every categorical variable carries integer codes + value labels (dual-state invariant, `arch_02`), realistic DK/Refused codes (98/99) with missing declarations, and variable labels written the way agencies actually write them ("Q4a. Which of these brands…").

### 2.3 Planted storyline (the deterministic script)

Effects are injected as parameter shifts in the generator config, then verified against ground truth (§3.3). Target story, mapping 1:1 to `08_...` §3 sections:

1. **Headline:** Atlas brand health (composite of aided awareness, consideration T2B, usage) up ~4pts W3→W4 — significant at 95% on the weighted base.
2. **Funnel:** the gain is top-of-funnel — unaided awareness +6pts, conversion awareness→consideration flat. "The gain is at the top" title.
3. **Competitive:** Beacon overtakes Meridian on consideration for the first time in the 4-wave history (rank-change slide).
4. **Drivers:** Atlas "innovative" association +7pts (significant), tracks the awareness gain; "worth the price" −2pts (within margin → must be titled "broadly stable" — the defensibility guard exercise).
5. **Segments:** the awareness gain concentrates in the **Growth** segment and under-35s; Core flat. Exactly one significant segment divergence, so the §6 "only where it changes the action" rule has one right answer.
6. **Caveat:** Atlas NPS improves but on n≈180 users → low-base flag must appear.
7. **Wave 5 (refresh):** the Growth-segment gain consolidates; one previously significant mover goes flat — so the wave-refresh demo shows both a recomputed title and an auto-demotion candidate.

### 2.4 Deliberate imperfections (what makes the recipe worth demoing)

The committed *analysis-ready* waves are clean. We additionally generate **one "raw agency file"** variant of wave 4 (`brandtracker_w4_raw.sav`, local or committed depending on size) containing the realistic mess the transformation recipe repairs:

- `age` numeric only — no bands (recipe step: bin).
- Consideration scale reversed vs. waves 1–3 label order (recipe step: recode; harmonization value-mapping demo).
- Two attribute variables renamed between waves (`att_value_*` → `att_worth_*`) — harmonization variable-mapping demo (Jaro-Winkler engine already shipped).
- Weight present but named `rim_wt_final` with a poor label — weight-discovery demo.
- A junk `body_weight_kg`-style decoy column — mirrors the sleep.sav false-positive lesson intentionally.

---

## 3. Generation infrastructure

### 3.1 Generator

New script `scripts/python/generate_brand_tracker.py` (pandas + pyreadstat, same stack as `generate_sav.py` / `generate_large_sav.py`), plus a declarative config `scripts/python/brand_tracker_config.json`:

- **Config-driven:** brand set, wave list, base sizes, per-wave metric targets (the planted effects in §2.3), demographic margins, missing-data rates, seed. The story is data, not code — reviewers can audit the plant.
- **Deterministic:** fixed RNG seed; regeneration is byte-stable (modulo pyreadstat metadata timestamps — verify and document).
- **Respondent-level realism:** draw latent brand-affinity per respondent so funnel stages are properly nested (no one considers a brand they're unaware of), attribute ratings correlate with consideration, and NPS is asked only of users. Nested-funnel integrity is the #1 tell of lazy synthetic data.
- **Weighting:** IPF/rake each wave to the configured margins; write `wt`; emit achieved margins + design effect into the ground-truth file.
- **Outputs:** `brandtracker_w1.sav` … `brandtracker_w5.sav`, `brandtracker_w4_raw.sav`, and `brandtracker_ground_truth.json`.

### 3.2 Commit locations and size budget

| Artifact | Location | Committed? |
| :--- | :--- | :--- |
| `brandtracker_w4.sav` (current wave, the demo file) | `public/examples/` | Yes (est. < 400 KB) |
| Waves 1–3, wave 5, raw w4 | `test_data/fixtures/brand_tracker/` | Yes if total < ~2.5 MB (expected); `.gitignore` needs explicit allow-list entries mirroring the existing `sleep.sav` exception |
| Ground truth | `validation/brand_tracker_ground_truth.json` | Yes |
| Generator + config | `scripts/python/` | Yes; document in `scripts/python/README.md` |

### 3.3 Ground truth and validation gates

- Generator emits expected values for every number the deck will show: weighted funnel metrics per brand per wave, wave-over-wave deltas with significance verdicts, segment cuts, attribute deltas, achieved weighting margins.
- New golden test (pattern: `tests/golden/r_parity.test.ts`) asserts engine crosstabs on the committed .sav files reproduce ground truth. Optionally extend `validation/r/generate_ground_truth.R` for R parity on the weighted headline numbers — this upgrades the trust pack (`pilot_02_trust_pack.md`) from "parity on sleep/BSA" to "parity on the flagship demo."
- Retire the 12-row `demo/report-quality/fixtures/brand_tracker_wave_*.csv` files in favor of the .sav waves once the harness consumes them; update `report_quality_fixtures.json` (its `expectedDeckJobs` entry `brand-tracker-client-readout` is exactly the deck in §5).

---

## 4. Transformation recipe

Two constraints frame this section. First, **scope discipline:** the general recipe manager (`S5-PREP-1`) is Frozen and `PILOT-4b` is Blocked on discovery — this plan must not smuggle either in. Second, everything the demo recipe needs **already exists**: recode (`VelocityEngine.recode()` → `transformLog`, replayed on session import per `arch_07` §8.3), harmonization mappings (workspace tools), weight application, and saved slide recipes with dataset/wave replacement (PILOT-3, Done).

### 4.1 The demo recipe (raw wave 4 → analysis-ready → deck)

Documented as a numbered, reproducible sequence (in the demo script and speaker notes), executed via existing MCP tools:

| # | Step | Tool / mechanism | What it demonstrates |
| :--- | :--- | :--- | :--- |
| 1 | Load raw wave alongside waves 1–3 | `velocity_workspace_load` | Multi-dataset workspace, wave detection |
| 2 | Identify the true weight (`rim_wt_final`, not the decoy) | `velocity_describe` + semantic layer | Weight discovery guardrail |
| 3 | Map renamed attribute variables to prior waves | `velocity_workspace_propose_mappings` → `velocity_workspace_harmonize` | Fuzzy variable mapping (shipped engine) |
| 4 | Fix the reversed consideration scale | harmonization value mapping / `velocity_recode` | Dual-state value remap |
| 5 | Derive `age_band` (18–34 / 35–54 / 55+) | `velocity_recode` (binning) | `transformLog` append + replay |
| 6 | Derive consideration T2B per brand | `velocity_recode` (categorical: {4,5}→T2B) | Nets **within current recode capability** |
| 7 | Derive NPS classes (promoter/passive/detractor) | `velocity_recode` (binning 0–6/7–8/9–10) | Same |
| 8 | Run the analysis set (funnel, competitive, drivers, segments) | `velocity_crosstab` weighted, significance on | Stats engine on a real tracker shape |
| 9 | Build + export deck; commit deck; export session | `velocity_build_deck` → `velocity_export_deck` → `velocity_commit_deck` → `velocity_export_session` | The full SAV-to-deck loop; `.velocity` file replays steps 4–7 on reopen |
| 10 | Next quarter: swap in wave 5 | slide-recipe dataset replacement review (`assessDatasetReplacement`) + `wave_refresh` template mode | The tracker-update wedge, end to end |

### 4.2 Capability gaps this will surface (and how to handle them)

Building the recipe against the real engine is itself discovery. Expected friction, pre-classified:

| Likely gap | Disposition |
| :--- | :--- |
| NPS *score* (%promoters − %detractors) as a single displayed stat | Demo-around: show promoter/detractor shares. Log as internal signal (`NET-DERIVE`) in `pilot_04a` §7 — **not** external evidence, per that doc's working rule |
| Repeating steps 4–7 identically on wave 5 requires manual re-execution (no recipe replay across datasets) | This *is* `RECIPE-REPLAY` (INF-04). The demo makes the gap legible and gives PILOT-4a a concrete internal artifact; do not build the replay engine in this workstream |
| Funnel chart type (stage-to-stage) may not exist in `pptxExporter` chart set | Acceptable: paired bars per `08_...` §4 blueprint already specifies "paired bars or slope" |
| Banner (multi-break) tables across the segment set | Compose per-break crosstabs; log `BANNER-PLAN` signal if painful |

Anything requiring new engine surface goes through `docs/playbooks/engine_api_change.md` and gets its own tracker row; the default is **demo within current capability**.

---

## 5. The PowerPoint deck

### 5.1 Contract

The deck **is** `08_brand_tracker_story_template.md` §3 instantiated on this dataset — ~18 slides:

| Section | Slides | Content (from planted story §2.3) |
| :--- | :--- | :--- |
| 0 Title + context | 1 | Category, wave 4, fielding dates, n=1,200, weighted, method note |
| 1 Executive summary (SCR) | 1 | "Atlas's gain is real and top-of-funnel; Beacon is now the challenger to watch; the play is conversion in Growth" + 3–4 takeaways |
| 2 Brand health headline | 1–2 | Composite trend across 4 waves, Atlas vs. category, sig vs. prior wave |
| 3 Funnel | 2–3 | Funnel this wave vs. prior, biggest mover highlighted; conversion slide |
| 4 Competitive position | 2 | Beacon overtakes Meridian on consideration ("first time in four waves") |
| 5 Drivers | 2–3 | "Innovative" +7pts; "worth the price" **broadly stable** (the honesty slide); ad recall support |
| 6 Segment differences | 1–2 | Growth / under-35 divergence only (auto-demote everything else) |
| 7 Recommendations | 1 | Human-authored, each tied to a prior finding |
| 8 Appendix | 3+ | Full funnel table, question wording, bases, weighting scheme, significance settings, **the transformation recipe as a numbered method note** |

Every body slide gets an action title passing the `09_...` rubric gates; every exhibit carries base/source notes; built via `velocity_draft_deck_plan` → human-confirmed titles → `velocity_build_deck` → `velocity_export_deck`, following `scripts/agent-demo.ts` as the reference harness (new `scripts/brand-tracker-demo.ts`, emitting `tests/fixtures/export/brandtracker-report.pptx` as the golden artifact alongside `sleep-report.pptx`).

### 5.2 Exemplar promotion

This deck is the missing **north-star exemplar** deliverable (`07_..._v2.md` §10 "Assemble north-star exemplar", currently satisfied only by a markdown slide contract):

1. Generated deck + rendered slide PNGs land in `demo/artifacts/report-quality/exemplars/`.
2. Scored against the `08_...` §8 conformance checklist and `09_...` action-title rubric; run `scripts/report-quality/inspect-pptx.mjs` and `review-artifact.mjs`.
3. Human/consultant sign-off remains the promotion bar (per `brand_tracker_north_star_signoff.md`) — the agent-built deck is the *candidate*; sign-off converts it into the diff target.

### 5.3 Wave-refresh demonstration

The closing beat of the demo and the substance of PILOT-5's "tracker update" outcome: import wave 5, run the dataset-replacement review on the saved slide recipes, `wave_refresh` template mode, show recomputed direction/magnitude titles flagged for human confirmation (never silently rewritten, per `08_...` §4), and the flat mover demoting toward appendix.

---

## 6. Product and demo integration

| Surface | Change |
| :--- | :--- |
| Load Example | `useFileUpload.ts`: brand tracker becomes the primary example (`/examples/brandtracker_w4.sav`); **sleep.sav stays as secondary/backup** — it still anchors frozen EVAL-01/03/04 baselines and the R-parity suite, which must not be disturbed |
| First-run analysis | `autoFirstCrosstab.ts`: for the tracker file, default to a funnel-relevant cut (e.g. Atlas consideration T2B × segment) instead of sex × marital |
| Demo contracts | New `demo/contracts/` entries for tracker-load, recipe, deck-export, wave-refresh; extend e2e smoke (`tests/e2e/`) with a tracker-workflow spec |
| Trust pack | Add tracker ground-truth parity to `pilot_02_trust_pack.md` reproduce commands |
| Eval | Once the end-to-end run is clean (framework Pattern 7), freeze as **EVAL-07 (brand tracker wave readout + refresh)** under `evals/eval-07/` with brief, scorecard, gap review, `summary.json` — the first eval family aligned to the actual pilot archetype. Frozen EVAL-01…06 baselines untouched |

## 7. Sequencing

Phases are dependency-ordered; A and the rubric work of C parallelize.

- **Phase A — Dataset (foundation). ✅ Done (2026-07-03).** Generator + config + ground truth; commit waves; golden test green; `.gitignore` allow-list; `scripts/python/README.md` updated. *Gate: engine reproduces ground truth on all committed waves (T/L/U/G).*
  - Shipped: `scripts/python/generate_brand_tracker.py` + `brand_tracker_config.json` (deterministic, seed 20260703, storyline targets auditable in config); `public/examples/brandtracker_w4.sav` (160 KB); waves 1–3, 5 + raw W4 in `test_data/fixtures/brand_tracker/` (total ~945 KB, under budget); `validation/brand_tracker_ground_truth.json` (weighted funnel metrics, deltas with z-test verdicts, segment cuts, achieved margins, design effects ~1.12); golden test `tests/golden/brand_tracker_parity.test.ts` (12 tests, engine reproduces ground truth within 0.1pt).
  - Planted story verified in generated data: Atlas composite +4.27pts W3→W4 (p=0.003); unaided +5.75pts with flat conversion; Beacon overtakes Meridian on consideration T2B in W4 (41.7% vs 38.5%, first time in 4 waves); "innovative" +6.65pts significant / "worth the price" −1.85pts non-significant; Growth-segment divergence is the only significant segment mover; Atlas NPS base n=189 (low-base); W5 consolidates Growth and flattens the unaided mover.
  - Note: `.sav` bytes are not byte-stable across regenerations (pyreadstat embeds a creation timestamp); data values are deterministic and checksummed in the ground-truth JSON (`data_checksums_sha256`).
- **Phase B — Recipe. ✅ Done (2026-07-03).** Execute §4.1 end to end via engine primitives against the raw wave; capture the gap log (§4.2) into `pilot_04a` §7 internal signals; session export/reopen replays transforms. *Gate: scripted run completes with zero manual repair; session round-trip test.*
  - Shipped: `scripts/brand-tracker-recipe-demo.ts` (`npm run demo:brand-tracker-recipe`) runs steps 1–10 against the real `VelocityEngine` Node runtime with zero manual repair (exit 0) — multi-dataset workspace load, weight discovery (`rim_wt_final` mean ≈ 1.0 over the `body_weight_kg` decoy), fuzzy `att_value_* → att_worth_*` mapping, reversed-consideration remap, `age_band` / consideration-T2B / NPS-class recodes, weighted significance crosstabs, and deck build/export/commit + session export. Uses only shipped primitives — **no new engine surface**.
  - Session round-trip: `src/engine/__tests__/brand_tracker_recipe_roundtrip.test.ts` (green) proves the `transformLog` replays recode steps 4–7 on a fresh ingest, restoring every derived variable with identical distributions (arch_07 §8 reopen contract).
  - Gaps: internal signals `INF-06`…`INF-09` added to `docs/pilot_04a_processing_gap_discovery.md` §7 (NET-DERIVE ×2, META-HYGIENE/RECIPE-REPLAY, BANNER-PLAN), with a what-worked / demoed-around / gaps walkthrough in `docs/workstreams/deck_native/brand_tracker_recipe_gap_log.md`. All remain "do not build yet"; the general recipe manager (`S5-PREP-1`) stays Frozen and `PILOT-4b` stays Blocked on external discovery.
- **Phase C — Deck. ✅ Done (2026-07-03).** `scripts/brand-tracker-demo.ts` (`npm run demo:brand-tracker`, exit 0) loads `public/examples/brandtracker_w4.sav`, sets weight `wt`, derives attribute Top-2-Box nets via `recode` (recipe step 6, for legible driver slides), builds an **18-slide deck** (28 physical incl. auto title + section dividers) in canonical `08` §3 order, exports the golden PPTX `tests/fixtures/export/brandtracker-report.pptx`, and commits the deck to the session. Action titles carry the planted ground-truth numbers (`validation/brand_tracker_ground_truth.json`): significant movers stated with direction + magnitude (aided +6→73%, unaided +6→37%, consideration +5→38%, 'innovative' +7→37%, ad recall +7→26%, Beacon overtakes Meridian at 42%, Growth +13→46%, under-35s +9→42%); the non-significant "worth the price" mover titled *broadly stable*; usage/conversion held flat; Atlas NPS carries a low-base (n=189) directional caveat. Exemplar candidate artifacts committed under `demo/artifacts/report-quality/exemplars/` (`brandtracker_w4_deck_candidate.md`, `brandtracker_w4_conformance.md` — 10/10 checklist, agent-assessed narrative band 3, `brandtracker_w4_action_title_eval.json`, `brandtracker_w4_pptx_inspection.json`). inspect-pptx profile matches the `sleep-report.pptx` golden baseline (1 font; the two overflow/palette warnings are pre-existing exporter characteristics). Typecheck + lint green. *Gate met: rubric deck-level pass (0 gate failures, 100% Strong body slides); consultant sign-off (`brand_tracker_north_star_signoff.md`) remains the promotion bar.*
- **Phase D — Integration + refresh. ✅ Done (2026-07-03).** Load Example swap, autoFirstCrosstab, demo contracts, e2e, wave-5 refresh demo, EVAL-07 freeze, tracker/docs sync. *Gate met: T/L/U typecheck+lint green; targeted unit suites green; brand-tracker parity green; wave-refresh demo exit 0; EVAL-07 artifacts frozen; consultant sign-off requested for exemplar promotion.*
  - Shipped: **Load Example** — `src/features/workspace/hooks/useFileUpload.ts` makes `brandtracker_w4.sav` the primary example with `sleep.sav` retained as secondary/backup **and** a runtime fallback (sleep.sav still anchors frozen EVAL-01/03/04 and the R-parity suite, untouched). **First-run analysis** — `src/features/dashboard/lib/autoFirstCrosstab.ts` + `useAutoFirstCrosstab.ts` default the tracker to a funnel-relevant cut (brand preference × attitudinal segment). **Demo contracts** — `demo/contracts/brand-tracker-{load,recipe,deck-export,wave-refresh}.json`. **E2E** — `tests/e2e/brand-tracker-workflow.spec.ts` (load example → auto funnel crosstab). **Wave refresh** — `scripts/brand-tracker-wave-refresh-demo.ts` (`npm run demo:brand-tracker-wave-refresh`, exit 0): builds + commits the Wave 4 deck, imports Wave 5, runs `assessDatasetReplacement` (READY, 0 blocked), applies `wave_refresh` template mode to recompute action titles **flagged for human confirmation** (never silently rewritten, defensibility guard held — all non-significant W4→W5 moves titled "broadly stable"), flags the flat unaided-awareness headline as a **demotion candidate**, and makes `RECIPE-REPLAY` (INF-04) concrete (recipe-derived nets do not survive replacement). **Trust pack** — `docs/pilot_02_trust_pack.md` §3.3 + §9 add brand-tracker ground-truth parity reproduce commands. **EVAL-07** — frozen under `evals/eval-07/` (brief + `runs/run-2026-07-03/` scorecard/gap_review/summary.json + deck/session artifacts; `npm run eval:07`), the first eval family aligned to the pilot archetype; Pattern 7 end-to-end success. No new engine surface; frozen EVAL-01…06 baselines untouched.

### Proposed tracker rows (add to `tracker_00_implementation_status.md` §5.1 on adoption, per tracker update rules)

| ID | Task | Depends on | Gates | Contract change |
| :--- | :--- | :--- | :--- | :--- |
| `PILOT-DEMO-1` | Brand tracker synthetic dataset + ground truth (Phase A) | PILOT-0 | T/L/U/G | No |
| `PILOT-DEMO-2` | Transformation recipe demo + gap log (Phase B) | PILOT-DEMO-1 | T/L/U/I/A | No (feeds PILOT-4a) |
| `PILOT-DEMO-3` | Tracker deck + north-star exemplar candidate (Phase C) | PILOT-DEMO-1 | T/L/U/I | No |
| `PILOT-DEMO-4` | Demo integration + wave refresh + EVAL-07 (Phase D) | PILOT-DEMO-2, -3 | T/L/U/I/G/V | No |

## 8. Scope guardrails and risks

**Guardrails (what this plan deliberately does not do):**

- No recipe manager, no replay engine, no banner-plan persistence, no raking UI — `S5-PREP-1` stays Frozen; `PILOT-4b` stays Blocked on external discovery. The recipe is a *demonstration composed of shipped primitives*; gaps become PILOT-4a internal signals only.
- No new engine methods by default; any that prove necessary go through the engine-API playbook as separate tracked work.
- No real brand names or logos anywhere in the generated assets.
- Frozen eval baselines and sleep.sav's roles in them are untouched.

**Risks:**

| Risk | Mitigation |
| :--- | :--- |
| Synthetic data reads as fake to a practitioner | Calibrate to BRAND/census references (§1.3); nested funnel + correlated attributes (§3.1); honest wobble (planted non-significant movers) |
| "Planted story" perceived as rigged if discovered | Full transparency: config + ground truth are committed and auditable; demo script says "synthetic, designed to exercise the significance guardrails" |
| Recipe demo hits a hard engine gap mid-build (worst case: harmonized multi-wave trend table) | Phase B is sequenced before deck buildout precisely to surface this; fallback is trimming the raw-file mess (e.g. drop the rename demo) rather than expanding engine scope |
| Deck quality lands in the uncanny valley | The `09` rubric gate and human sign-off are blocking, not advisory; the deck ships as *candidate* until signed |
| Scope creep toward SPSS-replacement processing | §4.2 disposition table + PILOT-4a "do not build yet" register discipline |
