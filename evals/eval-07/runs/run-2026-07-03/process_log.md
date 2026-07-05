# Eval 07: Brand Tracker Wave Readout + Refresh — Benchmark Result

Eval ID:        `EVAL-07`
Task family:    `E - pilot-archetype tracker readout + update`
Brief:          [evals/eval-07/brief.md](../../brief.md)
Dataset:        `public/examples/brandtracker_w4.sav` — 1,200 respondents, 84 variables (demo Wave 4); `brandtracker_w5.sav` refresh wave
Agent:          `Engine-driven run: VelocityEngine Node runtime via the committed demo scripts`
Date:           `2026-07-03`
Method:         `The recipe, deck, and wave-refresh demos run against the real engine using only shipped primitives; every displayed number is checked against the committed ground truth (validation/brand_tracker_ground_truth.json).`
Deliverable:    [artifacts/brand_tracker_deck.pptx](artifacts/brand_tracker_deck.pptx) — 18-slide story-template deck; [artifacts/brand_tracker_session.velocity.json](artifacts/brand_tracker_session.velocity.json) — recipe session with replayable transformLog

## 1. Process Timeline

| Phase | Action | Result |
|---|---|---|
| Recipe | `npm run demo:brand-tracker-recipe` — steps 1–10 against the raw agency Wave 4 | Raw → analysis-ready with zero manual repair (exit 0); weight discovery, fuzzy `att_value_* → att_worth_*` mapping, reversed-scale remap, `age_band` / consideration-T2B / NPS-class recodes, weighted significance crosstabs, deck build/export/commit, session export |
| Readout | `npm run demo:brand-tracker` — build + export the Wave 4 deck | 18-slide (28 physical) story-template deck; action titles carry ground-truth numbers; golden PPTX written |
| Parity | `npx vitest run tests/golden/brand_tracker_parity.test.ts` | Engine reproduces weighted funnel metrics within 0.1pt on W4/W3/W5 waves; Beacon-over-Meridian rank fact confirmed |
| Refresh | `npm run demo:brand-tracker-wave-refresh` — import Wave 5, replacement review, `wave_refresh` | Review READY (0 blocked); recomputed titles flagged for confirmation; unaided-awareness headline demoted (flat W4→W5); RECIPE-REPLAY limitation logged |
| Integration | Load Example primary swap + funnel-relevant auto-first-crosstab | `brandtracker_w4.sav` is the primary Load Example; first crosstab defaults to brand preference × segment |

### Planted storyline verified against ground truth

1. Atlas aided awareness +5.9pts to 72.7% (W3→W4), z=2.96, p=0.003 — significant.
2. The gain is top-of-funnel: unaided +5.7pts (significant); awareness→consideration conversion flat.
3. Beacon overtakes Meridian on consideration T2B in W4 (41.7% vs 38.5%) — first time in four waves.
4. "Innovative" +6.7pts (significant); "worth the price" −1.9pts (not significant → "broadly stable").
5. Exactly one significant segment divergence: Growth +13.4pts on unaided; under-35s +8.9pts.
6. Atlas NPS improves on n≈189 users → low-base flag.
7. Wave 5 consolidates Growth; the unaided-awareness mover goes flat (+1.4pts, not significant) → demotion candidate.

### False starts / deviations

1. The consideration T2B net used by the driver slides is a recipe-derived recode. In the wave refresh, this derived net does **not** survive dataset replacement (RECIPE-REPLAY / INF-04) — an intentional, logged limitation, not a workaround. The refresh recomputes on shipped variables only.

## 2. Key Decisions

- **Variables selected:** funnel (`aware_*`, `unaided_any_*`, `consider_*`, `used_p3m_*`), preference (`brand_pref`), drivers (`att_innov_*`, `att_worth_*`, `adrecall_*`), banner (`segment`, `age_band`), weight (`wt`).
- **Weight application:** `wt` (the genuine rim weight, mean ≈ 1.0) selected over the `body_weight_kg` decoy — the deliberate contrast with `sleep.sav`'s body-weight trap.
- **Defensibility guard:** the within-margin "worth the price" mover and every non-significant W4→W5 move are titled "broadly stable", never as a directional change.
- **Scope:** demonstration composed of shipped primitives only; no recipe manager, no replay engine, no new engine methods.

