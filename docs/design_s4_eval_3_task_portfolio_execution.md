# S4-EVAL-3 Design Brief: Task Portfolio Execution

## 1. Scope and Objective

S4-EVAL-3 executes the full six-brief Phase 4 task portfolio (`EVAL-01` through `EVAL-06`) through the intended product path and leaves behind the standardized evidence package for each run:

- Output A: benchmark result (`process_log.md` + `scorecard.md`)
- Output B: capability-gap review (`gap_review.md`)
- Structured run metadata (`artifacts/summary.json`)

This stream is now an in-flight execution brief, not a pre-run kickoff note. `EVAL-01` and `EVAL-02` have already been completed through MCP and should be treated as the first locked baselines for the portfolio.

**Done checks** (from the Phase 4 plan):
- Each task family (A-F) has at least one executed eval
- At least one task family is re-run after product changes
- Failures are logged as product evidence, not just anecdotes

## 2. Current Execution State

**Completed runs on disk:**
- `EVAL-01` (`evals/eval-01/runs/run-2026-03-13/`): successful 9-slide MCP deck + session run on `sleep.sav`; surfaced a real workflow blocker and a build/transport ceiling
- `EVAL-02` (`evals/eval-02/runs/run-2026-03-13/`): successful 13-slide weighted MCP deck + session run on BSA 2017; isolated semantic discovery as the main remaining weakness at large-survey scale

**What changed during S4-EVAL-3 already:**
- The stream is no longer "execution only" in the strictest sense. `EVAL-01` discovered that MCP exposed session export but not deck commit, so `velocity_commit_deck` was added and covered in:
  - `mcp-server/tools.ts`
  - `mcp-server/__tests__/tools.test.ts`
  - `tests/e2e/agentWorkflow.test.ts`
  - `docs/guide_agent_quickstart.md`
  - `docs/playbooks/agent_analysis_workflow.md`
- The tracker is therefore correct to mark `S4-EVAL-3` as `Contract change: Yes`.

**Current program read:**
- MCP deck/session round-trip is now real on both a small survey (`EVAL-01`) and a 654-variable weighted survey (`EVAL-02`)
- No eval has yet delivered a clean primary `Pattern 7` baseline; `EVAL-02` includes a secondary Pattern 7 signal, but its primary result is still `Pattern 4` because large-survey discovery remains materially weak
- Remaining execution work is concentrated in families `C-F`: handoff, browser convergence, harmonization, and stress

## 3. Portfolio Status

| Eval | Family | Dataset / artifact | Status | Current read | Next dependency |
|---|---|---|---|---|---|
| `EVAL-01` | B (deck) | `test_data/sleep.sav` | Done | End-to-end MCP deck + session works, but richer deck builds exposed memory and JSON transport limits | Use its session artifact as the baseline for `EVAL-03` |
| `EVAL-02` | A (discovery) | `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav` | Done | Weighted large-survey execution path is viable; semantic discovery is still the bottleneck | Freeze as the large-survey baseline for later comparison |
| `EVAL-03` | C (handoff) | Reuse `EVAL-01` session | Pending | Now unblocked by `velocity_commit_deck`; should validate browser import, refinement, and re-export | Requires a controlled browser refinement pass |
| `EVAL-04` | D (convergence) | `test_data/sleep.sav` | Pending | Should quantify whether browser users still have materially stronger effective affordances | Requires one browser-only run and one MCP-only run of the same task |
| `EVAL-05` | E (harmonization) | `test_data/English Longitudinal Study of Ageing/` | Pending | Dataset is available locally, but the eval still carries the highest workspace/workflow ambiguity | Requires bounded file selection and strict no-improvisation discipline |
| `EVAL-06` | F (stress) | `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav` with Trust fallback | Pending | Best stress case remains WVS; fallback path is ready if ingestion fails | Requires a quick viability check, then immediate fallback if blocked |

## 4. Remaining Execution Plan

**Sequencing:** keep the original dependency-first order, but start from the now-unblocked handoff path.

| Order | Eval | Why now | Success signal |
|---|---|---|---|
| 1 | `EVAL-03` | Directly exercises the new deck/session contract change from `EVAL-01` while the baseline artifact is fresh and small | Session imports cleanly in the browser, human makes additive refinements, refined session re-exports |
| 2 | `EVAL-04` | Reuses the same `sleep.sav` task shape and browser familiarity from `EVAL-03` | Browser vs MCP comparison identifies explicit parity gaps rather than vague "browser felt better" claims |
| 3 | `EVAL-05` | Highest-value remaining capability test outside single-dataset deck work | Agent reaches a reviewable mapping flow and produces a harmonized output or records a crisp intended-path block |
| 4 | `EVAL-06` | Best final resilience pass after the other workflow layers have been exercised | WVS yields a bounded analysis, or fallback activates cleanly with documented evidence |

### Recommended execution details

#### `EVAL-03`

- Use `evals/eval-01/runs/run-2026-03-13/artifacts/session.velocity` as the agent baseline
- Record the exact browser refinements required by the brief:
  - reorder one slide
  - edit one title or note
  - add one follow-up analysis or slide
- Treat any missing filters, missing notes, dropped sections, or semantic-state loss as first-class evidence

#### `EVAL-04`

- Keep the browser and agent task tightly scoped to the same 5-slide assignment in `docs/eval_04_browser_vs_agent_convergence_brief.md`
- Do not let either path expand into a nicer-but-different deck; comparability matters more than local quality
- Log total effort, workarounds, and "last-minute edit" friction explicitly

#### `EVAL-05`

