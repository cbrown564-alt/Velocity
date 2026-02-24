## Purpose
Perform non-trivial refactors without changing behavior, violating architectural seams, or introducing silent regressions.

This playbook applies to:
- moving code across modules/layers
- renaming/restructuring abstractions
- splitting files, reorganizing folders
- extracting helpers, introducing new interfaces
- simplifying async flows / worker boundaries

## Non-negotiable invariants (must remain true)
- `src/core/` stays portable: **no React, no DOM APIs, no `window`, no `localStorage`**.
- Heavy compute stays in **Web Worker** (DuckDB, Arrow table operations, large transforms).
- Dual-state model is preserved (raw codes + labels stay intact).
- Refactor PRs should be **zero behavior change**. If behavior changes, this is not “refactor”; treat as a feature PR.

## Inputs you MUST read (triggered by touched areas)
- Touching `src/core/*` or `adapters/*` → read `arch_03_headless_core.md`
- Touching data structures/types/ingestion → read `arch_02_data_model.md`
- Touching query/stat calcs → read `arch_04_statistical_engine.md`
- Touching UI/modes/tokens → read `design_01_system.md`, `design_02_ux_modes.md`

## Output artifacts required in the PR
- A short PR description containing:
  - refactor goal (1–2 sentences)
  - *explicit* statement: “behavior unchanged” (or list intended behavior changes)
  - what characterization/tests you added or relied on
  - risk notes (where regressions are most likely)

## Workflow

### Step 0 — Define “behavior” for this refactor
Write down what must not change:
- API shapes / types
- query results
- serialization formats
- chart outputs (if applicable)
- performance characteristics (if sensitive)

If you can’t define it, you can’t refactor safely.

### Step 1 — Add characterization tests (before changes)
Add or strengthen tests that pin current behavior:
- “golden” snapshot outputs for stats results (small fixtures)
- deterministic dataset fixtures (including missing values + labeled categories)
- adapter seam tests (core calls adapter; adapter mocked)
- worker boundary expectations (no heavy compute in UI layer)

**Rule:** If you’re changing structure across layers, you need at least one test that would fail if you broke the seam.

### Step 2 — Make the smallest possible structural move
Prefer:
- extract function → update call sites → delete old function
- rename symbol → update imports → run formatter/linter
- wrap old API to keep compatibility while migrating internals

Avoid:
- “big bang” rewrites across multiple layers in one PR
- changing naming + behavior + architecture simultaneously

### Step 3 — Keep dependency direction honest
Before finalizing, check:
- nothing in `src/core/` imports UI/browser concerns
- adapters are the only place with platform-specific logic
- business logic didn’t drift into Zustand/UI components

### Step 4 — Minimize churn
- avoid reformatting unrelated files
- avoid moving files unless necessary
- keep commits logically grouped (optional but strongly recommended)

### Step 5 — Run full test suite + focused “risk checks”
Do a targeted manual check (5–10 minutes max) for the surfaces most likely to break.
Examples:
- load a dataset → apply a filter → produce a crosstab → render a chart
- switch UX modes (Manager ↔ Canvas) if relevant

### Step 6 — Reviewer guidance (what reviewers should look for)
Reviewers should verify:
- characterization tests exist and are meaningful
- seam rules are preserved (`core` portability, worker compute)
- dual-state invariants unchanged
- PR scope is refactor-only, not stealth feature work

## Common failure modes (avoid these)
- Refactor without characterization tests (“tests already cover it” when they don’t)
- Moving compute into main thread “because it’s simpler”
- Introducing new shared utility modules that create coupling across layers
- Changing public types as a side effect (schema drift)
- Renaming everything (low value, high risk)

## Definition of Done
- Tests pass
- Behavior unchanged (or intentional changes explicitly listed)
- No seam violations
- Minimal churn
- PR description includes test/evidence notes