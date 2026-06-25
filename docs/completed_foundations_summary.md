# Velocity Completed Foundations Summary

This document summarizes completed work that used to make `docs/tracker_00_implementation_status.md` hard to read as an active execution board. The tracker now focuses on current work and gates; this file preserves the foundation story and evidence map.

## Current State

As of the June 2026 market reset, Velocity has a credible local-first survey analysis foundation: SAV/CSV ingestion, survey metadata preservation, weighted crosstabs, significance testing, editable exports, durable local workspace reopening, a headless engine, MCP tools, semantic discovery, and harmonization infrastructure.

The next strategic question is no longer "can the engine thesis work?" The answer is yes within the validated scope. The next question is whether a narrow commercial wedge can win: analysis-ready SAV file -> defensible, editable client deck for boutique researchers and independent consultants.

## Completed Foundation Map

### Phase 1 - Core Local Survey Workbench

- Local-first ingestion, including SAV and CSV paths.
- DuckDB-Wasm / DuckDB adapter foundation.
- Worker-side compute and browser boundary discipline.
- Canvas/dashboard analysis surface.
- Searchable variable list and core interaction model.
- Initial design system and testing baseline.

### Phase 2 - Commercial Survey Analysis Layer

- Existing-weight application through the crosstab pipeline.
- Variable sets / grids for survey-native grouped questions.
- Recoding and bucketing for common analysis preparation.
- Global filtering.
- Automatic significance testing.
- Pairwise comparisons, multiple-testing correction, dependent-sample overlap handling for multi-response, and the TSL no-go decision.
- Editable PPTX/XLSX export via PptxGenJS and ExcelJS.
- R/SPSS-style parity evidence for supported crosstab/statistical paths.

### Phase 3 - Engine, MCP, Browser Convergence

- `VelocityEngine` extracted as a headless orchestration layer.
- Engine outputs wrapped in `ResultEnvelope` with duration, warnings, inputs, and metadata.
- CLI/headless workflows moved onto shared engine contracts.
- `DeckBuilder` added for declarative multi-slide deck composition with fail-soft slide handling.
- MCP server package added with lifecycle, describe, analyze, deck, export, harmonization, session, and semantic tools.
- Browser path converged toward the engine surface.
- Session export/import and portable `.velocity` state established.

### Phase 4 - Agent Capability Validation

- Canonical eval framework and task portfolio created.
- Intended-path validation covered MCP setup, session round-trip clarity, tool consistency, workflow docs, and artifact capture.
- Task portfolio executed across discovery, deck authoring, handoff, convergence, harmonization, and stress cases.
- Capability gap review classified issues as rough edge, capability expansion, interface re-engineering, or thesis/scope revision.
- Phase synthesis validated the engine thesis and froze benchmark baselines for EVAL-01, EVAL-02, EVAL-04, and EVAL-06.

### Phase 4 Follow-Through

- Category-aware discovery shipped via annotation category filters, `listVariablesByCategory`, and guided break suggestions.
- Crosstab matrix output shipped for MCP and core formatting.
- Recommended breaks, high-cardinality warnings, and false-positive weight warnings shipped.
- Workspace-aware MCP loading shipped with metadata-first and full-load flows.
- Deck transport resilience shipped for large `buildDeck` responses.
- EVAL-05b fuzzy harmonization re-run completed for naming drift, partial label overlap, and scale inversion scenarios.

### Stabilization Sprint

- Documentation/tracker/process contract reconciled after the May 2026 deep review.
- Workspace reopen/switch/delete shipped with OPFS DB-first restoration and source replay fallback.
- Export quality improved with theme branding, chart style resolution, and PPTX builder consolidation.
- Design-token enforcement added with `scripts/check-design-tokens.mjs` and CI wiring.
- Truthful CI gates documented and wired for production build, MCP typecheck, design tokens, and workspace-switch E2E.
- Architecture thin slices extracted workspace opening, lifecycle, engine persistence, and upload/OPFS orchestration from larger files.

### UI Excellence

- Motion DSL and reduced-motion support added.
- Accessibility improvements added across focus states, chart ARIA, and screen-reader tables.
- Canvas polish added: smart empty states, adaptive shelves, Focus Mode, toasts, and crosstab hierarchy.
- Theme/density polish added: shadow tokens, theme previews, variable list visual weight, command palette, and shortcut reference.
- Back-room delight layers shipped for Variable Manager diagnostics, workspace portraits/timeline/search, onboarding feedback, returning researcher cues, and deck summary tooltips.
- May 2026 review remediation (`STAB-UI-D`) closed P1 trust/responsive gaps: inline crosstab errors, filtered-N subtitles, projects empty state, Canvas recode path, modal Escape, OPFS plain-language copy, and narrow-width Canvas chrome.

### Harmonization Workspace

- Cross-wave harmonization baseline shipped.
- Core pure-TS engine supports Jaro-Winkler similarity, Jaccard value-label overlap, type compatibility, scale inversion detection, greedy auto-match, and harmonized SQL generation.
- UI includes Sankey visualization, mapping table, value remapping, lasso selector, wave detection banner, and cross-wave entry points.
- Session/store integration and tests are in place.

## Evidence Anchors

- `docs/eval_framework.md` and `evals/README.md`
- `docs/archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md`
- `src/engine/VelocityEngine.ts`
- `src/engine/DeckBuilder.ts`
- `mcp-server/schemas.ts`
- `src/core/analysis/crosstabRunner.ts`
- `src/core/analysis/crosstab/significance.ts`
- `src/core/export/pptxExporter.ts`
- `src/core/semantic/analysisGuardrails.ts`
- `src/core/harmonization/`
- `tests/golden/`
- `tests/parity/`
- `tests/e2e/workspace-switch.spec.ts`
- `scripts/benchmark-sav-ingestion.ts`
- `scripts/benchmark-sav-v2-v3.ts`

## Strategic Interpretation

Velocity has enough technical foundation to stop proving architecture in the abstract. The risk has shifted from implementation feasibility to commercial focus. Local-first computation, survey-correct significance, SAV support, MCP, and dual-state data handling are valuable capabilities, but not moats by themselves.

The likely moat must be earned through accumulated workflow assets and trust:

- Real-world survey benchmark corpus and parity evidence.
- Best-in-class editable deck compilation.
- Portable, inspectable analysis recipes.
- Agent workflows that generate auditable outcomes rather than opaque answers.
- Workflow memory: reusable banners, mappings, harmonization decisions, report recipes, and client templates.

## Future Hints

Phase 5+ work remains valid, but gated:

- Productize WebR and raking only if paid pilots show weighting/advanced methods repeatedly block adoption.
- Build a recipe manager/time travel only if repeatable transformation recipes become retention-critical.
- Expand semantic AI only after bounded agent outcomes prove time savings without trust failures.
- Add enterprise collaboration/imports only after the target ICP shifts from boutique researchers to in-house/team use cases.

Active sequencing lives in `docs/tracker_00_implementation_status.md`.
