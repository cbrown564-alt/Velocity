# EVAL-06 Scorecard

| Layer | Score | Notes |
|---|---|---|
| Engine | 5 | WVS (`176.6 MB`) passed the metadata gate, then completed the worker-backed chunked v3 load in `21` chunks / `12.8 s` without parse or stability failure. |
| MCP / workflow | 2 | The successful stress path is browser-real, but this exact dataset still does not have equally strong evidence across the broader agent-native / CLI surfaces. |
| Semantic / discovery | 3 | Bounded label-level orientation worked: `happiness`, `trust`, and `government` surfaced usable targets immediately. Broader exploratory discovery across hundreds of code-heavy variables remains largely untested here. |
| Browser convergence | 4 | The browser path handled the large-file gate, full load, weighted analysis, and session export cleanly, though the repeatable harness still leans on in-page store actions rather than literal click-level interaction. |
| Deliverable quality | 4 | The run left behind a reviewable findings summary, CSV evidence, raw run metadata, and a portable session, but not a more polished first-class stress-report export. |
| Product defaults | 4 | The metadata-first large-file guardrail and automatic chunked routing behaved exactly as intended on WVS, though the extra handoff step still adds friction. |
| Agent prompting | 4 | Tight scope control prevented the eval from turning into ad hoc WVS exploration and kept the stress result attributable. |

Overall outcome pattern: `pattern_7_end_to_end_success`
