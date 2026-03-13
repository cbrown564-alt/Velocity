# Velocity Implementation Tracker (Execution DAG)

This tracker is the operational delivery board. It is dependency-first and optimized for multi-agent orchestration.

Use with:
- Strategic roadmap: `docs/roadmap_00_strategic_guide.md`
- Scope gates: `docs/blue_02_feature_matrix.md`
- Phase 4 plan: `docs/plan_phase4_agent_capability_validation.md`
- Agent rules: `docs/AGENTS.md`

## 1. Status Model

- `Not started`: work item has not begun
- `In progress`: active implementation
- `Blocked`: waiting on dependency or decision
- `In review`: implementation complete, awaiting review gates
- `Done`: merged with required evidence

## 2. Gate Legend

- `T`: Typecheck
- `L`: Lint
- `U`: Targeted unit tests
- `I`: Integration tests
- `G`: Golden tests (for statistical/chart parity)
- `A`: Architecture/invariant checks (`src/core` seam, Worker compute, dual-state integrity)

Default owner flow for all items: `Architect -> Implementer -> Reviewer`
Handoff required for every owner transition using `docs/agent_handoff_template.md`.

## 3. Dependency Graph (Open Work)

```mermaid
graph TD
  S2EXP2["S2-EXP-2 Editable Chart Fidelity"] --> S3ENG1["S3-ENG-1 VelocityEngine + Provenance"]
  S3ENG1 --> S3MCP1["S3-MCP-1 MCP Server + Deck Builder"]
  S3MCP1 --> S3BROW1["S3-BROW-1 Browser Convergence"]
  S3BROW1 --> S3SEM1["S3-SEM-1 Semantic Layer"]

  S3SEM1 --> S4EVAL1["S4-EVAL-1 Eval Foundations + Contracts"]
  S4EVAL1 --> S4EVAL2["S4-EVAL-2 Intended-Path Readiness"]
  S4EVAL2 --> S4EVAL3["S4-EVAL-3 Task Portfolio Execution"]
  S4EVAL3 --> S4EVAL4["S4-EVAL-4 Capability Gap Review"]
  S4EVAL4 --> S4EVAL5["S4-EVAL-5 Strategy Synthesis + Baselines"]

  S3SEM1 --> S5HARM1["S5-HARM-1 Harmonization Workspace"]
  S5HARM1 --> S5R1["S5-R-1 WebR Bridge"]
  S4EVAL5 --> S5R1
  S5R1 --> S5STATS1["S5-STATS-1 Advanced Models"]
  S5R1 --> S5PREP1["S5-PREP-1 Recipe Manager + Time Travel"]

  S5PREP1 --> S6AI1["S6-AI-1 Semantic Reasoning"]
  S6AI1 --> S6AI2["S6-AI-2 Natural Language Querying"]
  S6AI2 --> S6AI3["S6-AI-3 Action Hub"]

  S6AI3 --> S7CLOUD1["S7-CLOUD-1 Realtime Collaboration"]
  S7CLOUD1 --> S7CLOUD2["S7-CLOUD-2 Direct Data Imports"]
```

S2-STAT-1 through S2-STAT-4 are resolved. S2-EXP-1 and S2-EXP-2 are done. Phase 3 critical path delivery is complete. The active critical path is now the dedicated Phase 4 agent-capability validation sequence before more major downstream expansion. `S4-EVAL-3` remains in progress: `EVAL-01` through `EVAL-04` now have executable evidence packages on disk. `EVAL-03` validated the browser handoff loop on `sleep.sav` and fixed the browser-session semantic-export blocker; `EVAL-04` then added a controlled browser-vs-MCP convergence baseline on the same dataset, with one remaining session-parity warning around top-level working-state persistence. Runtime/workspace/harmonization work has shifted to Phase 5, AI work to Phase 6, and cloud work to Phase 7.

## 4. Execution Board

