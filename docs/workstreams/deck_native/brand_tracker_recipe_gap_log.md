# Brand Tracker Recipe — Phase B Gap Log

**Task:** `PILOT-DEMO-2` (Phase B of `10_brand_tracker_demo_plan.md`)
**Artifact:** `scripts/brand-tracker-recipe-demo.ts` (run: `npm run demo:brand-tracker-recipe` or `npx tsx scripts/brand-tracker-recipe-demo.ts`)
**Round-trip test:** `src/engine/__tests__/brand_tracker_recipe_roundtrip.test.ts`
**Scope reminder:** this is a *demonstration composed of shipped primitives* (plan §8). No recipe manager, no replay engine, no new engine surface. Friction is logged as **internal** signals only (`pilot_04a` §7), never external pilot evidence.

## What the recipe does (plan §4.1, steps 1–10)

The script drives raw Wave 4 (`test_data/fixtures/brand_tracker/brandtracker_w4_raw.sav`) from agency-mess to analysis-ready to deck, using only `loadFile`, workspace load / `proposeWorkspaceMappings` / `harmonizeWorkspaceDatasets`, `recode`, `runAnalysis`, `buildDeck` / `exportDeck` / `commitDeck`, and `exportSession`.

## What worked (no friction)

| Step | Capability exercised | Outcome |
| :--- | :--- | :--- |
| 1 | Multi-dataset workspace: waves 1–3 + raw W4 loaded side by side (`loadWorkspaceDataset`, `waveNumber`) | Clean; wave tagging works |
| 2 | Weight discovery: the genuine rim weight `rim_wt_final` (mean ≈ 1.0) picked over the decoy `body_weight_kg` (mean ≈ 77 kg) | Discriminated on the mean-≈-1.0 heuristic; `setWeight` applied |
| 3 | Fuzzy variable mapping `att_value_atlas → att_worth_atlas`, `att_value_beacon → att_worth_beacon` (`proposeWorkspaceMappings`) | Both renamed attributes auto-matched against the prior wave |
| 4 | Reverse the consideration scale (raw codes 1↔5, 2↔4) via `recode` categorical value remap | Dual-state remap correct; T2B then = codes {4,5} consistently |
| 5 | Derive `age_band` (18–34 / 35–54 / 55+) via `recode` binning | 468 / 480 / 252 — bins align to `age` min/max |
| 6 | Derive consideration T2B per brand via `recode` categorical | 5 derived T2B variables |
| 7 | Derive Atlas NPS classes (0–6 / 7–8 / 9–10) via `recode` binning | Detractor / Passive / Promoter on the Atlas-user base |
| 8 | Weighted crosstabs with significance across funnel / competitive / segment / driver cuts (`runAnalysis('crosstab')`, `analysisSettings`) | All weighted; significance letters produced |
| 9 | Build + export deck (7 slides), commit deck, export session | PPTX written; session `transformLog` carries the 12 recodes |
| 10 | Register refresh wave 5 in the workspace (stub) | Loaded; full refresh deferred to Phase D |

**Session round-trip (the recipe *is* the `transformLog`).** Exporting the session, importing into a fresh engine loaded from the same raw file, and replaying the `transformLog` in order restores every derived variable with byte-identical distributions (arch_07 §8 reopen contract). This is asserted by the round-trip test, which also confirms derived variables are **not** materialised until the log is replayed.

## What was demoed-around (within current capability)

- **NPS score → shares.** Displayed promoter/passive/detractor shares instead of a single `%promoters − %detractors` stat (matches plan §4.2 disposition).
- **Cross-wave attribute rename → single-wave analysis.** The fuzzy mapping and a harmonized stacked table are demonstrated, but the Wave-4 driver crosstabs read the raw `att_value_atlas` directly rather than an in-place-renamed column (single-wave analysis needs no rename).
- **Banner tables → per-break crosstabs.** Segment / age-band / driver cuts are composed as one crosstab per break; no persistent banner plan.
- **Wave-5 refresh → stub.** Wave 5 is registered but `assessDatasetReplacement` + `wave_refresh` template mode are Phase D.

## Gaps logged (internal signals, `pilot_04a` §7)

| Signal | Taxonomy | Summary |
| :--- | :--- | :--- |
| `INF-06` | `NET-DERIVE` | T2B nets require one `recode` per brand; no grid-wide net primitive. Sharpens `INF-02`. |
| `INF-07` | `NET-DERIVE` | NPS *score* as a single displayed stat is not derivable with `recode`/`crosstab`. |
| `INF-08` | `META-HYGIENE` / `RECIPE-REPLAY` | Harmonize emits a new stacked table (no in-place rename); mappings are absent from `transformLog`/session, so they cannot replay on reopen or the next wave. Relates to `INF-04`. |
| `INF-09` | `BANNER-PLAN` | Multi-break banners are per-break crosstabs; no reusable banner plan. Sharpens `INF-03`. |
| `INF-04` | `RECIPE-REPLAY` | (Pre-existing.) Repeating steps 4–7 on wave 5 needs manual re-execution — made concrete here; no cross-dataset recipe replay. |

**Disposition:** all remain "do not build yet" per the plan's scope guardrails and `pilot_04a`'s working rule. They become `PILOT-4b` candidates only with external pilot observation evidence.
