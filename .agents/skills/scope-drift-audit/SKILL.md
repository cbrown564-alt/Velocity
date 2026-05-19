---
name: scope-drift-audit
description: Use when checking whether recent commits, active work, or a proposed change has drifted from Velocity's roadmap, tracker, feature matrix, or current stabilization priorities.
---

# Scope Drift Audit

Use this skill when the user asks whether work is still aligned with Velocity's stated plan, or before starting a large refactor or feature.

## Workflow

1. Read the core product direction:
   - `AGENTS.md`
   - `docs/README.md`
   - `docs/roadmap_00_strategic_guide.md`
   - `docs/tracker_00_implementation_status.md`
   - `docs/blue_02_feature_matrix.md`
2. Inspect recent git history and changed file clusters.
3. Identify the active development focus from commits, open tracker items, and touched modules.
4. Compare active work against current priorities:
   - stabilization before expansion (docs truth, workspace reopen, export quality, design-system enforcement, CI truthfulness)
   - architectural invariants (core portability, worker compute, dual-state, engine boundary, ResultEnvelope, session stability)
   - eval work only through `docs/eval_framework.md` and frozen `evals/` artifacts
5. Classify deviations:
   - aligned progress
   - useful detour with evidence
   - unresolved drift risk
   - likely out-of-scope or overbuild
6. Recommend continue, narrow, defer, or stop.

## Drift Signals

- implementation expands without a tracker item or scope-gate justification
- business logic lands in `mcp-server/`, CLI handlers, or `EngineProxy` instead of `src/engine/`
- heavy compute or DuckDB work moves to the main thread
- categorical handling drops codes or labels (dual-state break)
- new engine methods skip `ResultEnvelope` or session changes skip version bump + migration
- UI work ignores mode separation (`design_02_ux_modes.md`) or design tokens
- eval claims change without updating frozen run evidence or `eval_framework.md` classification

## Completion Criteria

Before finishing, summarize:

- docs and commits inspected
- current active focus
- alignment with roadmap/tracker/feature matrix
- divergences and whether they are justified
- recommended correction or next pull
