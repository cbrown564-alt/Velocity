# Agent Evaluation: Brand Tracker Wave Readout + Refresh

## Research Brief

**Dataset:** `public/examples/brandtracker_w4.sav` (demo Wave 4) + `test_data/fixtures/brand_tracker/brandtracker_w5.sav` (refresh wave)
**Ground truth:** `validation/brand_tracker_ground_truth.json`
**Task:** Produce a client-ready brand tracker wave readout, then perform the next-quarter wave refresh.
**Family:** E (pilot-archetype tracker readout + update)

### Background

EVAL-01…06 exercised convergence, discovery, and harmonization on teaching files (`sleep.sav`, `bsa93.sav`, BSA/ELSA waves). None of them match the actual pilot wedge: **tracker updates for boutique agencies**. EVAL-07 is the first eval family aligned to that archetype — a purpose-built, multi-wave synthetic brand tracker with a funnel, a named competitor set, an attribute battery, a demographic banner, and a real rim weight.

The dataset is synthetic but calibrated to public norms and shipped with an auditable, committed ground truth so every displayed number can be checked (plan §1.3, §3.3). The storyline is planted deterministically to exercise the significance guardrails: a real top-of-funnel headline, a competitor rank change, an honest within-margin "broadly stable" mover, exactly one significant segment divergence, and a low-base advocacy caveat.

### Task

Two connected assignments on the same substrate:

1. **Wave 4 readout.** From the raw agency wave, run the transformation recipe (weight discovery, fuzzy variable mapping, reversed-scale remap, derived age band / consideration T2B / NPS classes), then build and export the ~18-slide story-template deck with action titles that carry the ground-truth numbers and honor the defensibility guard.
2. **Wave 5 refresh.** Import the next-quarter wave, run the dataset-replacement review on the saved slide recipes, apply the `wave_refresh` template mode, and surface recomputed titles (flagged for human confirmation) plus flat-mover demotion candidates.

### Deliverable

- Recipe run (`npm run demo:brand-tracker-recipe`) — raw → analysis-ready with zero manual repair; session `transformLog` replays on reopen.
- Deck export (`npm run demo:brand-tracker`) — golden PPTX `tests/fixtures/export/brandtracker-report.pptx`.
- Wave refresh (`npm run demo:brand-tracker-wave-refresh`) — dataset-replacement review READY, recomputed titles flagged, flat mover demoted.
- Ground-truth parity (`tests/golden/brand_tracker_parity.test.ts`) — engine reproduces weighted funnel metrics within 0.1pt.

---

## Evaluation Framework

### Comparison Axes

Score against `docs/eval_framework.md` layers:

- engine (weighted crosstabs / significance reproduce ground truth)
- mcp_workflow (recipe composed of shipped primitives; no new engine surface)
- semantic_layer (weight discovery: real rim weight vs body-weight decoy)
- deliverable_layer (story-template deck; action titles pass the `09` rubric)
- product_defaults (Load Example primary + funnel-relevant auto-first-crosstab)
- agent_prompting (deterministic, auditable planted story)

### Success Criteria

- Engine output matches the committed ground truth within 0.1pt on every displayed funnel metric.
- The recipe runs raw → analysis-ready → deck with zero manual repair, using only shipped primitives.
- The wave-5 refresh review is READY for saved recipes on shipped variables; recomputed titles are flagged for confirmation and never silently rewritten; the flat mover demotes.
- No new engine surface; frozen EVAL-01…06 baselines and `sleep.sav`'s roles untouched.

### Failure Criteria

- A displayed number diverges from ground truth beyond tolerance.
- The recipe or refresh requires undocumented workarounds, off-path scripting, or new engine methods.
- A non-significant mover is titled as a directional gain/loss (defensibility guard breach).

### Expected Outcomes

**Good outcome (expected):** the full raw-to-deck loop and the wave refresh complete on shipped primitives with ground-truth parity — a Pattern 7 end-to-end success on the pilot archetype, with `RECIPE-REPLAY` (INF-04) the only named limitation and correctly deferred.

**Poor outcome:** the tracker shape surfaces an engine or workflow gap that blocks the readout, or the refresh silently rewrites titles.

---

## Sequencing Note

EVAL-07 freezes the brand tracker demo (plan `10_brand_tracker_demo_plan.md`, Phase D). It is a **baseline for the pilot archetype**, not a convergence test. `RECIPE-REPLAY` (cross-dataset recode replay) is made legible by the refresh demo but is explicitly **not** built here — the general recipe manager (`S5-PREP-1`) stays Frozen and `PILOT-4b` stays Blocked on external discovery.
