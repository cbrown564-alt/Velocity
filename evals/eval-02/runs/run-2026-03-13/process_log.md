# Eval 02: British Social Attitudes 2017 — Benchmark Result

Eval ID:        `EVAL-02`
Task family:    `A — discovery`
Brief:          [docs/archive/2026-03/phase4-eval/eval_02_bsa2017_research_brief.md](/Users/cobro/code/Velocity/docs/archive/2026-03/phase4-eval/eval_02_bsa2017_research_brief.md)
Dataset:        `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav` — 3,988 respondents, 654 variables
Agent:          `Codex via MCP`
Date:           `2026-03-13`
Method:         `MCP tools via stdio client runner; no direct-engine analysis scripts, no heap workaround, and full deck/session export through the published MCP surface`
Deliverable:    [artifacts/deck.pptx](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/artifacts/deck.pptx) — 13 slides, 3 sections, 2.36 MB

## 1. Process Timeline

| Phase | Playbook step | Engine calls | Wall time | Notes |
|---|---|---|---|---|
| Orient | Load + describe | 2 | `~0.45s` | Dataset loaded cleanly; 654 vars, 3,988 rows |
| Annotate & Discover | Annotate + 5 searches + 12 variable inspections | 18 | `~0.09s` | 287/654 variables auto-annotated; topic search mixed, demographic search weak |
| Analyze | 14 weighted crosstabs | 14 | `~0.04s` | All planned cross-tabs ran cleanly with significant results on most core relationships |
| Build & Export | Build + export + commit + session | 4 | `~0.27s` | 13-slide deck exported, committed, and persisted without workflow errors |
| **Total** | | **39** | `~0.85s wall / 0.67s engine` | Large-dataset MCP path is now reproducible end-to-end |

### False starts / deviations

1. **No product-level blockers in the MCP path.** Unlike the prior 2026-03-12 BSA run, this run did not need to escape to direct-engine scripts.
2. **Packaging-only runner fix:** A one-off local MCP runner initially assumed the wrong `velocity_describe` shape while writing evidence. The eval itself had already succeeded; the fix was only to the local harness summarization.

## 2. Key Decisions

- **Weighting:** `WtFactor` was identified early and applied globally, then repeated explicitly in slide specs for clarity.
- **Themes selected:** `Brexit divide`, `NHS and public spending`, `Trust in government`
- **Variables selected:** `EUVOTWHO`, `libauth2`, `NHSSat`, `TaxSpend`, `Spend1`, `GovTrust`, plus break variables `RAgeCat`, `PartyId2`, `HEdQual`, `RClassGp`, `HHIncQ`
- **Variables excluded and why:** welfare scales and social-liberalism items were left out to preserve deck discipline; high-cardinality region variables and broader EU batteries were avoided to keep tables readable
- **Notable reasoning:** The run favored 3 coherent themes over trying to cover the full brief breadth. That kept the narrative strong and prevented the 654-variable surface from turning into a scattershot deck.

## 3. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Deck (PPTX) | [artifacts/deck.pptx](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/artifacts/deck.pptx) | 13-slide weighted deck, 3 sections |
| Session (.velocity) | [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/artifacts/session.velocity) | Session contains all 13 slides and 3 sections after `velocity_commit_deck` |
| Process log | [process_log.md](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/artifacts/summary.json) | Structured run metadata |

## 4. Issues and Friction

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | Semantic search ranked the wrong top result for NHS, trust, and demographic queries | Semantic | High | Discovery required manual variable judgment rather than trusting the search surface |
| 2 | Large-survey discovery still depends on disciplined human or agent curation after search | Product defaults | Medium | The deck was strong, but the product did not narrow the 654-variable space enough on its own |
| 3 | Earlier BSA concern about missing chi-square statistics appears to be a field-shape misunderstanding (`chiSquare.chiSquare` exists) rather than an engine blocker | Docs / workflow | Low | No analysis step was blocked, but the contract could be clearer for agents reading stats objects |

## 5. Per-Layer Scorecard

See [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-02/runs/run-2026-03-13/scorecard.md).

## 6. Assessment Against Research Brief

| Dimension | Expected | Actual | Rating |
|---|---|---|---|
| Deliverable length | 12-18 slides | 13 slides | Check |
| Weight handling | Use `WtFactor` throughout | Weight applied globally and in slide specs | Check |
| Theme selection | 2-3 coherent themes | 3 strong themes with editorial narrative | Check |
| Discovery quality | Search should help navigate 654 vars | EU and welfare queries were useful; NHS, trust, and demographics were weak | Warning |
| Session handoff | Export inspectable state | `.velocity` file contains 13 slides and 3 sections | Check |
| Narrative quality | Editorial titles and notes | All slides are finding-based with contextual notes | Check |

## 7. Difficulty Check

| Dimension | Expected rating | Actual experience | Surprise? |
|---|---|---|---|
| Dataset size | High | High but operationally manageable | No |
| Naming quality | Medium | Medium-good | No |
| Domain specificity | High | High | No |
| Analysis complexity | Medium | Medium | No |
| Discovery complexity | High | High, mainly because search still underperforms on category queries | No |

## 8. Severity Classification

`Moderate`

The task completed cleanly through MCP with a strong deliverable, but the main benchmark claim for this dataset class is still discovery support, and that layer remains materially weaker than the engine and export path.

## 9. Outcome Pattern

- **Primary pattern:** `Pattern 4 — agent gets lost in dataset discovery`
- **Secondary pattern:** `Pattern 7 — end-to-end success with inspectable artifacts`

## 10. Verdict

EVAL-02 upgrades the earlier BSA result from a CLI workaround into a real MCP benchmark: the system loaded a 654-variable survey, applied the correct weight, produced a coherent 13-slide deck, and exported a matching session file without workflow breakage. The main remaining weakness is now sharply isolated: discovery at large-survey scale is still not benchmark-ready because category-level search and break-variable navigation are too noisy.

## 11. Recommended Next Actions

- **Semantic fixes:** Add category-aware or intent-aware search affordances for demographics, party, class, age, and other standard break-variable families
- **Product-default fixes:** Surface recommended breaks or starter analysis suggestions once the agent has found a substantive topic variable
- **Docs fixes:** Clarify the chi-square field shape in examples so agents do not look for a nonexistent `statistic` property
- **Eval program:** Freeze this run as the current BSA MCP baseline and compare future semantic-layer changes against it