- The ELSA directory is present locally with multiple candidate wave files
- To keep the eval bounded, choose two closely related files before starting and document the choice in `brief.md` / `summary.json`
- Preferred direction: start with adjacent derived-variable or similarly scoped wave files so the eval tests harmonization workflow rather than arbitrary file mismatch
- If the harmonization path becomes opaque or requires bespoke glue code, record the run as blocked rather than inventing a substitute workflow

#### `EVAL-06`

- Attempt the WVS file first and make a quick go/no-go call in the first 5-10 workflow steps
- If parsing or viability fails, switch immediately to `test_data/People_s Trust - A Survey-Based Experiment/trust.sav`
- Preserve the exact WVS failure in both `process_log.md` and `artifacts/summary.json`

## 5. Artifact Contract Per Eval

Each eval still produces the same evidence package under `evals/eval-{NN}/runs/run-YYYY-MM-DD/`:

```text
brief.md
process_log.md
scorecard.md
gap_review.md
artifacts/
  deck.pptx          (or primary artifact if deck is not the right output)
  session.velocity   (when the workflow reaches the persist step)
  summary.json
```

Normalization rules remain unchanged:

- Always create `artifacts/`, even for blocked runs
- If an artifact is absent, record why in `summary.json`
- Keep one run directory per date unless a rerun is necessary; then suffix `-a`, `-b`, etc.

## 6. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Deck build / MCP transport ceiling** (confirmed in `EVAL-01`) | High | Keep `EVAL-03` and `EVAL-04` deck scopes deliberately small; if a richer spec fails, record it as product evidence rather than expanding workarounds |
| **Large-survey discovery remains weak** (confirmed in `EVAL-02`) | High | Accept some disciplined manual variable curation, but log every place where search or suggestions fail to provide the expected shortlist |
| **Browser-path reproducibility drift** | Medium | Record browser actions step-by-step in `process_log.md` so `EVAL-03` and `EVAL-04` remain reviewable and repeatable |
| **Harmonization workflow ambiguity** | High | Pre-commit to a bounded two-file ELSA slice; if the intended mapping/review path is not understandable, mark the run blocked instead of improvising |
| **WVS ingestion or viability failure** | High | Switch immediately to Trust per the brief; do not debug ReadStat-WASM in the middle of the eval |

## 7. Invariants Touched

- **Execution-first, but blocker fixes are allowed.** S4-EVAL-3 began as a pure execution stream, but it already triggered one legitimate MCP contract change (`velocity_commit_deck`) because the intended path was incomplete without it.
- **Further code changes must stay minimal and blocker-driven.** If another blocker appears, fix only what is required to restore the intended path, add focused test coverage, then resume the portfolio.
- **Phase 4 interpretation rules still apply.** Every run must separate:
  - rough-edge fixes
  - capability expansion
  - interface or architecture re-engineering
  - scope/thesis revision

## 8. Gate Strategy

Tracker gates remain `U, I, A`.

- **U (unit):** required only for any new blocker fix introduced during the remaining evals
- **I (integration):** the eval runs themselves are the primary integration evidence for MCP -> Engine -> export -> session -> browser/harmonization paths
- **A (architecture):** every `gap_review.md` must classify the core findings using the capability-gap framework and respect the engine/MCP/browser seam

## 9. Definition of Done

S4-EVAL-3 is complete when:

1. `EVAL-01` through `EVAL-06` each have a dated run directory with the required evidence package or an explicit blocked outcome
2. Every task family (`A-F`) has at least one executed eval, not just a written brief
3. At least one rerun or follow-on eval demonstrates the impact of the `velocity_commit_deck` contract change on the intended path
4. The remaining open failures are captured as scoped product evidence, not hidden inside anecdotal notes
5. `docs/tracker_00_implementation_status.md` can move `S4-EVAL-3` from `In progress` to `Done` with links to all six evidence packages

## 10. Recommended Immediate Next Action

**Execute `EVAL-03` next using the completed `EVAL-01` session artifact.**

Why this is the right next move:

- it directly validates the blocker fix that `EVAL-01` forced into the MCP contract
- it keeps the task on the smallest, most controlled dataset
- it creates the browser-path muscle memory needed for `EVAL-04`
- it tests the human-agent collaboration claim before moving into the more ambiguous harmonization and stress runs

If `EVAL-03` shows that session import/refinement is still lossy, pause there and treat it as the next product blocker. If it succeeds, proceed immediately to `EVAL-04`.

## 11. Reference Documents

| Document | Purpose |
|---|---|
| `docs/plan_phase4_agent_capability_validation.md` | Phase 4 mandate and done checks |
| `docs/eval_00_agent_interface_validation.md` | What the eval program is fundamentally validating |
| `docs/eval_00_outcome_decision_framework.md` | Layer scoring and outcome-pattern interpretation |
| `docs/eval_00_capability_gap_review.md` | Strategic classification of gaps |
| `docs/eval_00_task_portfolio.md` | Portfolio coverage and family mapping |
| `evals/README.md` | Run artifact directory contract |
| `docs/eval_00_run_summary_schema.ts` | `summary.json` schema |
| `docs/eval_03_session_handoff_roundtrip_brief.md` | Next execution target |
| `docs/eval_04_browser_vs_agent_convergence_brief.md` | Controlled browser-vs-agent comparison brief |
| `docs/eval_05_cross_wave_harmonization_brief.md` | Harmonization eval brief |
| `docs/eval_06_stress_wvs_brief.md` | Stress / fallback eval brief |
| `evals/eval-01/runs/run-2026-03-13/process_log.md` | Current small-survey MCP baseline |
| `evals/eval-01/runs/run-2026-03-13/gap_review.md` | `EVAL-01` strategic interpretation |
| `evals/eval-02/runs/run-2026-03-13/process_log.md` | Current large-survey MCP baseline |
| `evals/eval-02/runs/run-2026-03-13/gap_review.md` | `EVAL-02` strategic interpretation |
