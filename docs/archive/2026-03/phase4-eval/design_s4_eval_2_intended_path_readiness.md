# S4-EVAL-2 Design Brief: Intended-Path Readiness

**Author role:** Architect
**Date:** 2026-03-12
**Status:** Proposal
**Depends on:** S4-EVAL-1 (Done)
**Contract change:** Yes (ResultEnvelope consistency, session export behavior, new MCP config artifact)
**Gates:** T, L, U, I, A

---

## 1. Purpose

S4-EVAL-2 exists to answer one question: **Can an agent follow the intended product path without undocumented detours?**

Eval 02 proved the engine works. It also proved the agent couldn't use the intended workflow — MCP wasn't configured, session export failed, `describe()` wasn't wrapped in a ResultEnvelope, and the agent had to write three TypeScript driver scripts to complete the task. Those aren't product bugs in the traditional sense. They're interface-thesis blockers: if the intended path isn't testable, eval results from S4-EVAL-3 will be uninterpretable.

This workstream removes those blockers and writes the remaining eval briefs (families C–F) that depend on intended-path clarity.

---

## 2. Scope

### In scope

1. **MCP setup reliability** — zero-detour path from "I have Claude Code" to "MCP tools work"
2. **ResultEnvelope consistency** — every engine method that returns data wraps it uniformly
3. **Session round-trip** — `exportSession()` → file → `importSession()` works end-to-end, including semantic state restoration
4. **Docs/playbook alignment** — quickstart and workflow playbook teach the real intended path, not an aspirational one
5. **Eval brief completion** — write briefs for EVAL-03 through EVAL-06 (families C–F)
6. **Artifact capture contract** — define what files every eval run must produce and where they go

### Out of scope (deferred to S4-EVAL-3 or later)

- Presentation-layer category suppression (benchmark plan workstream 2) — product improvement, not path readiness
- Chart-first deck ergonomics (benchmark plan workstream 3) — same
- Semantic search category filters — capability expansion, not intended-path fix
- Crosstab summary formatting — nice-to-have, not a path blocker
- Chi-square statistic bug — low severity, doesn't block evals

---

## 3. Approach

Six workstreams, ordered by dependency. WS1–WS3 are engineering. WS4–WS5 are documentation. WS6 is eval authoring.

### WS1: MCP Server Zero-Config Setup

**Problem:** Eval 02 couldn't use MCP because the server wasn't registered in Claude Code settings. The server code is ready — it just needs configuration.

**Changes:**

1. Add a `claude_desktop_config.json` snippet or equivalent MCP registration to the repo root (e.g., `.claude/settings.json` or documented `mcp_servers` entry).
2. Add a `velocity-mcp-setup` npm script that validates the MCP server starts and responds to `initialize`.
3. Document the exact one-line setup in `guide_agent_quickstart.md` §0 (before the current §1 "Core Workflow").
4. Verify the MCP server starts cleanly with `npx tsx mcp-server/index.ts` — no missing deps, no startup errors.

**Invariants touched:** None — this is configuration, not engine logic.

**Risk:** Claude Code MCP server registration format may change. Mitigation: document the manual fallback alongside the automated path.

### WS2: ResultEnvelope Consistency

**Problem:** `describe()` returns a flat object. `exportSession()` returns a raw `VelocitySessionFile`. Other methods return `ResultEnvelope<T>`. This inconsistency forced trial-and-error probing in Eval 02.

**Changes:**

