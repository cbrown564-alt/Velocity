# S4-EVAL-3 Design Brief: Task Portfolio Execution

## 1. Scope and Objective

S4-EVAL-3 requires executing all six eval briefs (EVAL-01 through EVAL-06) through the intended MCP tool path, producing the standardized evidence package for each: benchmark result (Output A) and capability-gap review (Output B).

**Done checks** (from the plan):
- Each task family (A–F) has at least one executed eval
- At least one task family is re-run after product changes
- Failures are logged as product evidence, not just anecdotes

## 2. Current State Assessment

**Ready:**
- All 6 eval briefs are written and checked in
- MCP server is configured in `.claude/settings.json` with correct `node --import tsx` invocation
- Setup script exists (`scripts/velocity-mcp-setup.mjs`)
- Quickstart guide and analysis playbook are comprehensive and aligned to the MCP path
- Eval artifact structure is defined (`evals/README.md`) with `EvalRunSummary` schema
- Benchmark result template, scorecard rubric, and gap review structure are all finalized
- All 6 datasets are present locally (sleep.sav, BSA 2017, ELSA waves, WVS Wave 7, Trust)

**Prior art:**
- EVAL-02 was run once (2026-03-12) but via CLI scripts, not MCP. Process log exists at `docs/eval_02_process_log.md`. Key findings: MCP server was not configured (now fixed), semantic search good for topic but weak for category-level queries, chi-square statistic field `undefined`, session export failed.

## 3. Execution Plan

**Sequencing:** Run evals in dependency order — simpler evals first to shake out remaining MCP friction, complex evals later.

| Order | Eval | Family | Dataset | Risk level | Rationale |
|---|---|---|---|---|---|
| 1 | EVAL-01 | B (deck) | sleep.sav | Low | Small dataset, known pitfalls, validates MCP path end-to-end |
| 2 | EVAL-02 | A (discovery) | BSA 2017 | Medium | Rerun through MCP (vs prior CLI run), validates discovery at scale |
| 3 | EVAL-03 | C (handoff) | Reuse EVAL-01 output | Medium | Depends on EVAL-01 session artifact; tests round-trip |
| 4 | EVAL-04 | D (convergence) | sleep.sav | Medium | Requires both browser and agent runs; browser path is manual |
| 5 | EVAL-05 | E (harmonization) | ELSA waves | High | Workspace maturity risk; harmonization MCP tools untested in real eval |
| 6 | EVAL-06 | F (stress) | WVS Wave 7 | High | Known parse issues; fallback to Trust dataset defined |

## 4. Artifact Contract Per Eval

Each eval produces the following under `evals/eval-{NN}/runs/run-YYYY-MM-DD/`:

```
brief.md          — Copy of or link to the eval brief
process_log.md    — Benchmark result (Output A) using eval_00_benchmark_result_template.md
scorecard.md      — Per-layer 1-5 scores
gap_review.md     — Capability-gap review (Output B) using eval_00_capability_gap_review.md
artifacts/
  deck.pptx       — Exported deck (or primary artifact)
  session.velocity — Exported session file
  summary.json    — EvalRunSummary per eval_00_run_summary_schema.ts
```

## 5. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Session export bug** (`.data` undefined, seen in EVAL-02) | High | Must verify fix before EVAL-03 depends on it. If still broken, treat as product blocker — fix before continuing. |
| **EVAL-04 requires manual browser run** | Medium | Keep task deliberately small (5-slide deck on sleep.sav). Document browser workflow step-by-step so it's reproducible. |
| **EVAL-05 workspace immaturity** | High | If harmonization MCP tools cannot complete the intended path, record as blocked (not improvised). The brief explicitly says to record rather than substitute. |
| **EVAL-06 WVS parse failure** | High | Fallback to Trust dataset is already defined in the brief. Switch immediately on parse failure; don't debug ReadStat-WASM mid-eval. |
| **Chi-square statistic undefined** | Low | Note in process logs if still present. Not a blocker for benchmark scoring. |
| **MCP server startup reliability** | Medium | Run `npm run velocity-mcp-setup` validation before first eval. If it fails, fix before proceeding. |

## 6. Invariants Touched

- **No contract changes.** S4-EVAL-3 is execution, not engineering. The tracker marks `Contract change: No`.
- **No code changes unless a product blocker is discovered.** If a blocker (e.g., session export bug) is found, fix it with minimal scope, commit, then resume the eval. Do not scope-creep into feature work during eval execution.
- Engine boundary, dual-state model, and provenance rules remain untouched.

## 7. Test Strategy

Gates required: `U, I, A` per tracker.
- **U (unit):** Not directly applicable — evals produce artifacts, not code. However, if any product fix is made mid-flight, it must have unit test coverage.
- **I (integration):** Each eval is itself an integration test of the full MCP → Engine → DuckDB path.
- **A (architecture):** Each gap_review.md must classify findings per the four response classes. Each scorecard must score all 7 layers.

## 8. Definition of Done

S4-EVAL-3 is complete when:
1. All 6 evals have `evals/eval-{NN}/runs/run-YYYY-MM-DD/` directories with the required artifact set
2. Every eval has both Output A (benchmark result) and Output B (capability-gap review)
3. Blocked evals are explicitly recorded as blocked with reasons (not silently skipped)
4. At least one eval achieves Pattern 7 (end-to-end success) — likely EVAL-01 on sleep.sav
5. The tracker is updated: `S4-EVAL-3` status moves to `Done` with evidence links

## 9. Recommended Immediate Next Action

**Start with EVAL-01 (Sleep Health Study) through the MCP path.**

This is the lowest-risk eval, uses a small familiar dataset, and will immediately validate:
- MCP server starts and responds
- The full load → describe → annotate → search → analyze → build deck → export → session workflow
- Whether the session export bug from EVAL-02 is fixed
- Whether the chi-square statistic issue persists

If EVAL-01 succeeds cleanly, proceed to EVAL-02 rerun. If it hits blockers, fix them before continuing — they will affect every downstream eval.

## 10. Reference Documents

The implementer must read these before starting execution:

| Document | Purpose |
|---|---|
| `docs/guide_agent_quickstart.md` | MCP tool reference, parameters, output formats |
| `docs/playbooks/agent_analysis_workflow.md` | Step-by-step analysis procedure |
| `docs/eval_00_benchmark_result_template.md` | Output A template (process log + scorecard) |
| `docs/eval_00_capability_gap_review.md` | Output B template (strategic gap review) |
| `docs/eval_00_outcome_decision_framework.md` | Scoring rubric (1-5 per layer), severity classification, outcome patterns |
| `docs/eval_00_run_summary_schema.ts` | `summary.json` TypeScript schema |
| `evals/README.md` | Artifact directory structure |
| `docs/eval_01_sleep_research_brief.md` | EVAL-01 brief (start here) |
| `docs/eval_02_bsa2017_research_brief.md` | EVAL-02 brief |
| `docs/eval_03_session_handoff_roundtrip_brief.md` | EVAL-03 brief |
| `docs/eval_04_browser_vs_agent_convergence_brief.md` | EVAL-04 brief |
| `docs/eval_05_cross_wave_harmonization_brief.md` | EVAL-05 brief |
| `docs/eval_06_stress_wvs_brief.md` | EVAL-06 brief |
| `docs/eval_02_process_log.md` | Prior EVAL-02 run (CLI, not MCP) — reference for known issues |
