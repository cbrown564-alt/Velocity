# EVAL-02 Scorecard

| Layer | Score | Notes |
|---|---|---|
| Engine | 5 | Load, weighted crosstab, deck build, PPTX export, deck commit, and session export all worked correctly on a 654-variable survey with no runtime workaround. |
| MCP / workflow | 4 | The intended MCP path is now viable end-to-end for this task shape. The main reason this is not a 5 is that discovery still requires many manual inspection calls once search quality drops. |
| Semantic / discovery | 2 | EU and welfare topic queries were usable, but NHS, trust, and especially demographics returned the wrong top-ranked variables, which is the critical weakness for this eval. |
| Browser convergence | N/A | Not tested in this eval. |
| Deliverable quality | 5 | The run produced a strong 13-slide weighted deck with editorial titles, coherent sections, and a matching handoff session file. |
| Product defaults | 3 | The product identified `WtFactor`, but did not provide enough high-level guidance on good break variables or theme narrowing for a 654-variable survey. |
| Agent prompting | 4 | The brief and playbook supported a disciplined run through MCP; the remaining bottleneck was product discovery quality more than prompt framing. |

Overall outcome pattern: `pattern_4_agent_lost_in_discovery`
