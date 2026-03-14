# Eval 06: WVS Stress Run - Benchmark Result

Eval ID:        `EVAL-06`
Task family:    `F - stress and edge cases`
Brief:          [docs/eval_06_stress_wvs_brief.md](/Users/cobro/Code/Velocity/docs/eval_06_stress_wvs_brief.md)
Dataset:        `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav` - 97,220 respondents, 693 surfaced variables
Fallback:       `test_data/People_s Trust - A Survey-Based Experiment/trust.sav` - prepared but not needed
Agent:          `Browser upload + worker-backed chunked ingestion + bounded weighted analysis`
Date:           `2026-03-13`
Method:         `Live browser upload of WVS into the production large-SAV flow, metadata-first viability check, full chunked v3 load, then one bounded weighted findings pass on happiness and generalized trust`
Primary artifact: [artifacts/findings_summary.md](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/findings_summary.md) - weighted findings summary for WVS happiness and trust

## 1. Process Timeline

| Phase | Workflow action | Result |
|---|---|---|
| Load gate | Browser upload of `WVS_Cross-National_Wave_7_spss_v6_0.sav` (`176.6 MB`) | Product entered sampled metadata mode rather than failing or freezing |
| Viability check | Metadata sample parsed `1,000 / 97,220` rows and surfaced `693` variables / `502` variable sets | WVS was judged viable inside the first few workflow steps, so fallback was not activated |
| Orientation | Simple in-surface label search over the surfaced metadata for `happiness`, `trust`, and `government` | Bounded targets were identifiable immediately: `Q46`, `Q57`, and `Q71` all surfaced cleanly |
| Full load | Click `Load Full Data` from the metadata screen | Worker auto-routed to chunked single-pass v3 load and completed `97,220` rows in `21` chunks / `12.8 s` |
| Analyze | Apply `W_WEIGHT`, run weighted frequency for `Q46`, then weighted crosstab `Q46 x Q57` | Produced a reviewable happiness baseline plus a bounded trust/happiness stress read |
| Persist | Export findings summary, CSV artifacts, raw run JSON, and browser session | Portable session saved at [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/session.velocity) |

### False starts / deviations

1. No fallback was required. The primary WVS path stayed viable, so `trust.sav` remained unused.
2. The repeatable harness still used in-page store actions for weighted analysis and session export rather than literal click-level UI manipulation. This stayed on the real browser substrate but remains thinner than a full human walkthrough.

## 2. Key Decisions

- **Go / no-go call:** stay on WVS because the metadata gate succeeded immediately and the full load completed without parse or ingestion failure
- **Theme chosen:** `Happiness and generalized trust`
- **Variables selected:** `Q46` (`Feeling of happiness`), `Q57` (`Most people can be trusted`), `W_WEIGHT`
- **Variables considered but not expanded into the run:** `Q71` (`Confidence: The Government`) surfaced cleanly during orientation but was left out to keep the output bounded
- **Fallback decision:** `trust.sav` was intentionally not used because the brief only activates fallback on WVS failure or non-viability
- **Deliverable shape:** findings summary + CSV + session instead of a deck, consistent with the brief's stress-first framing

## 3. Stress Read

The important result is that WVS no longer collapses the browser path at ingestion time. The run hit the intended large-file guardrail, passed through metadata mode, then completed a full worker-backed chunked load without bespoke repair work.

Within the bounded trust theme, the weighted pattern was directionally clear:

- Overall weighted happiness was strongly positive: `31.2%` very happy and `54.4%` quite happy
- Among respondents who said most people can be trusted, `90.9%` were weighted happy / quite happy
- Among respondents who said one must be very careful, that combined weighted happy / quite happy share dropped to `84.0%`
- The weighted crosstab signal was real but moderate in effect size: chi-square `720.5`, `df = 3`, `Cramer's V = 0.087`