1. Wrap `describe()` in `ResultEnvelope<DatasetDescription>`.
2. Wrap `exportSession()` in `ResultEnvelope<VelocitySessionFile>`.
3. Wrap `getSession()` similarly if it's a public method.
4. Audit all public `VelocityEngine` methods and confirm every data-returning method uses `ResultEnvelope`. Methods that mutate state (`addFilter`, `setWeight`, `clearFilters`) remain void — they are not data-returning.
5. Update MCP tool handlers in `mcp-server/tools.ts` to unwrap consistently (they already handle envelopes — just ensure the new wrapping doesn't double-wrap).

**Invariants touched:**
- `ResultEnvelope` provenance contract (arch_07 §4) — this enforces it, doesn't change it.
- **Contract change: Yes.** `describe()` return type changes from `DatasetDescription` to `ResultEnvelope<DatasetDescription>`. `exportSession()` return type changes from `VelocitySessionFile` to `ResultEnvelope<VelocitySessionFile>`. Callers in MCP server and tests must be updated.

**Risk:** Breaking existing callers of `describe()` and `exportSession()`. Mitigation: grep all call sites (MCP tools, CLI, tests, engine internal uses) and update in the same PR.

### WS3: Session Round-Trip Fix

**Problem:** `exportSession()` returned undefined `.data` in Eval 02. `importSession()` exists but doesn't restore semantic state. The round-trip is aspirational, not tested end-to-end.

**Changes:**

1. **Fix the export bug.** Investigate why `.data` was undefined — likely a ResultEnvelope unwrapping issue in the MCP handler or a missing return. (WS2's wrapping work may fix this implicitly.)
2. **Call `restoreSemanticState()` during `importSession()`.** The method exists at VelocityEngine.ts:843–855 but is never invoked. Wire it into the import path after `importSessionFile()` runs.
3. **Add a serialization helper to the MCP tool.** Currently `exportSession()` returns the object; the agent must serialize to JSON and write to disk manually. The MCP `velocity_export_session` handler should accept an optional `outputPath` parameter and write the `.velocity` file directly.
4. **Add an end-to-end round-trip integration test:**
   - Load a dataset
   - Run an analysis, build a deck, set filters/weight, annotate variables
   - Export session
   - Create a fresh engine instance
   - Load the same dataset
   - Import the session
   - Verify: filters, weight, slides, sections, semantic annotations all restored
   - Verify: diagnostics report is accurate (no false positives/negatives)

**Invariants touched:**
- Session format stability (AGENTS.md §2.7) — no format change, just correct usage of existing v2 format.
- Engine boundary — session logic stays in `src/core/session/`, engine orchestrates.

**Risk:** Semantic state restoration may conflict with annotations from a fresh `annotateDataset()` call on the new engine instance. Decision: imported session state should **merge** with existing state, not replace it. Imported annotations take precedence for variables that appear in both.

### WS4: Quickstart and Playbook Alignment

**Problem:** The quickstart teaches the correct tool sequence but:
- Has no §0 for setup/configuration
- Uses `visualizationType: "table"` in examples (biases toward tables)
- Doesn't mention common failure modes from Eval 02
- The agent analysis workflow playbook doesn't warn about category-level search limitations

**Changes:**

1. Add §0 "Setup" to `guide_agent_quickstart.md` with MCP registration instructions.
2. Change the `velocity_build_deck` example in the quickstart to use `visualizationType: "chart"` for at least half the slides.
3. Add a "Known Limitations" or "Watch Out For" subsection to §5 "Common Patterns":
   - Semantic search works for topic queries, not category-level queries (use `describe()` + name patterns for demographics)
   - `describe()` returns the full variable list — for datasets with 500+ variables, use search rather than scanning
   - Some variables have ~75% missing due to split-sample design — this is normal, not broken
4. Update `playbooks/agent_analysis_workflow.md` Phase 5 (Export & Persist) to document the actual expected behavior of `velocity_export_session` — what's in the file, what's not, and how a human opens it.

**Invariants touched:** None — documentation only.

### WS5: Artifact Capture Contract

**Problem:** S4-EVAL-3 requires standardized eval outputs. Currently there's no defined artifact structure or output location.

**Changes:**

1. Define the canonical artifact directory structure:
   ```
   evals/
     eval-01/
       runs/
         run-YYYY-MM-DD/
           brief.md           (copy of or link to eval brief)
           process_log.md     (what happened, decisions, observations)
           scorecard.md       (per-layer scores using outcome framework rubric)
           gap_review.md      (capability-gap assessment)
           artifacts/
             deck.pptx        (or .xlsx)
             session.velocity  (exported session file)
             summary.json     (structured run metadata: tool call count, duration, scores)
   ```
2. Create `evals/README.md` documenting this structure.
3. Create a `summary.json` schema (TypeScript interface in `docs/eval_00_run_summary_schema.ts` or similar) so run metadata is machine-comparable.

**Invariants touched:** None — new directory, no code changes.

### WS6: Eval Brief Completion (EVAL-03 through EVAL-06)

**Problem:** Families C–F have planned entries in the task portfolio but no written briefs. S4-EVAL-3 cannot execute evals without briefs.

**Changes:**

Write four eval briefs following the pattern established by EVAL-01 and EVAL-02:

1. **EVAL-03 (Session Handoff Round-Trip):** Define the exact task — agent produces a deck from EVAL-01 or EVAL-02 output, exports session, human loads in browser, refines, re-exports. Define success criteria: what must survive, what refinements must be possible, what provenance must be inspectable.

2. **EVAL-04 (Browser vs Agent Convergence):** Define the controlled task (5-slide deck on sleep quality by demographics), both paths, and the comparison rubric. Per `eval_00_agent_interface_validation.md` §3.

3. **EVAL-05 (Cross-Wave Harmonization):** Define the ELSA dataset task, expected mapping workflow, and what a successful harmonized analysis looks like. Note dependency on ELSA data availability and harmonization workspace maturity.

4. **EVAL-06 (Stress: WVS):** Define the WVS task with explicit fallback to the Trust dataset if WVS parsing fails. Define what "resilience" means in scoring terms.

**Invariants touched:** None — documentation only.

**Dependency:** WS1–WS3 should be complete before writing EVAL-03 brief, since the handoff eval depends on session round-trip actually working.

---

## 4. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `describe()` wrapping breaks browser callers | Medium | `describe()` is currently called by MCP tools and tests only — browser uses Zustand store, not engine directly (convergence not yet done). Grep to confirm. |
| Session semantic restore creates annotation conflicts | Low | Define merge semantics: imported annotations override for matching variable IDs, additive for new ones. |
| MCP server registration format is Claude Code version-dependent | Low | Document the manual JSON config alongside any automated path. |
| EVAL-05/06 datasets may not parse cleanly | Medium | EVAL-05 (ELSA) hasn't been tested. EVAL-06 (WVS) has known parse issues. Both briefs should include explicit fallback datasets. |
| Scope creep into presentation quality improvements | Medium | Hard boundary: WS1–WS3 fix the path; they don't improve the output. Presentation work belongs in S4-EVAL-3 or later. |

---

## 5. Test Strategy

| Change | Test type | Location |
|---|---|---|
| ResultEnvelope wrapping for `describe()` | Unit | `src/engine/VelocityEngine.test.ts` — verify `.data`, `.operation`, `.metadata` fields |
| ResultEnvelope wrapping for `exportSession()` | Unit | Same file — verify envelope structure |
| MCP tool handlers after wrapping changes | Unit | `mcp-server/__tests__/tools.test.ts` — verify no double-wrapping |
| Session round-trip end-to-end | Integration | New test: `src/engine/__tests__/session-roundtrip.test.ts` |
| Semantic state restoration on import | Integration | Same file — annotate → export → fresh engine → import → verify annotations present |
| MCP server startup | Integration | `npm run velocity-mcp-setup` script or equivalent smoke test |

**Coverage gate:** All existing tests must continue to pass. New tests must cover the round-trip path end-to-end.

---

## 6. Performance Expectations

No performance-sensitive changes. `describe()` and `exportSession()` wrapping adds ~1 object allocation per call. Session import semantic restore is O(n) over annotated variables — negligible for any realistic dataset size.

---

## 7. Delivery Order

```
WS1 (MCP setup)          ─────┐
WS2 (ResultEnvelope fix) ─────┼── Can be parallelized
WS3 (Session round-trip) ─────┘
         │
         ▼
WS4 (Docs alignment)     ─────┐
WS5 (Artifact contract)  ─────┼── Can be parallelized; depend on WS1-3 being done
WS6 (Eval briefs C–F)    ─────┘
```

WS1–WS3 are independent of each other and can be implemented in parallel. WS4–WS6 depend on WS1–WS3 being complete so the docs and briefs describe real, working behavior.

---

## 8. Definition of Done

S4-EVAL-2 is done when:

- [ ] An agent can configure MCP and call `velocity_load` → `velocity_describe` → `velocity_build_deck` → `velocity_export_session` without undocumented detours
- [ ] Every public data-returning `VelocityEngine` method returns `ResultEnvelope<T>`
- [ ] Session export → import round-trip preserves filters, weight, slides, sections, and semantic annotations (verified by integration test)
- [ ] `guide_agent_quickstart.md` has a setup section and teaches chart-first deck authoring
- [ ] `playbooks/agent_analysis_workflow.md` documents actual session export behavior
- [ ] Eval artifact directory structure is defined and documented
- [ ] Briefs exist for EVAL-03, EVAL-04, EVAL-05, and EVAL-06
- [ ] All gates pass: T (typecheck), L (lint), U (unit tests), I (integration tests), A (architecture invariants)

---

## 9. What This Explicitly Defers

- Category suppression in presentation exports → S4-EVAL-3 or benchmark plan workstream
- Chart-first deck builder improvements → S4-EVAL-3 or benchmark plan workstream
- Semantic search category/intent filters → S4-EVAL-4 capability gap investigation
- Crosstab output formatting for agents → future, not path-critical
- Chi-square statistic field fix → backlog
- Browser convergence work → S4-EVAL-4 (needs EVAL-04 results first)
