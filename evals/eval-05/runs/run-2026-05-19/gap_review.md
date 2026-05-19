# EVAL-05b Capability Gap Review (S4-EVAL-5b)

## Strategic Read

The March 2026 `EVAL-05` baseline proved harmonization **plumbing** on an exact-match health construct (`srh3_hrs → srh3_hrs`). Independent review correctly flagged that Jaro-Winkler, Jaccard overlap, and value remapping were never stressed on real drift. This follow-on run closes that eval-coverage gap for **name drift + partial label overlap** using `ageg5 → ageg7` across ELSA IFS waves 4 and 5.

## Major Findings

### 1. Fuzzy matching is execution-real on longitudinal drift

- **Class:** Benchmark baseline extended
- **Judgment:** The harmonization engine can score, remap, and materialize a non-exact cross-wave mapping when the operator overrides auto-match.
- **Evidence:** Composite score `0.891` for `ageg5→ageg7`; harmonized table `21,324` rows; both waves show valid band distributions in [harmonized_counts.csv](./artifacts/harmonized_counts.csv).

This validates **U10** for banded categorical constructs with partial label overlap. It does not validate scale inversion (no qualifying pair in this slice).

### 2. High match scores can point at unusable variables

- **Class:** Capability expansion (semantic guardrails)
- **Judgment:** Name similarity alone is insufficient for harmonization candidate ranking.
- **Evidence:** `srh3_hrs → srh3_hse` scores ~0.83 by string/label heuristics, but `srh3_hse` is 100% `-3` (not asked) in wave 5. Applying it would silently empty the target wave.

**Recommendation:** Add frequency pre-checks or warnings when a proposed target variable has zero valid responses in the target wave.

### 3. Value remapping exposes data-loss edges on band changes

- **Class:** Rough-edge
- **Judgment:** Collapsing band schemes (5-band → 7-band with merged top band) leaves orphan source codes unless explicitly mapped.
- **Evidence:** `85+` (code 8) has `targetValue: null` in generated mappings; harmonized wave 1 still reports 519 rows at code 8.

**Recommendation:** Emit `data_loss` warnings in `generateValueMappings` when source valid codes lack targets (unit tests exist; surface in UI/MCP).

### 4. Browser multi-upload harness regressed vs engine workspace path

- **Class:** Browser convergence / eval harness
- **Judgment:** The March Playwright script no longer completes because the second `loadSAV` issues a new `datasetId` and respawns the worker, dropping the first materialized table.
- **Evidence:** `Catalog Error: Table … does not exist` on `getRespondentOverlap` for both `eval:05` and `eval:05b`.

**Recommendation:** Update harness to use workspace return-between-uploads flow or call `velocity_workspace_*` via MCP/engine instead of raw double upload.

## Sufficiency Assessment

For adjacent ELSA IFS waves and a banded demographic construct with name drift and partial label overlap, harmonization is **sufficient** on the engine/workspace path. The exact-match-only claim from Phase 4 synthesis should no longer be cited without this caveat.

Still unvalidated on real data:

1. Scale inversion between waves (no inverted-Likert pair found in waves 4/5 IFS slice)
2. Literal click-level browser harmonization UI (harness blocked)
3. Large-scale bulk confirmation of hundreds of auto-matches

## Gap Classification Summary

| Priority | Layer | Classification | Item |
|---|---|---|---|
| P4 | Eval coverage | **Closed** | Fuzzy harmonization re-run (`S4-EVAL-5b`) |
| P3 | Semantic | Capability expansion | Frequency-aware match ranking / warnings |
| P5 | Deliverable | Rough-edge | Orphan source codes after remap; `_wave` numbering |
| P3 | Browser convergence | Rough-edge | Playwright multi-upload harness repair |

## Recommended Next Investments

1. Repair `scripts/eval/run-eval-05.mjs` / `run-eval-05b.mjs` for post-`STAB-WS-1` workspace behavior.
2. Promote `data_loss` warnings from match engine into harmonization UI and MCP tool responses.
3. Defer scale-inversion eval until a dataset slice with a known inverted construct is identified (or use controlled fixture waves in a dedicated micro-eval).
