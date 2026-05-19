# Eval 01: Sleep Health Study — Benchmark Result

Eval ID:        `EVAL-01`
Task family:    `B — deck`
Brief:          [docs/archive/2026-03/phase4-eval/eval_01_sleep_research_brief.md](/Users/cobro/code/Velocity/docs/archive/2026-03/phase4-eval/eval_01_sleep_research_brief.md)
Dataset:        `test_data/sleep.sav` — 271 respondents, 59 variables
Agent:          `Codex via MCP`
Date:           `2026-03-13`
Method:         `MCP tools via stdio client; final successful run used velocity_commit_deck plus NODE_OPTIONS=--max-old-space-size=8192 on the MCP server after default-heap build failures`
Deliverable:    [artifacts/deck.pptx](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/artifacts/deck.pptx) — 9 slides, 3 sections, 347 KB

## 1. Process Timeline

| Phase | Playbook step | Engine calls | Wall time | Notes |
|---|---|---|---|---|
| Orient | Load + describe | 2 | `<0.1s` | `sleep.sav` loaded cleanly; 59 vars, 271 rows |
| Annotate & Discover | Annotate + 5 searches + 12 variable inspections | 18 | `<0.1s` | 30/59 variables auto-annotated; topical search good, demographic search weak |
| Analyze | 7 crosstabs + filtered impact inspection | 16 | `<0.1s` | Strongest signals were age × night waking, sleep quality × anxiety/depression, stress × sleep problem |
| Build & Export | Build + export + commit + session | 4 | `~0.1s` on final pass | Final 9-slide deck exported cleanly after workflow fix and larger-heap workaround |
| **Total** | | **40** | `~0.2s engine time` | Human/agent debugging time was materially longer because of two blockers |

### False starts / deviations

1. **Session export blocker:** The first MCP round-trip showed that `velocity_export_session` wrote a `.velocity` file with `0` slides and `0` sections because the MCP surface had no deck-commit step. This was fixed mid-run by adding `velocity_commit_deck` with tests and docs updates.
2. **Deck-size blocker:** A richer 8-9 slide chart-heavy spec initially failed twice:
   - default heap: MCP server crashed with Node OOM during `velocity_build_deck`
   - larger heap: the same class of richer spec later failed with `Invalid string length` when returning the built deck over MCP
3. **Final workaround:** The successful run used a lighter 9-slide spec with only single-analysis slides and ran the MCP server with `NODE_OPTIONS=--max-old-space-size=8192`.

## 2. Key Decisions

- **Variables selected:** `qualsleep4gp`, `problem`, `wakenite`, `age3gp`, `anxiety`, `depress`, `sex`, `stressmonth`, `impact2`, `ess`
- **Variables excluded and why:** `impact1`-`impact7` as a single combined slide were excluded from the final deck after triggering build/serialization failures; `marital`, `edlevel`, and lifestyle-use variables were inspected but did not make the final story
- **Themes/sections chosen:** `Sleep Profile`, `Mental Health Links`, `Impact and Daytime Function`
- **Weight application:** Correctly left unweighted. `weight` is body weight, not a sampling weight.
- **Notable reasoning:** The run centered the strongest empirical stories rather than forcing every research question into the deck: age-linked night waking, the anxiety/depression gradient by sleep quality, stress-linked sleep problems, and energy as the clearest downstream burden.

## 3. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Deck (PPTX) | [artifacts/deck.pptx](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/artifacts/deck.pptx) | 9 slides, 3 sections, exported successfully |
| Session (.velocity) | [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/artifacts/session.velocity) | 9 slides and 3 sections present after `velocity_commit_deck` |
| Process log | [process_log.md](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/artifacts/summary.json) | Structured run metadata |

## 4. Issues and Friction

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | MCP exposed session export but not deck commit | Workflow | Critical | Session handoff was incomplete until a product fix was made |
| 2 | Default-heap build of richer 8-9 slide deck hit Node OOM | Engine / deliverable | High | Prevented a straightforward brief-compliant build on the first pass |
| 3 | Higher-heap retry on richer spec failed with `Invalid string length` | Workflow / architecture | High | Suggests `BuiltDeck` payloads can exceed practical MCP JSON limits |
| 4 | Demographic search query returned non-demographic variables | Semantic | Medium | Required manual inspection of variable inventory |
| 5 | Product defaults did not actively disambiguate body weight from sample weight | Product defaults | Low | Avoided only because the brief already warned about it |

## 5. Per-Layer Scorecard

See [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/scorecard.md).

## 6. Assessment Against Research Brief

| Dimension | Expected | Actual | Rating |
|---|---|---|---|
| Deliverable length | 8-12 slides | 9 slides | Check |
| Narrative structure | Coherent sections, not just tables | 3 sections with finding-based titles and notes | Check |
| Weight handling | Avoid false weighting on body-weight variable | No weighting applied | Check |
| Mental-health insight | Find anxiety/depression relationship to sleep | Strong anxiety and depression gradients by sleep quality | Check |
| Impact handling | Cover downstream impact of sleep problems | Final deck covered energy specifically; full 7-domain comparison stayed in process evidence after build-limit failure | Warning |
| Discovery quality | Use search/annotation to find variables | Topical discovery worked; demographic discovery needed manual support | Warning |

## 7. Difficulty Check

| Dimension | Expected rating | Actual experience | Surprise? |
|---|---|---|---|
| Dataset size | Low | Low | No |
| Naming quality | Medium | Medium | No |
| Domain specificity | Low-medium | Low-medium | No |
| Analysis complexity | Low | Low analytically, higher operationally | Yes |
| Deliverable expectations | Medium | Medium-high because richer deck specs hit build/serialization limits | Yes |

## 8. Severity Classification

`Significant`

This was a low-difficulty eval that still surfaced a critical workflow gap and a high-severity build/serialization ceiling, even though the final deliverable was produced successfully.

## 9. Outcome Pattern

- **Primary pattern:** `Pattern 2 — Good insight, painful workflow`
- **Secondary patterns:** `Pattern 4 — discovery weak for demographic navigation`; `Pattern 5a — product defaults weak`

## 10. Verdict

EVAL-01 ultimately passed with a strong 9-slide deck and a valid session handoff artifact, so the core end-to-end thesis is viable on a small friendly dataset. The most important finding is not analytical but product-level: deck/session round-trip now works through MCP after the new `velocity_commit_deck` tool, but richer deck builds still hit memory and serialization ceilings quickly enough that this path is not yet smooth or benchmark-stable.

## 11. Recommended Next Actions

- **Product fixes:** Reduce `buildDeck` response size over MCP or move to a handle/streaming model; add warnings or safer behavior around large multi-analysis slides; keep `velocity_commit_deck` as part of the stable MCP contract
- **Docs/guidance fixes:** Document the larger-heap workaround as temporary guidance if it is needed for local evals; add clearer guidance that demographic search may require describe-based fallback
- **Eval-design fixes:** Freeze this run as the current EVAL-01 MCP baseline, but note that the impact section is a narrowed version of the original brief because the multi-domain slide failed
- **Strategic questions:** Decide whether `buildDeck` is meant to be a transport-friendly agent primitive or whether larger deck generation should move to a server-side artifact workflow
