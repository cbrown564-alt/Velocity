# Deep Code Review

Date: 2026-05-19

Scope: whole-project maturity review covering architecture, product status, key risks, bloat, quality gates, and roadmap priority.

## Executive Summary

Velocity is in better shape than the older review notes suggest. The previous “51 tests failing / typecheck broken / request collision P0” state is mostly resolved. Current gates are green:

- `npm run typecheck:all`: passed
- `npm run test:run`: 611 passed, 7 skipped, 3 todo
- `npm run build`: passed, with chunk-size warnings
- `npm run test:coverage`: passed, but with major coverage exclusions

The right framing is: strong analytical engine, credible architecture direction, immature product shell. Do not rewrite. Stabilize.

## Main Judgment

Velocity should not restart from scratch. The highest-value next phase is a maturity sprint:

1. Reconcile stale docs.
2. Finish the workspace persistence and reopen story.
3. Make exports stakeholder-ready.
4. Reduce architectural coupling before adding WebR or more AI-facing breadth.

The computational spine is credible. The product, documentation, delivery surfaces, and UI discipline need hardening.

## Current Quality Gates

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | Pass | `npm run typecheck:all` completed cleanly. |
| Unit/golden/parity tests | Pass | 611 passed, 7 skipped, 3 todo across 73 files. |
| Coverage | Pass with caveat | Thresholds pass, but large UI/store/proxy areas are excluded. |
| Production build | Pass with warning | Build succeeds; largest JS chunk is `export-vendor` at 1.315 MB. |
| Test noise | Needs cleanup | React `act` warnings, Framer `layoutId` DOM warning, and ReadStat WASM fallback logs. |

## Highest-Priority Findings

### 1. Documentation Drift Is A Real Risk

The tracker and audit docs now disagree with code reality in several places. For example, `docs/tracker_00_implementation_status.md` says some S4 follow-through items are not started, but `mcp-server/tools.ts` already contains category and break-suggestion tools. Before planning new work, reconcile:

- `docs/tracker_00_implementation_status.md`
- `docs/roadmap_00_strategic_guide.md`
- `docs/blue_02_feature_matrix.md`
- `docs/DESIGN_AUDIT_PLAN.md`
- `AGENTS.md`
- CI and package script reality

This is a P0 process risk because stale docs will steer the next sprint incorrectly.

### 2. Workspace Reopen Is Incomplete

The workspace catalog stores metadata, but opening another stored dataset still does not fully reload row data from OPFS. This is probably the largest product-maturity blocker.

Until stored datasets are truly reopenable, the workspace behaves more like a library shell than a durable local-first dataset manager.

### 3. Export Works But Is Not Mature Enough

PPTX generation exists and tests pass, but chart output and export code need product-quality work:

- Hardcoded brand defaults remain in `src/core/export/pptxExporter.ts`.
- `src/core/export/pptxChartBuilder.ts` appears exported but unused by production callers.
- Agent-facing crosstab output still needs a stakeholder-recognizable matrix format.

Editable export is strategically essential. It should be treated as product surface, not a technical checkbox.

### 4. Architecture Is Directionally Good But Too Large In The Wrong Places

Several files are large enough to slow safe iteration:

- `src/services/analysisWorker.ts`
- `src/store/slices/dataSlice.ts`
- `src/engine/VelocityEngine.ts`
- `src/features/workspace/components/WorkspaceView.tsx`
- `src/App.tsx`

The issue is not that these concepts are wrong. It is that too much orchestration and feature logic lives in too few files.

### 5. Design-System Cleanup Is Unfinished

Raw Tailwind colors, CSS fallback hexes, and legacy tokens remain across:

- `src/App.tsx`
- Modal components
- Dashboard components
- Workspace CSS modules
- Harmonization CSS modules
- Common components such as DataDrawer, FilterBar, FilterChip, AvatarGroup

This undermines the three-theme system and creates drift between documented design rules and implemented UI.

### 6. Quality Gates Are Green But Narrow

Current tests are materially stronger than old notes imply, but coverage excludes too much important product code. CI should also gate production build, lint, and named parity paths.

## What Works Well

### Core Compute

Crosstabs, weighting, significance testing, golden/parity coverage, and R parity checks are in good shape. This is the strongest part of the repo and should be protected.

### Engine Direction

`VelocityEngine` plus `EngineProxy` is the right convergence path for browser, CLI, and MCP. It preserves the headless core thesis and gives agents a stable API surface.

### Worker Safety

The current browser path uses request IDs and serializes worker operations around DuckDB-WASM. The old response-collision P0 is no longer the central runtime risk.

### Local-First Recovery Strategy

Source-file OPFS plus transform replay is a strong durability model, even if workspace reopening is incomplete.

### UX Concept

Workspace, Analysis Canvas, and Variable Manager are coherent and preserve the original product thesis. The product does not need a new mental model.

## What Does Not Work Yet

### Product Durability

