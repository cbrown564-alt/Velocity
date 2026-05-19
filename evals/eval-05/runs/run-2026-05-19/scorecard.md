# EVAL-05b Scorecard (S4-EVAL-5b)

| Layer | Score | Notes |
|---|---|---|
| Engine | 5 | Two workspace tables loaded; fuzzy mapping applied; harmonized UNION built for `21,324` rows without error. |
| MCP / workflow | 4 | Same methods available via `velocity_workspace_*` tools; this run used engine repro script directly. |
| Semantic layer | 4 | Real name drift and 0.7 label overlap exercised; discovery documented that `srh3_hse` is empty despite high name similarity. |
| Browser convergence | 3 | Playwright `eval:05b` blocked by multi-upload worker respawn; engine path validated separately. |
| Deliverable quality | 4 | Counts CSV and run JSON are reviewable; `_wave` markers and unmapped `85+` still require interpretation notes. |
| Product defaults | 4 | Auto-match correctly preferred exact `ageg5`; fuzzy override is manual but supported via `updateMapping` / engine remap. |
| Agent prompting | 4 | Run brief and mapping log make override intent explicit; discovery script documents candidate constructs. |

Overall outcome pattern: `pattern_7_end_to_end_success`

Regression note vs `run-2026-03-13`: MCP/workflow layer improved (2 → 4) because workspace engine tools now exist; semantic layer improved (3 → 4) because fuzzy matching was actually exercised.
