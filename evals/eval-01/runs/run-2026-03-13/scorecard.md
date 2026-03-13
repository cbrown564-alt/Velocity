# EVAL-01 Scorecard

| Layer | Score | Notes |
|---|---|---|
| Engine | 4 | Core load, describe, crosstab, build, export, and session logic produced correct outputs on `sleep.sav`. The main drag was deck-build memory/serialization pressure on richer specs rather than incorrect statistics. |
| MCP / workflow | 2 | The intended path was initially blocked because MCP exposed `velocity_export_session` but not deck commit. The run also required a larger Node heap workaround for the final 9-slide build. |
| Semantic / discovery | 3 | Search surfaced sleep and mental-health variables well, but demographic discovery was weak; the `"sex age marital education..."` query returned `stressmonth` and impact items instead of break variables. |
| Browser convergence | N/A | Not tested in this eval. |
| Deliverable quality | 4 | The final artifact is a coherent 9-slide PPTX with 3 sections, finding-based titles, and session handoff. The main compromise was narrowing the impact section to a single-domain slide after the multi-domain slide failed. |
| Product defaults | 3 | Suggestions and defaults were usable but shallow. They over-emphasized sex comparisons, did not guide around the body-weight pitfall, and offered no warning about build-size limits. |
| Agent prompting | 3 | The brief and playbook were directionally strong, but the checked-in MCP workflow docs initially omitted the required deck-commit step for session round-trip. |

Overall outcome pattern: `pattern_2_good_insight_painful_workflow`
