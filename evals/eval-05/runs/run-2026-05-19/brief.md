# EVAL-05b (S4-EVAL-5b): Fuzzy Cross-Wave Harmonization

**Tracker:** `S4-EVAL-5b`  
**Parent eval:** `EVAL-05` (`run-2026-03-13`)  
**Date:** 2026-05-19

## Decision question

Does Velocity's harmonization matching and review loop work when waves use **different variable names** and **partially overlapping value labels**, not only exact-name matches?

## Dataset slice

- `test_data/English Longitudinal Study of Ageing/wave_4_ifs_derived_variables.sav`
- `test_data/English Longitudinal Study of Ageing/wave_5_ifs_derived_variables.sav`

## Construct under test

| Role | Variable | Why |
| :--- | :--- | :--- |
| Source (wave 4) | `ageg5` | 5-band age groups |
| Manual target (wave 5) | `ageg7` | 7-band age groups; Jaro-Winkler name similarity 0.92; label Jaccard 0.7 |

Auto-match proposes `ageg5 → ageg5` (score 1.0). The operator **overrides** to `ageg5 → ageg7` to exercise fuzzy matching, value remapping, and the top-band data-loss case (`85+` has no target code).

## Method

Engine workspace repro (canonical for this run):

```bash
npm run eval:05b:engine
```

Uses `VelocityEngine.loadWorkspaceDataset`, `proposeWorkspaceMappings`, manual remap, and `harmonizeWorkspaceDatasets` — the same surface exposed via `velocity_workspace_*` MCP tools after `S4-MCP-1`.

Optional browser harness (currently blocked by worker respawn on second upload without workspace return):

```bash
npm run build && npm run preview -- --port 4174
npm run eval:05b
```

## Success criteria

- Fuzzy pair scored below 1.0 with partial label overlap evidenced in artifacts
- Harmonized table materializes with valid rows in **both** waves
- Mapping decision log documents auto-match vs manual override
- Gap review classifies findings per `docs/eval_framework.md`

## Out of scope

- Scale inversion (no qualifying inverted-Likert pair found in adjacent ELSA IFS waves 4/5)