### 4.1 Active Critical Path (Phase 4: Agent Capability Validation)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S4-EVAL-1 | Eval Program | Canonical Phase 4 plan, task portfolio, benchmark contract, scoring model, and capability-gap review structure for agent-led validation of the full app surface | S3-SEM-1 | Done | No | A | `docs/plan_phase4_agent_capability_validation.md`, `docs/eval_00_agent_interface_validation.md`, `docs/eval_00_outcome_decision_framework.md`, `docs/eval_00_capability_gap_review.md`, `docs/eval_00_task_portfolio.md`, `docs/eval_00_benchmark_result_template.md`, `docs/eval_00_phase_synthesis_template.md` |
| S4-EVAL-2 | Workflow Validation | Intended-path readiness: MCP setup reliability, session round-trip clarity, engine/tool contract consistency, workflow docs alignment, artifact capture | S4-EVAL-1 | Done | Yes | T,L,U,I,A | `.claude/settings.json`, `scripts/velocity-mcp-setup.mjs`, `src/engine/VelocityEngine.ts`, `src/engine/__tests__/session-roundtrip.test.ts`, `mcp-server/tools.ts`, `docs/guide_agent_quickstart.md`, `docs/playbooks/agent_analysis_workflow.md`, `evals/README.md`, `docs/eval_00_run_summary_schema.ts`, `docs/eval_03_session_handoff_roundtrip_brief.md`, `docs/eval_04_browser_vs_agent_convergence_brief.md`, `docs/eval_05_cross_wave_harmonization_brief.md`, `docs/eval_06_stress_wvs_brief.md` |
| S4-EVAL-3 | Eval Execution | Executed task portfolio across discovery, deck authoring, handoff, convergence, harmonization, and stress cases with standardized outputs | S4-EVAL-2 | In progress | Yes | U,I,A | `docs/design_s4_eval_3_task_portfolio_execution.md`, `evals/eval-01/runs/run-2026-03-13/brief.md`, `evals/eval-01/runs/run-2026-03-13/process_log.md`, `evals/eval-01/runs/run-2026-03-13/scorecard.md`, `evals/eval-01/runs/run-2026-03-13/gap_review.md`, `evals/eval-01/runs/run-2026-03-13/artifacts/summary.json`, `evals/eval-02/runs/run-2026-03-13/brief.md`, `evals/eval-02/runs/run-2026-03-13/process_log.md`, `evals/eval-02/runs/run-2026-03-13/scorecard.md`, `evals/eval-02/runs/run-2026-03-13/gap_review.md`, `evals/eval-02/runs/run-2026-03-13/artifacts/summary.json`, `evals/eval-03/runs/run-2026-03-13/brief.md`, `evals/eval-03/runs/run-2026-03-13/process_log.md`, `evals/eval-03/runs/run-2026-03-13/scorecard.md`, `evals/eval-03/runs/run-2026-03-13/gap_review.md`, `evals/eval-03/runs/run-2026-03-13/artifacts/summary.json`, `evals/eval-04/runs/run-2026-03-13/brief.md`, `evals/eval-04/runs/run-2026-03-13/process_log.md`, `evals/eval-04/runs/run-2026-03-13/scorecard.md`, `evals/eval-04/runs/run-2026-03-13/gap_review.md`, `evals/eval-04/runs/run-2026-03-13/artifacts/summary.json`, `src/App.tsx`, `src/services/sessionSemanticState.ts`, `src/services/sessionSemanticState.test.ts`, `mcp-server/tools.ts`, `mcp-server/__tests__/tools.test.ts`, `tests/e2e/agentWorkflow.test.ts`, `docs/guide_agent_quickstart.md`, `docs/playbooks/agent_analysis_workflow.md` |
| S4-EVAL-4 | Capability Review | Per-eval strategic assessments that classify gaps as rough-edge, capability expansion, interface re-engineering, or scope/thesis revision, including semantic option studies | S4-EVAL-3 | Not started | No | A | - |
| S4-EVAL-5 | Strategy | Phase synthesis: validated claims, unvalidated claims, frozen benchmark baselines, and roadmap reset for post-validation work | S4-EVAL-4 | Not started | No | A | - |

