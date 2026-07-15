# Velocity Completed Foundations Summary

This document summarizes completed work so `docs/tracker_00_implementation_status.md` can stay a forward-looking execution board. The tracker focuses on active and gated work; this file preserves the foundation story and evidence map.

## Current State

As of the June 2026 market reset, Velocity has a credible local-first survey analysis foundation: SAV/CSV ingestion, survey metadata preservation, weighted crosstabs, significance testing, editable exports, durable local workspace reopening, a headless engine, MCP tools, semantic discovery, and harmonization infrastructure.

The engine and survey-analysis foundation is implemented and verified within the documented automated/local scope. Audit 10 closed the July fresh-session boot, returning-session reliability, Journey Gate, and CI-promotion incident on July 15, 2026: protected merge `b5640326343b570d8b04756c4c36c1edcfba394d`, 220/220 diagnostic starts, 200/200 final-candidate starts, and ten consecutive successful `main` Test/Journey pairs. See [Audit 10 §14](audit_10_engine_boot_ci_truth_rca_2026-07-14.md#14-evidence-inventory). This does not replace representative-user validation. The commercial question remains whether a narrow wedge can win: analysis-ready SAV file -> defensible, editable client deck for boutique researchers and independent consultants.

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
- **May 2026 UXR program complete** (June 25, 2026): all `UXR-000`–`UXR-051` findings in `docs/reviews/ui_ux_review_2026-05/findings.md` are `fixed`. Delivered in four waves after `STAB-UI-C`:
  - **`STAB-UI-D`** (`54b55d2`): P1 trust/responsive slice — inline crosstab errors, filtered-N subtitles, projects empty state, Canvas recode, modal Escape, OPFS copy, narrow Canvas chrome.
  - **Post–STAB-UI-D backlog** (`f778dda`): drill-down (UXR-025), data-driven upload progress (UXR-036), workspace polish (UXR-006/007/009/026), filter/modal/a11y batch (UXR-013/014/018–020/022/023).
  - **Theme system** (`ae6b13c`): three-theme affordances, Workspace theme control, Liquid Glass chrome/palette (UXR-027–031).
  - **System + Canvas polish** (`52d2d58`, `dc4c33d`): mode transition, engine-init progress, purge confirm, viewport guard (UXR-002/039/043/048); chart legends, portaled stats settings, shelf a11y, analysis busy state, timeline labels (UXR-011/015/016/038/046).

### Harmonization Workspace

- Cross-wave harmonization baseline shipped.
- Core pure-TS engine supports Jaro-Winkler similarity, Jaccard value-label overlap, type compatibility, scale inversion detection, greedy auto-match, and harmonized SQL generation.
- UI includes Sankey visualization, mapping table, value remapping, lasso selector, wave detection banner, and cross-wave entry points.
- Session/store integration and tests are in place.

### Market-Reset Pilot Foundations (July 2026)

- **`PILOT-0`–`PILOT-3` Done:** thesis/brief (`pilot_00_brief.md`), packaging (`pilot_01_packaging.md`), trust pack (`pilot_02_trust_pack.md`), and PPTX client-template loop (binary metadata extraction, default mapping, `ExportModal` persistence, exporter binding tests).
- **`PILOT-DEMO-1`–`4` Done:** brand-tracker synthetic dataset + ground truth, recipe demo + gap log (`pilot_04a` INF-06…09), tracker deck exemplar candidate, Load Example / wave-refresh / EVAL-07 freeze. Consultant north-star sign-off remains the exemplar-promotion bar.
- Remaining pilot rows (`PILOT-4a/4b/5/6/7`) stay on the active tracker.

### Presentation, Technical UI, and Design Reset (July 2026)

- **`STAB-UI-F1`–`F4` Done:** slide frame/shrink-wrap/view transitions/stats toggles; chrome density; activation (welcome-back, first-crosstab tour, workspace banner); command palette shelf actions. Pilot presentation gate closed via [PR #18](https://github.com/cbrown564-alt/velocity/pull/18); evidence in `docs/assets/ui-pilot-readiness-audit/`. Spec: `plan_02_ui_presentation_workstream.md`. Leftovers on tracker: `STAB-UI-F5` (frozen), `F6`, `VAR-1`.
- **`STAB-UI-T1`–`T7` Done:** store selectors, modal foundation, error boundaries, z-index tokens, VM theme fix, shortcuts/hygiene, recode wiring. Spec: `plan_03_ui_technical_foundation.md`.
- **`DESIGN-RESET-1` Done:** Pathway B deck-first IA + evolved Soft Machine; evidence pack `docs/assets/design-reset-evidence/`; docs reconciled in `design_01_system.md` / `design_02_ux_modes.md`. Supersedes multi-theme switcher, resident variable sidebar, analysis shelf, timeline dock, coaching layer.
- Active post-reset work is the **`DESIGN-CONV-*`** board on the tracker.

### CI Truth Maintenance (`STAB-CI`, July 2026)

- **`STAB-CI-2`–`22` Done:** local/`ci` parity playbook, ESLint ratchet, E2E companion enforcement, DuckDB Arrow browser smoke, coverage ratchets (store/services/features/overlays + per-path floors), parity gate in CI, parallel jobs, lefthook, `ci:lint`/`ci:full`, `@visual` quarantine + non-blocking visual workflow, CI artifacts/bootstrap, doc sync. Owner: `arch_08_testing.md`, `playbooks/pre_pr_verification.md`.
- Remaining: `STAB-CI-23` (features/overlays floor raise), `STAB-CI-19` (mutation threshold, blocked), and deferred further ratchets.

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
- `docs/reviews/ui_ux_review_2026-05/findings.md` (UXR register — all entries fixed June 2026)
- `docs/audit_06_ui_ux_review_2026-05.md`
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
