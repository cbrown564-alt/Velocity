# Velocity Implementation Tracker (Execution DAG)

This tracker is the operational delivery board. It is dependency-first and optimized for multi-agent orchestration.

Use with:
- Strategic roadmap: `docs/roadmap_00_strategic_guide.md`
- Scope gates: `docs/blue_02_feature_matrix.md`
- Agent rules: `docs/AGENTS.md`
- Handoff template: `docs/agent_handoff_template.md`

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

  S3SEM1 --> S4HARM1["S4-HARM-1 Harmonization Workspace"]
  S4HARM1 --> S4R1["S4-R-1 WebR Bridge"]
  S4R1 --> S4STATS1["S4-STATS-1 Advanced Models"]
  S4R1 --> S4PREP1["S4-PREP-1 Recipe Manager + Time Travel"]

  S4PREP1 --> S5AI1["S5-AI-1 Semantic Reasoning"]
  S5AI1 --> S5AI2["S5-AI-2 Natural Language Querying"]
  S5AI2 --> S5AI3["S5-AI-3 Action Hub"]

  S5AI3 --> S6CLOUD1["S6-CLOUD-1 Realtime Collaboration"]
  S6CLOUD1 --> S6CLOUD2["S6-CLOUD-2 Direct Data Imports"]
```

S2-STAT-1 through S2-STAT-4 are resolved. S2-EXP-1 and S2-EXP-2 are done. Phase 2 critical path blockers are cleared for the new Phase 3 start. The current gating sequence is engine extraction, MCP deck-building, browser convergence, and semantic layering; prior WebR and downstream AI/cloud work has shifted back one phase.

## 4. Execution Board

### 4.1 Critical Path (Now)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S3-ENG-1 | Engine | VelocityEngine facade, `ResultEnvelope` provenance, headless slide defaults, CLI migration, PPTX export gap closure | S2-EXP-2 | Done | Yes | T,L,U,I,A | 02d54c2, cf3dc13 |
| S3-MCP-1 | Agent Platform | DeckBuilder, MCP server package, engine tool surface for deck build/export and harmonization | S3-ENG-1 | Done | Yes | T,L,U,I,A | See evidence below |
| S3-BROW-1 | Browser | Worker-hosted engine, EngineProxy migration, store slice convergence, App shell decomposition, live agent mode plumbing | S3-MCP-1 | Not started | Yes | T,L,U,I,A | [design_phase3_browser_convergence.md](docs/design_phase3_browser_convergence.md) |
| S3-SEM-1 | Semantics | Variable semantic annotations, concepts, semantic search, domain-aware recommendations | S3-BROW-1 | Not started | Yes | T,L,U,I,A | [design_phase4_semantic_layer.md](docs/design_phase4_semantic_layer.md) |

### 4.2 Next (Phase 4)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S4-HARM-1 | Harmonization | Lasso + Sankey + mapping workflow baseline | S3-SEM-1 | Done | Yes | T,U,I,A | 3bd2bf1 |
| S4-R-1 | Runtime | WebR Worker + Arrow-to-R marshalling | S4-HARM-1 | Not started | Yes | T,L,U,I,A | - |
| S4-STATS-1 | Stats | Advanced models (`lme4`) + raking path integration | S4-R-1 | Not started | Yes | T,L,U,I,G,A | - |
| S4-PREP-1 | Data Prep | Recipe manager + time travel | S4-R-1 (if R-backed steps), else S4-HARM-1 | Not started | Yes | T,L,U,I,A | - |
| S4-PREP-2 | Data Prep | Block formula builder + programming-by-example | S4-PREP-1 | Not started | Yes | T,L,U,I,A | - |

### 4.3 Later (Phase 5-6)

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S5-AI-1 | AI | Semantic reasoning + auto-code for text | S4-PREP-1 | Not started | Yes | T,L,U,I,A | - |
| S5-AI-2 | AI | Text-to-SQL/Text-to-state interpreter | S5-AI-1 | Not started | Yes | T,L,U,I,A | - |
| S5-AI-3 | AI | Action hub (Linear/Jira export workflows) | S5-AI-2 | Not started | Yes | T,L,U,I,A | - |
| S6-CLOUD-1 | Cloud | Realtime collaboration backend + UI integration | S5-AI-3 | Not started | Yes | T,L,U,I,A | - |
| S6-CLOUD-2 | Cloud | Direct survey platform imports via backend proxy | S6-CLOUD-1 | Not started | Yes | T,L,U,I,A | - |

### 4.4 Recent Delivered (Last 20 Commits Snapshot)

Snapshot reference window: commits on February 5, 2026 through February 25, 2026.

| ID | Stream | Outcome | Depends on | Status | Contract change | Gates | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S3-ENG-1 | Engine | VelocityEngine facade, `ResultEnvelope` provenance, headless slide defaults, CLI migration, PPTX export gap closure | S2-EXP-2 | Done | Yes | T,L,U,I,A | 02d54c2, cf3dc13 |
| S4-HARM-1 | Harmonization | Lasso + Sankey + mapping workflow: auto-match engine (Jaro-Winkler + Jaccard + type compat + scale inversion), D3 Sankey diagram, virtualized MappingTable, ValueRemapPanel, LassoSelector, WaveDetectionBanner, HarmonizationWorkspace overlay, import-time wave detection, CrossWavePanel Harmonize entry point | S2-STAT-4, S2-EXP-2 | Done | Yes (new `harmonization` store slice; 6 worker message types; `waveDetectionBanner` in UISlice) | T,U,I,A | 3bd2bf1 |
| S2-VAL-1 | Validation | R parity test suite (12 tests vs R reference on real SAV files); fixes `regularizedGammaP` CF bug (chi-square p-values) and `STDDEV→STDDEV_POP` formula consistency | S2-STAT-1–4 | Done | No | G,A | 56a2241 |
| S2-EXP-1 | Export | Browser-side PPTX export using `PptxGenJS` | Milestone 2.4 complete | Done | Yes | T,L,U,I,A | 3d80d06, cab233a, e840767, c9cc564 |
| S2-DECK-1 | Analysis Deck | Analysis state capture, editable headers, unsaved indicator | Hub-and-spoke baseline | Done | Yes | T,L,U,A | a3679f7 |
| S2-DECK-2 | Analysis Deck | Duplicate/delete slide actions + inline film-strip timeline dock | S2-DECK-1 | Done | Yes | T,L,U,A | b97658f, 14adb12 |
| S2-DECK-3 | Analysis Deck | Empty-variable fallback for slide rendering robustness | S2-DECK-2 | Done | No | U,A | 26e0d6f |
| S4-WS-1 | Workspace | Longitudinal workspace support (WaveTimeline, CrossWavePanel) | Workspace baseline | Done | Yes | T,L,U,I,A | 947f2fd |
| S4-WS-2 | Workspace | Batch operations + workspace export/import modal | S4-WS-1 | Done | Yes | T,L,U,I,A | 11bfd89 |
| S2-STAT-1 | Stats | Pairwise column proportions tests (A/B/C letters) | Milestone 2.3 complete | Done | Yes | T,L,U,G,A | 3a9f2a1 (audit confirms pre-existing) |
| S2-STAT-2 | Stats | FDR + Bonferroni corrections wired into crosstab pipeline | S2-STAT-1 | Done | Yes (additive: `adjustedPValue`, `correctionMethod` on stats; `SignificanceOptions` on runner) | T,L,U,G,A | 8d1b585, bf7e58a |
| S2-STAT-3 | Stats | Dependent-sample overlap handling for multi-response column banners | S2-STAT-1 | Done | Yes (additive: `isOverlapCorrected` on stats; `buildOverlapQuery` in queryBuilder) | T,L,U,G,A | 8d1b585, a8b63e8, bf7e58a |
| S2-STAT-4 | Stats | TSL variance estimation go/no-go decision | S2-STAT-2, S2-STAT-3 | Done | No (decision only: NO-GO — deferred to Phase 4+ via WebR) | A | 3a9f2a1 |

## 5. Completed Foundations (Summary)

Completed work remains documented in git history and prior tracker revisions. Current completed anchors that open work depends on:
- Phase 1 core ingestion, canvas, design system, testing baseline, and worker unification
- Phase 2 hub-and-spoke architecture and visual ETL foundation
- Phase 2 statistical foundation (Phase 1 significance)
- Phase 2 charting refactor and weighting application
- **New Phase 3 critical path defined:** `S3-ENG-1 -> S3-MCP-1 -> S3-BROW-1 -> S3-SEM-1`, based on the March 9, 2026 design briefs for engine extraction, MCP deck building, browser convergence, and semantic layering.
- **Phase 3 engine foundation complete (S3-ENG-1):** `VelocityEngine`, `ResultEnvelope` provenance wrapping, CLI migration, headless slide default resolution, and PPTX subtitle/notes/section-divider semantics landed in `02d54c2` with Phase 1 review-gap fixes closed in `cf3dc13`.
- **MCP server + DeckBuilder complete (S3-MCP-1):** `DeckBuilder` class (`src/engine/DeckBuilder.ts`) — batch deck composition with fail-soft per-slide error handling, per-slide filter/weight isolation, automatic title/subtitle/chart-type resolution. `VelocityEngine` extended with `buildDeck`, `exportDeck`, `recommendChart`, `proposeMappings`, `buildHarmonizedTable`, and `dataDir` path sandboxing. MCP server package (`mcp-server/`) with stdio transport, 20 tool definitions covering full lifecycle (load → describe → analyze → build deck → export → harmonize → session). 31 new tests (DeckBuilder: 12, MCP tools: 19). All 63 test files passing.
- **Export engine closure (S2-EXP-1):** Browser-side PPTX/XLSX export via PptxGenJS, slide-deck-level modal, multi-slide scope selection. All critical and medium bugs resolved; 22 tests passing.
- Analysis deck interaction foundation (state capture, timeline actions, timeline rail redesign)
- Workspace expansion: longitudinal support plus batch operations/export-import workflows
- **Statistical engine closure (S2-STAT-1–4):** Pairwise comparisons, FDR/Bonferroni correction pipeline, dependent-sample overlap handling for multi-response, TSL NO-GO decision. Phase 4 statistical dependency is cleared.
- **Phase numbering shifted back for downstream streams:** prior `S3-*` runtime/workspace/harmonization items now track as `S4-*`, AI items as `S5-*`, and cloud items as `S6-*` so the new engine-to-semantics sequence owns Phase 3.
- **R parity validation (S2-VAL-1):** 12 Vitest tests comparing Velocity's crosstab engine against R (`haven` + `survey`) on `sleep.sav` and `bsa93.sav`. Fixtures pre-committed; CI has no R dependency. Two engine bugs found and fixed: `regularizedGammaP` continued fraction (correct chi-square p-values) and `STDDEV→STDDEV_POP` (population formula consistency across weighted/unweighted paths). Three WVS Wave 7 tests remain `.todo` pending a ReadStat-WASM parsing fix.
- **Harmonization workspace (S4-HARM-1):** Full cross-wave variable harmonization. Core pure-TS engine: Jaro-Winkler similarity, Jaccard value-label overlap, type compatibility, scale inversion detection, auto-match greedy assignment, SQL generators (value frequencies, UNION-based harmonized table, respondent overlap). Zustand harmonization slice with persist. Worker message handling. D3 Sankey diagram, react-window MappingTable, ValueRemapPanel, LassoSelector (pointer capture + polygon containment), WaveDetectionBanner, HarmonizationWorkspace full-screen overlay. Import-time wave detection heuristics. CrossWavePanel wired to real Harmonize entry point. 410 tests passing, TypeScript clean, architecture invariant (zero browser deps in `src/core/harmonization/`) confirmed.

## 6. Update Rules

When updating this file:
1. Never add a work item without an `ID` and `Depends on` field.
2. If `Contract change` is `Yes`, link evidence in PR description using `.github/pull_request_template.md`.
3. Move items only by status transitions (`Not started` -> `In progress` -> `In review` -> `Done`).
4. Keep dependency graph and tables in sync in the same commit.