### 4.2 Next After Validation (Phase 5)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S5-HARM-1 | Harmonization | Lasso + Sankey + mapping workflow baseline | S3-SEM-1 | Done | Yes | T,U,I,A | 3bd2bf1 |
| S5-R-1 | Runtime | WebR Worker + Arrow-to-R marshalling | S5-HARM-1, S4-EVAL-5 | Not started | Yes | T,L,U,I,A | - |
| S5-STATS-1 | Stats | Advanced models (`lme4`) + raking path integration | S5-R-1 | Not started | Yes | T,L,U,I,G,A | - |
| S5-PREP-1 | Data Prep | Recipe manager + time travel | S5-R-1 (if R-backed steps), else S5-HARM-1; informed by S4-EVAL-5 | Not started | Yes | T,L,U,I,A | - |
| S5-PREP-2 | Data Prep | Block formula builder + programming-by-example | S5-PREP-1 | Not started | Yes | T,L,U,I,A | - |

### 4.3 Later (Phase 6-7)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S6-AI-1 | AI | Semantic reasoning + auto-code for text | S5-PREP-1 | Not started | Yes | T,L,U,I,A | - |
| S6-AI-2 | AI | Text-to-SQL/Text-to-state interpreter | S6-AI-1 | Not started | Yes | T,L,U,I,A | - |
| S6-AI-3 | AI | Action hub (Linear/Jira export workflows) | S6-AI-2 | Not started | Yes | T,L,U,I,A | - |
| S7-CLOUD-1 | Cloud | Realtime collaboration backend + UI integration | S6-AI-3 | Not started | Yes | T,L,U,I,A | - |
| S7-CLOUD-2 | Cloud | Direct survey platform imports via backend proxy | S7-CLOUD-1 | Not started | Yes | T,L,U,I,A | - |

### 4.4 Recent Delivered (Last 20 Commits Snapshot)

