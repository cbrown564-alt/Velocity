# Eval 05: Cross-Wave Harmonization — Benchmark Result

Eval ID:        `EVAL-05`
Task family:    `E — harmonization`
Brief:          [evals/eval-05/brief.md](../../brief.md)
Dataset slice:  `test_data/English Longitudinal Study of Ageing/wave_4_ifs_derived_variables.sav` + `test_data/English Longitudinal Study of Ageing/wave_5_ifs_derived_variables.sav`
Agent:          `Browser workspace + harmonization session`
Date:           `2026-03-13`
Method:         `Live browser upload of both ELSA waves into one worker-backed workspace session, then browser-state harmonization over a bounded single-construct slice`
Primary artifact: [artifacts/harmonized_counts.csv](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/harmonized_counts.csv) — harmonized row counts for `srh3_hrs`

## 1. Process Timeline

| Phase | Workflow action | Result |
|---|---|---|
| Load wave 4 | Browser upload of `wave_4_ifs_derived_variables.sav` | Workspace registered Wave 4 with `11,050` respondents and materialized a dataset table |
| Load wave 5 | Browser upload of `wave_5_ifs_derived_variables.sav` in the same worker session | Workspace registered Wave 5 with `10,274` respondents and preserved both dataset tables side by side |
| Link waves | Mark both datasets as a longitudinal project with respondent key `idauniq` and wave numbers `4` / `5` | Cross-wave context became explicit and reviewable inside the session state |
| Auto-match | Run harmonization auto-match across both variable inventories | `433 / 436` source variables auto-matched, confirming the adjacent-file slice is structurally coherent |
| Review / refine | Inspect the proposed mapping for `srh3_hrs` and confirm only that construct | Exact `srh3_hrs -> srh3_hrs` match scored `1.0` with no warnings and fully aligned value labels |
| Apply | Build harmonized table `harm_eval05_wave4_wave5_srh3_hrs` | Output table created in `18.6 ms` with `21,324` rows (`11,050 + 10,274`) |
| Persist | Export browser session with workspace + harmonization state | Portable session saved at [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/session.velocity) |

## 2. Mapping Decision Log

| Source wave | Target wave | Mapping | Decision | Why |
|---|---|---|---|---|
| Wave 4 | Wave 5 | `srh3_hrs -> srh3_hrs` | Confirmed | Exact variable name, exact label, exact 8-value coding, score `1.0`, no warnings |
| Wave 4 | Wave 5 | Remaining `432` auto-matches | Left unconfirmed | The eval stayed deliberately bounded so the review step remained inspectable rather than bulk-rubber-stamped |
| Wave 4 | Wave 5 | `3` source variables | Unmapped | Natural result of strict auto-match thresholding; not a blocker for the bounded construct slice |

## 3. Cross-Wave Read

The bounded self-reported-health construct was effectively unchanged across the two adjacent waves once invalid / proxy-coded responses were excluded.

| Category | Wave 4 (`_wave = 1`) | Wave 5 (`_wave = 2`) | Change |
|---|---|---|---|
| `Exc/v.g` | `4,444` (`41.9%`) | `4,082` (`42.0%`) | `+0.1 pts` |
| `Good` | `3,375` (`31.9%`) | `3,094` (`31.8%`) | `-0.1 pts` |
| `Fair/Poor` | `2,775` (`26.2%`) | `2,549` (`26.2%`) | `0.0 pts` |

Context:

- Valid health responses: `10,594` in Wave 4, `9,725` in Wave 5
- Respondent overlap on `idauniq`: `9,460`
- Non-valid harmonized rows were almost entirely proxy / refusal / don't-know codes, and the code frames matched exactly across waves

## 4. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Harmonized counts CSV | [artifacts/harmonized_counts.csv](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/harmonized_counts.csv) | Row counts by harmonized wave/value for `srh3_hrs` |
| Harmonization run detail | [artifacts/harmonized_run.json](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/harmonized_run.json) | Raw run metadata including overlap, mapping counts, and selected mapping |
| Browser session (.velocity) | [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/session.velocity) | Workspace-aware browser session with harmonization session state |
| Process log | [process_log.md](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](/Users/cobro/Code/Velocity/evals/eval-05/runs/run-2026-03-13/artifacts/summary.json) | Structured run metadata |

## 5. Issues and Friction

| # | Observation | Layer | Severity | Impact |
|---|---|---|---|---|
| 1 | The checked-in MCP workflow is still explicitly single-dataset, so this eval could not run as a pure MCP session | Agent workflow | Medium | Harmonization is product-real in the browser workspace, but not yet equally reachable from the agent-facing MCP surface |
| 2 | Headless execution still relied on the live in-page store actions for project creation, mapping confirmation, apply, and session export rather than literal click-level UI gestures | Eval harness only | Low | The run stayed on the real browser substrate, but the harness is still thinner than a human walkthrough |
| 3 | The harmonized output table encodes source/target as `_wave = 1/2` instead of preserving original wave numbers `4/5` directly in the artifact | Deliverable semantics | Low | Review is still possible, but the output needs brief-specific interpretation |

## 6. Assessment Against Brief

| Requirement | Result | Rating |
|---|---|---|
| Load two ELSA wave files into the harmonization workflow | Yes | Check |
| Discover a shared construct | Yes — `srh3_hrs` | Check |
| Use built-in mapping tools | Yes — browser auto-match + confirmation | Check |
| Review and refine mappings | Yes — exact-match construct confirmed, broader auto-match intentionally left unconfirmed | Check |
| Build harmonized output and summarize the result | Yes — harmonized table plus counts export and narrative summary | Check |

## 7. Severity Classification

`Passing`

This run produced a real harmonized output and a portable browser session without any product code change. The main caveat is surface coverage: the intended workflow currently exists in the browser workspace more clearly than in the MCP surface.

## 8. Outcome Pattern

- **Primary pattern:** `Pattern 7 — End-to-end success`
- **Secondary signal:** `Pattern 2 — workflow still leans on browser-native statefulness more than agent-native tooling`

## 9. Verdict

`EVAL-05` validates the bounded harmonization thesis on adjacent ELSA IFS-derived files. The browser workspace successfully kept two materialized dataset tables alive in one session, auto-matched the inventories, let the operator confirm a reviewable construct-level mapping, built a harmonized output, and exported the resulting workspace/session state.

This is not yet universal proof that longitudinal harmonization is agent-solved. The eval was intentionally disciplined: one adjacent file pair, one exact construct, one confirmed mapping. But that is enough to move the execution stream forward, because the product path itself is no longer hypothetical.

## 10. Recommended Next Actions

- Add an agent-facing multi-dataset / workspace story so harmonization is not browser-only in practice
- Preserve original wave numbers directly in harmonized outputs instead of generic source/target `1/2`
- Carry the successful bounded-harmonization baseline into `EVAL-06`