## 3. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Deck (PPTX) | [artifacts/brand_tracker_deck.pptx](artifacts/brand_tracker_deck.pptx) | 18-slide story-template Wave 4 readout (golden `tests/fixtures/export/brandtracker-report.pptx`) |
| Session (.velocity.json) | [artifacts/brand_tracker_session.velocity.json](artifacts/brand_tracker_session.velocity.json) | Recipe session; `transformLog` replays the derived variables on reopen |
| Ground truth | `validation/brand_tracker_ground_truth.json` | Committed, auditable expected values for every displayed number |
| Parity test | `tests/golden/brand_tracker_parity.test.ts` | Engine ↔ ground-truth parity within 0.1pt |
| Process log | [process_log.md](process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](artifacts/summary.json) | Structured run metadata |

## 4. Issues and Friction

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | Recipe-derived nets (recode targets) do not survive cross-wave dataset replacement; the wave refresh re-runs on shipped variables only | Workflow / RECIPE-REPLAY | Medium | Named limitation (INF-04); the refresh is still READY on shipped-variable recipes. Do not build the replay engine here |
| 2 | Consideration T2B and NPS score are derived nets, not single displayed stats | Engine / NET-DERIVE | Low | Demoed-around with recode-derived T2B and promoter/detractor shares (INF-06/07) |
| 3 | Multi-break banners are composed one crosstab per break | Workflow / BANNER-PLAN | Low | No persistent banner plan (INF-09); acceptable for the demo |

## 5. Per-Layer Scorecard

See [scorecard.md](scorecard.md).

## 6. Assessment Against Research Brief

| Dimension | Expected | Actual | Rating |
|---|---|---|---|
| Ground-truth parity | Within 0.1pt on every funnel metric | Parity test green across W4/W3/W5 | Check |
| Zero manual repair | Raw → analysis-ready → deck on shipped primitives | Recipe exit 0; no new engine surface | Check |
| Wave refresh | READY review; flagged titles; flat-mover demotion | Review READY (0 blocked); titles flagged; unaided demoted | Check |
| Defensibility guard | Non-significant moves titled "broadly stable" | Held on "worth the price" and all W4→W5 movers | Check |
| Scope discipline | No replay engine; frozen evals untouched | RECIPE-REPLAY deferred; EVAL-01…06 untouched | Check |

## 7. Difficulty Check

| Dimension | Expected rating | Actual experience | Surprise? |
|---|---|---|---|
| Dataset size | Low | Low (1,200 × 84) | No |
| Naming quality | Medium (agency-style labels) | Medium | No |
| Domain specificity | Medium (tracker funnel) | Medium | No |
| Analysis complexity | Medium (weighted significance, segments) | Medium | No |
| Deliverable expectations | High (18-slide story-template deck) | High, but deterministic | No |

## 8. Severity Classification

`Passing`

The pilot-archetype loop completes end to end on shipped primitives with ground-truth parity. The only named limitation (RECIPE-REPLAY) is correctly deferred.

## 9. Outcome Pattern

- **Primary pattern:** `Pattern 7 — End-to-end success with minimal scaffolding`
- **Secondary signal:** `RECIPE-REPLAY (INF-04) — cross-dataset recode replay is the one named, deferred limitation`

## 10. Verdict

`EVAL-07` establishes the first frozen baseline aligned to the actual pilot archetype. The engine reproduces the committed ground truth within tolerance; the raw-to-deck recipe and the wave-5 refresh both complete on shipped primitives with no new engine surface; the defensibility guard holds. The tracker-update wedge (PILOT-5) is demonstrable end to end, with `RECIPE-REPLAY` the only capability gap and correctly left for external-discovery-gated work.

## 11. Recommended Next Actions

- **Product:** none blocking; consider promoting the deck to the north-star exemplar once consultant sign-off (`brand_tracker_north_star_signoff.md`) lands.
- **Docs/guidance:** keep `validation/brand_tracker_ground_truth.json` as the audit anchor for all tracker claims.
- **Eval-design:** re-run EVAL-07 on future engine changes as a pilot-archetype regression guard; any layer dropping 2+ points is a regression.
- **Strategic:** treat `RECIPE-REPLAY` as the next real capability question for the tracker wedge, gated on external pilot observation (`PILOT-4b`).