Snapshot reference window: commits on February 5, 2026 through March 11, 2026.

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S3-SEM-1 | Semantics | Heuristic annotator (9 rules, O(n), no ML), ConceptStore (CRUD, merge, serialization), concept discovery (Jaccard clustering), token-based semantic search (weighted scoring), domain-aware analysis/harmonization suggestions, 7 new MCP tools, session v2 format, chart recommender semantic overrides. 68 new tests. | S3-BROW-1 | Done | Yes (new `src/types/semantic.ts`, `Variable.semantic`, session v2, 7 MCP tools) | T,U,A | af4c925 |
| S3-ENG-1 | Engine | VelocityEngine facade, `ResultEnvelope` provenance, headless slide defaults, CLI migration, PPTX export gap closure | S2-EXP-2 | Done | Yes | T,L,U,I,A | 02d54c2, cf3dc13 |
| S5-HARM-1 | Harmonization | Lasso + Sankey + mapping workflow: auto-match engine (Jaro-Winkler + Jaccard + type compat + scale inversion), D3 Sankey diagram, virtualized MappingTable, ValueRemapPanel, LassoSelector, WaveDetectionBanner, HarmonizationWorkspace overlay, import-time wave detection, CrossWavePanel Harmonize entry point | S2-STAT-4, S2-EXP-2 | Done | Yes (new `harmonization` store slice; 6 worker message types; `waveDetectionBanner` in UISlice) | T,U,I,A | 3bd2bf1 |
| S2-VAL-1 | Validation | R parity test suite (12 tests vs R reference on real SAV files); fixes `regularizedGammaP` CF bug (chi-square p-values) and `STDDEV→STDDEV_POP` formula consistency | S2-STAT-1–4 | Done | No | G,A | 56a2241 |
| S2-EXP-1 | Export | Browser-side PPTX export using `PptxGenJS` | Milestone 2.4 complete | Done | Yes | T,L,U,I,A | 3d80d06, cab233a, e840767, c9cc564 |
| S2-DECK-1 | Analysis Deck | Analysis state capture, editable headers, unsaved indicator | Hub-and-spoke baseline | Done | Yes | T,L,U,A | a3679f7 |
| S2-DECK-2 | Analysis Deck | Duplicate/delete slide actions + inline film-strip timeline dock | S2-DECK-1 | Done | Yes | T,L,U,A | b97658f, 14adb12 |
| S2-DECK-3 | Analysis Deck | Empty-variable fallback for slide rendering robustness | S2-DECK-2 | Done | No | U,A | 26e0d6f |
| S5-WS-1 | Workspace | Longitudinal workspace support (WaveTimeline, CrossWavePanel) | Workspace baseline | Done | Yes | T,L,U,I,A | 947f2fd |
| S5-WS-2 | Workspace | Batch operations + workspace export/import modal | S5-WS-1 | Done | Yes | T,L,U,I,A | 11bfd89 |
| S2-STAT-1 | Stats | Pairwise column proportions tests (A/B/C letters) | Milestone 2.3 complete | Done | Yes | T,L,U,G,A | 3a9f2a1 (audit confirms pre-existing) |
| S2-STAT-2 | Stats | FDR + Bonferroni corrections wired into crosstab pipeline | S2-STAT-1 | Done | Yes (additive: `adjustedPValue`, `correctionMethod` on stats; `SignificanceOptions` on runner) | T,L,U,G,A | 8d1b585, bf7e58a |
| S2-STAT-3 | Stats | Dependent-sample overlap handling for multi-response column banners | S2-STAT-1 | Done | Yes (additive: `isOverlapCorrected` on stats; `buildOverlapQuery` in queryBuilder) | T,L,U,G,A | 8d1b585, a8b63e8, bf7e58a |
| S2-STAT-4 | Stats | TSL variance estimation go/no-go decision | S2-STAT-2, S2-STAT-3 | Done | No (decision only: NO-GO — deferred to Phase 5+ via WebR) | A | 3a9f2a1 |

## 5. Completed Foundations (Summary)

