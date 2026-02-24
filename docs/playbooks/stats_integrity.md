## Purpose
Implement or modify statistical computations in a way that preserves survey-native correctness, weighting rules, and deterministic outputs.

This playbook applies to:
- crosstabs, means, proportions, totals
- significance testing (cell-vs-rest, t-tests, chi-square)
- weights / effective sample size (ESS)
- filtering logic that affects denominators
- any function that influences computed results displayed to users

## Non-negotiable statistical invariants
These are product correctness constraints, not preferences:

1) **Weights are first-class**
- If weights exist, computations must specify clearly whether they are weighted or unweighted.
- Any “mean”, “proportion”, “std dev”, “significance test” must not silently ignore weights.

2) **Denominators are explicit**
- Every calculation must define its denominator (unweighted N, weighted N, valid N, ESS, etc.)
- Missingness handling must be explicit and test-covered.

3) **Dual-state categorical handling**
- Categorical computations must preserve raw codes AND labels; never collapse into strings-only or code-only.

4) **Determinism**
- Same dataset + same filters + same settings must yield identical results.
- Avoid non-deterministic ordering or floating drift where preventable.

## Inputs you MUST read
- `arch_04_statistical_engine.md` (method definitions + standards)
- `arch_02_data_model.md` (variable types, dual-state, missingness expectations)
- If touching query execution pathways: `arch_03_headless_core.md`

## Required PR artifacts
- A brief “Method Summary” in the PR description:
  - what changed
  - whether weighted/unweighted behavior changed
  - how missingness is handled
  - how ESS (if used) is computed/updated
- Test evidence:
  - at least one golden test fixture (small synthetic dataset)
  - at least one edge-case test (missing values, zero weights, single-category, etc.)

## Workflow

### Step 0 — Declare the method precisely
Before writing code, write a short spec:
- inputs
- outputs
- formulas (even if informal)
- weighted vs unweighted
- missingness rule
- which statistical test is being used and why

If you can’t write this, stop: ask the Architect to clarify.

### Step 1 — Create minimal fixtures (tiny datasets)
Create 2–4 tiny fixtures that cover:
- categorical with labels (incl. missing)
- numeric variable with missing
- weights (including 0 weight, non-integer weights)
- a filter that changes denominators

Fixtures should be small enough to verify by hand.

### Step 2 — Implement in the correct layer
- Pure business/stat logic belongs in portable places (core/stat engine).
- Heavy aggregation/query work belongs in the worker / DuckDB pathways.
- UI should not compute stats; it should request them and render results.

### Step 3 — Make denominators visible in the output shape
Where possible, return fields like:
- `n_unweighted`, `n_weighted` (or a defined equivalent)
- `n_valid`
- `ess` (if applicable)
- flags describing missingness handling

Avoid returning a single number without the metadata needed to interpret it.

### Step 4 — Add “golden result” tests
For each fixture, assert:
- computed value(s)
- denominator fields
- rounding behavior (define it; don’t leave it accidental)
- ordering (if ordering matters)

If you use DuckDB queries:
- prefer stable ordering in SQL
- ensure type casts are explicit (avoid implicit float/int surprises)

### Step 5 — Edge case tests (must include at least one)
Pick at least one:
- all values missing
- all weights zero
- single-category crosstab row/column
- tiny N (N=1, N=2)
- extreme weights (one respondent dominates)

### Step 6 — Sanity check with an independent calculation
At least once per PR:
- compute the expected answer manually (for tiny fixture), or
- compute in a simple reference implementation (even a small inline calc in the test)

The goal is to catch “query looks right but isn’t” bugs.

### Step 7 — Reviewer checklist
Reviewers should verify:
- method is stated (weighted/unweighted + missingness)
- tests pin denominators and ESS (if relevant)
- no silent schema drift in result structures
- any changes align with `arch_04_statistical_engine.md`

## Common failure modes (avoid these)
- Weighted data but unweighted means/proportions “because it’s simpler”
- Missingness handled implicitly by SQL without an explicit spec
- Confusing unweighted N with weighted totals
- Returning only a value without denominator metadata
- Changing rounding/formatting without updating golden tests

## Definition of Done
- Method declared in PR
- Golden + edge tests pass
- Results include denominator metadata where applicable
- No UI-layer stats logic added
- Deterministic outputs verified