## Purpose
Add new functionality in a way that is safe, reviewable, and resistant to regressions by writing the right tests early.

This playbook applies to:
- new features
- behavior changes
- bug fixes that change outputs
- extending existing APIs/types
- changes to statistical outputs or UI-visible behavior

## Non-negotiable invariants (must remain true)
- `src/core/` stays portable: **no React, no DOM APIs, no `window`, no `localStorage`**.
- Heavy compute stays in the **Web Worker** (DuckDB, Arrow operations, large transforms).
- Dual-state data model is preserved (raw codes + labels stay intact).
- If behavior changes, tests MUST pin the new expected behavior.

## Inputs you MUST read (triggered by touched areas)
- Data structures/types/ingestion → `arch_02_data_model.md`
- `src/core/*` or `adapters/*` → `arch_03_headless_core.md`
- Statistical calcs/weights/significance → `arch_04_statistical_engine.md`
- Charts/renderers/canvas layout → `arch_05_visualisation_engine.md`
- UI/theme/modes → `design_01_system.md`, `design_02_ux_modes.md`

## Output artifacts required in the PR
- PR description includes:
  - user-visible behavior change (1–3 bullets)
  - which tests were added and why they prove correctness
  - any new fixtures and what they cover
- Tests that cover:
  - a “happy path” (typical usage)
  - at least one “edge case” relevant to the change
  - (when relevant) a “contract” assertion that protects invariants

## Test strategy (choose the smallest effective set)
Prefer tests in this order (fast → slow):

1) **Pure unit tests**
- pure functions (e.g., parsing, transforms, formatters)
- no worker, no DB, no UI

2) **Contract tests (recommended for seams)**
- core calls adapter interface correctly
- adapter is mocked/stubbed
- protects against dependency-direction drift

3) **Golden tests for computed outputs**
- tiny fixture dataset
- assert exact output structures + key values
- best for statistical computations and chart data series generation

4) **Integration tests**
- worker orchestration
- DuckDB query execution
- Arrow IPC ingestion
Use sparingly; keep fixtures tiny and deterministic.

5) **UI tests**
- mode switching, critical interactions
- only for the smallest number of high-value flows
- avoid fragile selectors; prefer role-based or stable IDs

## Workflow

### Step 0 — Write a micro-spec (before code)
In 5–10 lines, specify:
- what input triggers the new behavior
- what output/state change is expected
- what must NOT change (invariants)
- at least one edge case

If you can’t write this, ask the Architect.

### Step 1 — Identify the "assertable surface"
Decide what to test that:
- is stable over time
- corresponds to user value
- is closest to the logic you’re changing

Examples:
- stats: test the computed `Crosstab` / summary outputs, not the UI rendering
- ingestion: test the resulting `Dataset`/`Variable` shapes and dual-state integrity
- UI: test mode transitions + presence/absence of key panels, not pixel layout

### Step 2 — Create tiny deterministic fixtures
Keep fixtures:
- minimal (5–50 rows)
- explicit about missingness
- explicit about labels/codes for categorical
- includes weights when relevant
- stable ordering (avoid random)

### Step 3 — Write the first failing test
Write the test that demonstrates:
- current behavior is wrong/missing
- expected behavior is correct

**Rule:** The test must fail before the implementation is added.

### Step 4 — Implement the smallest change to pass
- prefer additive changes
- keep types stable unless the change explicitly requires it
- avoid refactors inside the same PR unless necessary (separate refactor PR preferred)

### Step 5 — Add an edge case test
Choose one relevant edge:
- missing values
- empty selections / empty filters
- zero weights
- single-category variables
- N=1 or tiny sample sizes
- unusual labels/codes

### Step 6 — Validate architecture constraints
Confirm:
- compute stays in worker / engine pathways
- UI layer doesn’t compute stats
- `src/core/` remains portable

### Step 7 — Document only what changed
Update existing docs only if you changed:
- a contract / type shape
- an invariant
- an interface boundary

No proactive new docs.

### Step 8 — Mutation check (when touching `src/core/`)
For logic under `src/core/`, run `npm run test:mutation` on the changed module before opening a PR. CI runs the gated scope via `.github/workflows/mutation.yml` when `src/core/**` changes. Surviving mutants in the HTML report indicate assertions that do not pin behavior.

## Reviewer checklist
Reviewers should verify:
- tests exist and would have failed before the change
- fixtures cover the right cases (happy + edge)
- outputs are pinned at a stable boundary
- invariants remain intact (worker compute, dual-state, core portability)

## Common failure modes (avoid these)
- writing tests after implementation (tests become confirmation bias)
- testing UI when you can test engine output more directly
- large fixtures that are hard to reason about
- brittle snapshot tests of entire objects when only a few fields matter
- mixing refactor + feature changes (hard to review and debug)

## Definition of Done
- at least one test added for the new behavior
- at least one edge case test added
- tests pass and meaningfully pin expected outcomes
- no invariant violations introduced