Completed work remains documented in git history and prior tracker revisions. Current completed anchors that open work depends on:
- Phase 1 core ingestion, canvas, design system, testing baseline, and worker unification
- Phase 2 hub-and-spoke architecture and visual ETL foundation
- Phase 2 statistical foundation (Phase 1 significance)
- Phase 2 charting refactor and weighting application
- **Phase 3 critical path complete:** `S3-ENG-1 -> S3-MCP-1 -> S3-BROW-1 -> S3-SEM-1` all Done. Engine extraction, MCP deck building, browser convergence, and semantic layering are fully shipped.
- **Phase 3 engine foundation complete (S3-ENG-1):** `VelocityEngine`, `ResultEnvelope` provenance wrapping, CLI migration, headless slide default resolution, and PPTX subtitle/notes/section-divider semantics landed in `02d54c2` with Phase 1 review-gap fixes closed in `cf3dc13`.
- **MCP server + DeckBuilder complete (S3-MCP-1):** `DeckBuilder` class (`src/engine/DeckBuilder.ts`) — batch deck composition with fail-soft per-slide error handling, per-slide filter/weight isolation, automatic title/subtitle/chart-type resolution. `VelocityEngine` extended with `buildDeck`, `exportDeck`, `recommendChart`, `proposeMappings`, `buildHarmonizedTable`, and `dataDir` path sandboxing. MCP server package (`mcp-server/`) with stdio transport, 20 tool definitions covering full lifecycle (load → describe → analyze → build deck → export → harmonize → session). 31 new tests (DeckBuilder: 12, MCP tools: 19). All 63 test files passing.
- **Export engine closure (S2-EXP-1):** Browser-side PPTX/XLSX export via PptxGenJS, slide-deck-level modal, multi-slide scope selection. All critical and medium bugs resolved; 22 tests passing.
- Analysis deck interaction foundation (state capture, timeline actions, timeline rail redesign)
- Workspace expansion: longitudinal support plus batch operations/export-import workflows
- **Statistical engine closure (S2-STAT-1–4):** Pairwise comparisons, FDR/Bonferroni correction pipeline, dependent-sample overlap handling for multi-response, TSL NO-GO decision. Phase 5 statistical dependency is cleared once the new validation phase completes.
- **Phase 4 is now dedicated to agent capability validation:** the new top-priority sequence is `S4-EVAL-1 -> S4-EVAL-2 -> S4-EVAL-3 -> S4-EVAL-4 -> S4-EVAL-5`, covering benchmark design, intended-path readiness, task-portfolio execution, capability-gap review, and roadmap synthesis.
- **Phase numbering shifted back again for downstream streams:** runtime/workspace/harmonization items now track as `S5-*`, AI items as `S6-*`, and cloud items as `S7-*` so full agent-capability validation owns Phase 4.
- **R parity validation (S2-VAL-1):** 12 Vitest tests comparing Velocity's crosstab engine against R (`haven` + `survey`) on `sleep.sav` and `bsa93.sav`. Fixtures pre-committed; CI has no R dependency. Two engine bugs found and fixed: `regularizedGammaP` continued fraction (correct chi-square p-values) and `STDDEV→STDDEV_POP` (population formula consistency across weighted/unweighted paths). Three WVS Wave 7 tests remain `.todo` pending a ReadStat-WASM parsing fix.
- **Semantic layer complete (S3-SEM-1):** Heuristic auto-annotator (`src/core/semantic/annotator.ts`) classifies variables by 9 rules (weight, identifier, temporal, demographic/gender, Likert/NPS attitude, awareness, behavior, open-end, classification) with per-rule confidence scoring and no ML dependency. `ConceptStore` (`src/core/semantic/concepts.ts`) provides CRUD, alias management, variable linking, merge, and JSON round-trip. Concept discovery (`conceptDiscovery.ts`) clusters by (topic, intent) + Jaccard value-label similarity. Token-based semantic search (`search.ts`) scores: concept match (0.4) > topic (0.3) > label (0.2) > name (0.1) with multi-dataset support. Domain-aware suggestions (`suggestions.ts`) emit ranked `AnalysisSuggestion[]` and `HarmonizationSuggestion[]`. `VelocityEngine` extended with 10 semantic methods. 7 new MCP tools. Session format v2 (backward-compatible). Chart recommender extended with semantic overrides. 68 tests, TypeScript clean, zero browser deps in `src/core/semantic/`.
- **Harmonization workspace (S5-HARM-1):** Full cross-wave variable harmonization. Core pure-TS engine: Jaro-Winkler similarity, Jaccard value-label overlap, type compatibility, scale inversion detection, auto-match greedy assignment, SQL generators (value frequencies, UNION-based harmonized table, respondent overlap). Zustand harmonization slice with persist. Worker message handling. D3 Sankey diagram, react-window MappingTable, ValueRemapPanel, LassoSelector (pointer capture + polygon containment), WaveDetectionBanner, HarmonizationWorkspace full-screen overlay. Import-time wave detection heuristics. CrossWavePanel wired to real Harmonize entry point. 410 tests passing, TypeScript clean, architecture invariant (zero browser deps in `src/core/harmonization/`) confirmed.

## 6. Update Rules

When updating this file:
1. Never add a work item without an `ID` and `Depends on` field.
2. If `Contract change` is `Yes`, link evidence in PR description using `.github/pull_request_template.md`.
3. Move items only by status transitions (`Not started` -> `In progress` -> `In review` -> `Done`).
4. Keep dependency graph and tables in sync in the same commit.
