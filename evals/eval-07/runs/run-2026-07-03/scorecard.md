# EVAL-07 Scorecard

| Layer | Score | Notes |
|---|---|---|
| Engine | 5 | Weighted crosstabs and significance reproduce the committed ground truth within 0.1pt across Waves 4/3/5, including the Beacon-over-Meridian rank fact. |
| MCP / workflow | 4 | The full raw → analysis-ready → deck recipe and the wave-5 refresh run on shipped primitives with zero manual repair; the one named limitation is cross-dataset recode replay (RECIPE-REPLAY / INF-04), correctly deferred. |
| Semantic / discovery | 4 | Weight discovery cleanly picks the genuine rim weight (`wt` / `rim_wt_final`, mean ≈ 1.0) over the `body_weight_kg` decoy; derived T2B / NPS nets still require explicit recodes. |
| Browser convergence | N/A | EVAL-07 is a pilot-archetype baseline, not a browser-vs-agent convergence test. |
| Deliverable quality | 5 | An 18-slide story-template deck with ground-truth action titles and an honest "broadly stable" defensibility slide; portable session with a replayable transformLog. |
| Product defaults | 4 | `brandtracker_w4.sav` is the primary Load Example and the first crosstab defaults to a funnel-relevant cut (brand preference × segment); recipe-derived nets still do not survive wave replacement. |
| Agent prompting | 4 | The planted story is deterministic and auditable, so any gap is attributable to product surface rather than prompt drift. |

Overall outcome pattern: `pattern_7_end_to_end_success`
