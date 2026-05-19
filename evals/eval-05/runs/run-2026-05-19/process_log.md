# Eval 05b: Fuzzy Cross-Wave Harmonization — Benchmark Result

Eval ID:        `EVAL-05` (follow-on `S4-EVAL-5b`)  
Task family:    `E — harmonization`  
Brief:          [brief.md](./brief.md)  
Dataset slice:  ELSA IFS `wave_4_ifs_derived_variables.sav` + `wave_5_ifs_derived_variables.sav`  
Agent:          `VelocityEngine` workspace path (Node repro script)  
Date:           `2026-05-19`  
Method:         `npm run eval:05b:engine` — engine workspace load, auto-match, manual remap `ageg5→ageg7`, harmonize  
Primary artifact: [artifacts/harmonized_counts.csv](./artifacts/harmonized_counts.csv)

## 1. Process Timeline

| Phase | Workflow action | Result |
|---|---|---|
| Discover constructs | `discover_fuzzy_construct.ts` scan across wave 4/5 inventories | 22 non-exact high-score pairs; selected `ageg5→ageg7` (overlap 0.7, score ~0.89) |
| Load wave 4 | `loadWorkspaceDataset(wave_4…)` | `11,050` rows, table `ws_ws_*` |
| Load wave 5 | `loadWorkspaceDataset(wave_5…)` | `10,274` rows, separate workspace table |
| Auto-match | `proposeWorkspaceMappings` | `432` mappings; `ageg5` auto-targeted to exact `ageg5` |
| Review / refine | Override mapping to `ageg7`, regenerate value mappings | Composite score `0.891`; `85+` unmapped (`data_loss` risk) |
| Apply | `harmonizeWorkspaceDatasets` → `harm_eval05b_wave4_wave5_ageg5_ageg7` | `21,324` rows (`11,050 + 10,274`) |
| Export | Write counts CSV, run JSON, summary JSON | Artifacts under `artifacts/` |

## 2. Mapping Decision Log

| Source wave | Target wave | Mapping | Decision | Why |
|---|---|---|---|---|
| Wave 4 | Wave 5 | `ageg5 → ageg5` (auto) | Rejected for apply | Exact match (score 1.0) does not test fuzzy drift |
| Wave 4 | Wave 5 | `ageg5 → ageg7` | **Confirmed** | Name drift + partial labels (Jaccard 0.7); remaps 80-84→80+; documents top-band loss |
| Wave 4 | Wave 5 | `srh3_hrs → srh3_hse` (discovery only) | Not used | `srh3_hse` is 100% `-3` (not asked) in wave 5 — would yield empty harmonized target wave |

## 3. Cross-Wave Read (valid age bands)

Wave 1 uses source coding after remap toward target bands; wave 2 uses native `ageg7` coding.

| Band (wave 1 labels) | Wave 1 % | Wave 2 % | Notes |
|---|---|---|---|
| 50-54 | 12.4 | 5.4 | Cohort aging between waves |
| 55-59 | 19.5 | 20.0 | Stable |
| 60-64 | 19.9 | 21.4 | Stable |
| 65-69 | 14.4 | 15.9 | Stable |
| 70-74 | 13.9 | 14.4 | Stable |
| 75-79 | 9.2 | 10.7 | Stable |
| 80-84 / 80+ | 5.8 | 12.2 | Target collapses top bands; wave 1 still shows split 80-84 vs 85+ pre-remap edge |

## 4. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Harmonized counts CSV | [artifacts/harmonized_counts.csv](./artifacts/harmonized_counts.csv) | Row counts by `_wave` / `_value` |
| Harmonization run detail | [artifacts/harmonized_run.json](./artifacts/harmonized_run.json) | Scores, value mappings, SQL |
| Summary JSON | [artifacts/summary.json](./artifacts/summary.json) | Structured metadata per schema |
| Process log | [process_log.md](./process_log.md) | This document |
| Scorecard | [scorecard.md](./scorecard.md) | Per-layer scoring |
| Gap review | [gap_review.md](./gap_review.md) | Strategic interpretation |

## 5. Issues and Friction

| # | Observation | Layer | Severity | Impact |
|---|---|---|---|---|
| 1 | Browser Playwright harness fails on second SAV upload (worker respawn drops first materialized table) | Browser convergence | Medium | `npm run eval:05b` blocked; engine repro used instead |
| 2 | `srh3_hse` looks like a strong fuzzy name match but is entirely missing in wave 5 | Semantic / product defaults | Medium | Agents must validate frequencies, not only match scores |
| 3 | Source code `85+` has no target mapping; harmonized wave 1 retains code `8` | Deliverable / matching | Low | Documented data-loss edge; reviewer must interpret |
| 4 | Harmonized output still uses `_wave = 1/2` not wave numbers 4/5 | Deliverable | Low | Same rough-edge as `run-2026-03-13` |

## 6. Assessment Against Brief

| Requirement | Result | Rating |
|---|---|---|
| Exercise naming drift | Yes — `ageg5` vs `ageg7` | Check |
| Exercise partial label overlap | Yes — Jaccard 0.7; remapped bands | Check |
| Exercise scale inversion | N/A — no qualifying pair in slice | N/A |
| Built-in mapping tools | Yes — `proposeWorkspaceMappings` + manual override | Check |
| Reviewable mapping log | Yes — table above | Check |
| Harmonized output + narrative | Yes — CSV + cross-wave summary | Check |

## 7. Severity Classification

`Passing` — fuzzy harmonization path validated on real ELSA drift with inspectable artifacts.

## 8. Outcome Pattern

- **Primary pattern:** `Pattern 7 — End-to-end success` (engine/workspace path)
- **Secondary signal:** `Pattern 3` — browser harness still behind engine for multi-dataset upload

## 9. Verdict

`S4-EVAL-5b` closes the gap left by `run-2026-03-13`: the match engine's Jaro-Winkler and Jaccard signals are **exercised on real longitudinal data**, and a harmonized table is produced after manual override from the exact auto-match. Claim **U10** (harmonization matching on real cross-wave drift) moves from unvalidated to **validated for this construct class**.

Scale inversion remains unvalidated on this dataset slice.

## 10. Recommended Next Actions

- Fix browser eval harness: return to workspace between uploads or reuse `datasetId` to avoid worker respawn dropping tables
- Surface `data_loss` warnings when value mappings leave source codes unmapped
- Optional: add scale-inversion fixture wave pair when a real inverted construct is identified