This is exactly the kind of bounded success the brief asked for: not a full WVS benchmark deck, but a real, reviewable stress-case analysis that stayed on the product path.

## 4. Artifacts Produced

| Artifact | Path | Description |
|---|---|---|
| Findings summary | [artifacts/findings_summary.md](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/findings_summary.md) | Primary human-facing stress-run summary |
| Happiness frequency CSV | [artifacts/happiness_overall.csv](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/happiness_overall.csv) | Weighted overall distribution for `Q46` |
| Happiness by trust CSV | [artifacts/happiness_by_generalized_trust.csv](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/happiness_by_generalized_trust.csv) | Weighted `Q46 x Q57` result |
| Stress run detail JSON | [artifacts/stress_run.json](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/stress_run.json) | Raw viability, load, discovery, and analysis metadata |
| Browser session (.velocity) | [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/session.velocity) | Portable session capturing the weighted stress analysis state |
| Process log | [process_log.md](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/process_log.md) | This benchmark result |
| Scorecard | [scorecard.md](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/scorecard.md) | Per-layer scoring |
| Capability gap review | [gap_review.md](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/gap_review.md) | Strategic interpretation |
| Summary JSON | [artifacts/summary.json](/Users/cobro/Code/Velocity/evals/eval-06/runs/run-2026-03-13/artifacts/summary.json) | Structured run metadata |

## 5. Issues and Friction

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | The successful path is browser-real, but the broader Node / CLI stress story for this exact WVS file is still historically weaker because metadata fallback has depended on `jsavvy` in other contexts | Interface / workflow | Medium | This run validates the browser product path, not universal ingestion parity across every surface |
| 2 | Large-SAV handling still requires a metadata-first handoff before the user can choose to load full data | Product defaults | Low | The guardrail worked well here, but it remains an extra decision point in the stress path |
| 3 | The repeatable harness still uses in-page store actions for analysis and session export rather than a literal click-by-click walkthrough | Eval harness only | Low | The run stayed on the live product substrate, but the automation remains thinner than a human interaction trace |

## 6. Assessment Against Brief

| Requirement | Result | Rating |
|---|---|---|
| Attempt WVS first | Yes | Check |
| Make a quick viability call in the first 5-10 steps | Yes - metadata sample and label orientation succeeded immediately | Check |
| Fall back only if WVS is blocked | Not needed - WVS stayed viable | Check |
| Complete a bounded output, not a full benchmark deck | Yes - findings summary, CSVs, and session export | Check |
| Keep the run reviewable and diagnosable | Yes - load, discovery, and weighted analysis evidence all captured on disk | Check |

## 7. Severity Classification

`Passing`

This run completed the primary stress path on WVS itself and produced bounded reviewable output without any blocker fix or emergency fallback.

## 8. Outcome Pattern

- **Primary pattern:** `Pattern 7 - end-to-end success`
- **Secondary signal:** `Pattern 2 - the browser path remains more straightforward than the broader agent-native story on this exact stress dataset`

## 9. Verdict

`EVAL-06` closes the last open execution family in S4-EVAL-3. WVS Wave 7 was no longer just a hypothetical or blocked stress case: the browser path loaded it through the intended metadata gate, completed a full chunked ingest, surfaced bounded discovery candidates, ran a weighted analysis, and exported a portable session. The fallback plan remained valuable, but it was not needed.

That does not mean every WVS surface is equally mature. The key remaining caveat is access-path asymmetry: the browser stress path is now execution-real, while the broader agent-native / CLI story on this file still needs parity work. But Phase 4's execution question for family `F` is answered.

## 10. Recommended Next Actions

- Freeze this run as the stress baseline and move to `S4-EVAL-4` synthesis
- Bring the agent-native / MCP / CLI ingestion story for WVS into line with the now-proven browser path
- Investigate and document the raw-parser `613` variables vs surfaced `693` variables distinction so future stress runs can explain the heuristic expansion layer explicitly