The local-first claim is not fully mature until workspace datasets can be reopened, rebuilt, switched, and deleted predictably across sessions.

### Deliverable Quality

The engine can compute results, but some exported artifacts do not yet look like polished analyst deliverables. This is especially important for PPTX and agent-generated crosstab outputs.

### UI Discipline

The design system is documented more consistently than it is implemented. Raw colors, fallback hexes, duplicate modal patterns, and ad hoc z-index values weaken maintainability.

### Documentation Trust

Docs contain a mixture of current reality, old bugs, resolved issues, and future plans. That makes onboarding and agent work riskier than necessary.

### Release Confidence

Tests pass, but the quality gate still has blind spots: UI surfaces, store slices, production build, lint, strict TypeScript, browser persistence, and OPFS edge cases.

## Essential Versus Bloat

### Essential

Keep and invest in:

- Local-first ingestion and privacy
- Worker-side compute
- DuckDB analytical path
- Dual raw-code / label survey model
- Crosstabs, weighting, significance, and variable sets
- Source-file recovery and transform replay
- Editable export
- Analysis Deck/session portability
- Three-mode UX: Workspace, Canvas, Variable Manager
- Engine/MCP convergence

### Likely Bloat Or Consolidation Targets

Review, merge, or delete:

- Unused PPTX chart builder path
- Legacy worker protocol residue
- Placeholder advanced-analysis/WebR UI
- Decorative workspace affordances before reopen is complete
- Duplicate modal implementations
- Duplicate filter/recode orchestration paths
- Collaboration widgets if not part of the near-term roadmap
- Raw Tailwind/legacy token styling parallel to semantic tokens

## Highest Risks

| Priority | Risk | Why It Matters | Area |
|---|---|---|---|
| P0 | Documentation drift | Stale planning docs can send the next sprint toward already-fixed or incorrectly scoped work. | Docs/process |
| P0 | Workspace reopen incomplete | Blocks the product from feeling like a reliable local-first workspace. | Product/runtime |
| P1 | Deliverable quality | Analysis output must be stakeholder-ready, not just technically correct. | Export/MCP |
| P1 | Monoliths and coupling | Routine changes remain high-risk when orchestration is concentrated in very large files. | Architecture |
| P1 | Design-token debt | Theme parity and visual consistency are not enforceable while raw colors and fallbacks remain. | UI system |
| P2 | Coverage blind spots | Green coverage can mask untested UI/store/feature behavior. | Quality |

## Recommended Priority Roadmap

### 1. Reconcile Documentation And Roadmap

Update tracker, feature matrix, strategic roadmap, design audit, and AGENTS guidance against actual code. This should happen before starting implementation so the backlog reflects reality.

Deliverables:

- Current-state tracker
- Resolved/obsolete bug list
- Active maturity roadmap
- Clear next-session plan

### 2. Finish Reopenable Workspace

Make stored datasets truly reopen from source OPFS keys, switch worker/persistence context correctly, clean up OPFS on delete, and test import/export round trips.

This is the most important product hardening work.

### 3. Polish Export To Client Quality

Unify PPTX chart builder paths, fix chart styling, improve gridlines/axis/data-label behavior, and add matrix-style crosstab output for agent workflows.

Export is not polish. It is a core user promise.

### 4. Split Monoliths At Stable Boundaries

Do not do a broad rewrite. Extract stable seams incrementally:

- App session/workspace/modal orchestration
- Data slice persistence and loading operations
- Worker routing versus ingestion versus persistence
- Workspace view subcomponents
- Export chart-building paths

### 5. Enforce Design-System Rules

Replace raw colors and fallback hexes, define missing semantic tokens, and add a guard script to block regressions.

### 6. Tighten Quality Gates

Reduce coverage exclusions, clean test warnings, add production build to CI, add or reconcile lint, and create deterministic browser smoke coverage for persistence/workspace.

## Phase Interpretation

The repo should treat the next phase as stabilization, not expansion.

Phase 4 agent validation produced useful evidence, but the immediate priority should not be WebR, cloud collaboration, or deeper AI. The product needs to close the gap between:

- strong computational backend
- credible engine/MCP architecture
- incomplete product durability
- inconsistent delivery quality

## Suggested Next Session Agenda

1. Reconcile `docs/tracker_00_implementation_status.md` against code reality.
2. Mark resolved old findings as closed, including storage binding, merge crash, worker collision on the browser path, and current golden/parity status.
3. Update the active roadmap around stabilization:
   - workspace reopen
   - export quality
   - design-system enforcement
   - monolith decomposition
   - CI truthfulness
4. Decide whether `docs/DESIGN_AUDIT_PLAN.md` should be merged into the roadmap or converted into a narrower design-system cleanup plan.
5. Create a small ordered implementation backlog for the next sprint.

## Bottom Line

Velocity is currently a capable analytical engine with a promising UI shell, not yet a mature product. The next phase should be called stabilization, not expansion.
