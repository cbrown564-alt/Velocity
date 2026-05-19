# Eval 04: Browser vs Agent Convergence — Benchmark Result

Eval ID:        `EVAL-04`
Task family:    `D - browser-agent convergence`
Brief:          [evals/eval-04/brief.md](../../brief.md)
Dataset:        `test_data/sleep.sav` — 271 respondents, 59 variables
Agent:          `Controlled dual-path run: MCP-only agent path + browser worker/export path`
Date:           `2026-03-13`
Method:         `Both paths executed the same pre-committed 5-slide assignment. The agent half used MCP tools only; the browser half used a live Playwright browser session, the in-page Zustand store, and the same browser export modules the UI calls.`
Deliverable:    [artifacts/browser_deck.pptx](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/browser_deck.pptx) and [artifacts/agent_deck.pptx](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/agent_deck.pptx) — matched 5-slide decks with 1 section each

## 1. Process Timeline

| Phase | Agent path | Browser path | Result |
|---|---|---|---|
| Load / orient | `velocity_load`, `velocity_describe`, `velocity_annotate_dataset` on `sleep.sav` | Real browser upload of `sleep.sav` into the worker-backed app | Both surfaces loaded the same dataset cleanly |
| Scope lock | Build a fixed 5-slide spec around `qualsleep4gp`, `sex`, `age3gp`, `edlevel`, `problem`, and `marital` | Mirror the same five analyses in the browser store | Task drift was avoided by construction |
| Author | `velocity_build_deck` produced a 5-slide / 1-section deck | Browser store created the same 5 slides and 1 section, then snapshotted each slide state | Both paths reached the same slide titles and section structure |
| Export | `velocity_export_deck`, `velocity_commit_deck`, `velocity_export_session` | Browser-side PPTX export plus browser session export | Both paths left behind reviewable deck and session artifacts |
| **Total** | **7 MCP calls** | **5 slide-building passes + browser exports** | Convergence was materially stronger than expected on this bounded task |

### Controlled slide assignment

1. `Overall Sleep Quality` — `qualsleep4gp`
2. `Sleep Quality by Sex` — `qualsleep4gp x sex`
3. `Sleep Quality by Age Group` — `qualsleep4gp x age3gp`
4. `Sleep Quality by Education Level` — `qualsleep4gp x edlevel`
5. `Sleep Problems by Marital Status` — `problem x marital`

### False starts / deviations

1. The browser half was executed through the live browser store/export path rather than literal click-by-click editing because headless inline-editor and drag/drop control is still harness-fragile from `EVAL-03`. This is an eval-harness deviation, not a product escape hatch.

## 2. Key Decisions

- **Variables selected:** `qualsleep4gp`, `sex`, `age3gp`, `edlevel`, `problem`, `marital`
- **Variables excluded and why:** discovery variables outside the brief were intentionally excluded so the comparison stayed about surface parity, not topic exploration
- **Themes/sections chosen:** one shared section, `Sleep Quality by Demographics`
- **Weight application:** correctly left unweighted; `weight` in `sleep.sav` is respondent body weight, not a survey weight
- **Notable reasoning:** the eval deliberately used neutral, assignment-shaped slide titles so output differences would reflect product surface differences rather than narrative polish differences

## 3. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Browser deck (PPTX) | [artifacts/browser_deck.pptx](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/browser_deck.pptx) | 5 slides, 1 section, 207 KB |
| Agent deck (PPTX) | [artifacts/agent_deck.pptx](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/agent_deck.pptx) | 5 slides, 1 section, 218 KB |
| Browser session (.velocity) | [artifacts/browser_session.velocity](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/browser_session.velocity) | 5 slides, 1 section, exported from browser state |
| Agent session (.velocity) | [artifacts/agent_session.velocity](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/agent_session.velocity) | 5 slides, 1 section, exported after `velocity_commit_deck` |
| Process log | [process_log.md](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/artifacts/summary.json) | Structured run metadata |

## 4. Issues and Friction

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | The MCP path still requires an explicit `build -> export -> commit -> export session` sequence, while the browser path edits and exports from already-live state | Workflow / convergence | Medium | The outputs matched, but the agent path still has one extra state-management concept to remember |
| 2 | The browser and MCP sessions preserved the same 5 slides and 1 section, but the top-level `tableConfig` did not match: browser kept the last active `problem x marital` view while the MCP session exported an empty global table config | Browser convergence | Medium | Session parity is very close, but not yet byte-for-byte equivalent at the global working-state layer |
| 3 | Headless automation still cannot honestly exercise every inline browser affordance through literal UI gestures alone | Eval harness only | Low | The browser run used the in-page store/export path to stay on the real substrate without inventing off-product logic |

## 5. Per-Layer Scorecard

See [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-04/runs/run-2026-03-13/scorecard.md).

## 6. Assessment Against Research Brief

| Dimension | Expected | Actual | Rating |
|---|---|---|---|
| Deliverable length | 5-slide deck on sleep quality by demographics | Both paths produced 5-slide decks with the same titles and one shared section | Check |
| Shared scope | Same dataset and same core variables | Both runs used `qualsleep4gp`, `sex`, `age3gp`, `edlevel`, `problem`, and `marital` | Check |
| Output comparability | Broadly comparable artifact quality | Both paths exported reviewable PPTX and session artifacts with matched slide structure | Check |
| Browser-only hidden advantage | If present, name it explicitly | The main remaining browser advantage is last-mile statefulness/editability, not superior analytical reach on this task | Warning |
| Undocumented workarounds | Avoid off-path logic | No external analysis code was used; the only deviation was browser harness control through the live in-page store/export path | Warning |

## 7. Difficulty Check

| Dimension | Expected rating | Actual experience | Surprise? |
|---|---|---|---|
| Dataset size | Low | Low | No |
| Naming quality | Low | Low | No |
| Domain specificity | Low | Low | No |
| Analysis complexity | Low | Low | No |
| Deliverable expectations | Medium | Medium, but tightly bounded | No |

## 8. Severity Classification

`Passing`

This run stayed inside the intended product surfaces and produced comparable browser and MCP artifacts on a small, controlled task. The remaining differences are real but scoped.

## 9. Outcome Pattern

- **Primary pattern:** `Pattern 7 — End-to-end success with minimal scaffolding`
- **Secondary pattern:** `Pattern 3 signal — browser still has a lighter-weight last-mile editing loop than MCP`

## 10. Verdict

`EVAL-04` shows that browser-agent convergence is materially real for a tightly scoped `sleep.sav` deck task. The browser and MCP paths produced the same five-slide structure, the same section title, and matching session artifacts without needing any new product fix. The remaining gap is not hidden analytical power in the browser; it is that browser editing/export still carries active working-state and last-mile edits more directly than the MCP deck/session path does.

## 11. Recommended Next Actions

- **Product fixes:** align top-level session export semantics between browser and MCP so active working-state is preserved consistently
- **Docs/guidance fixes:** document `EVAL-04` as the current narrow convergence baseline and call out that `velocity_commit_deck` remains mandatory before MCP session export
- **Eval-design fixes:** keep future convergence reruns on the same fixed five-slide shape so regressions stay attributable
- **Strategic questions:** treat last-mile editing parity as the remaining convergence question, then move the execution stream forward to `EVAL-05`
