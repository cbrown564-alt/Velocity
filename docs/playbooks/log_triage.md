## Purpose
Diagnose and fix runtime failures, incorrect outputs, or unexpected UI behavior in a structured way that preserves architectural integrity.

This playbook applies to:
- runtime errors or crashes
- incorrect statistical results
- UI inconsistencies after user actions
- ingestion failures or schema mismatches
- worker communication errors
- regression bugs after recent PRs

## Non-negotiable invariants
- Do not bypass worker/core boundaries to “quick fix” an issue.
- Do not silently coerce data to make errors disappear.
- Do not remove statistical metadata (denominators, labels) to unblock UI.

## Inputs you MUST read
Based on where the issue appears:

| Symptom | Read |
|---------|------|
Data shape mismatch / ingestion error | `arch_02_data_model.md` |
Incorrect statistical output | `arch_04_statistical_engine.md` |
Worker errors / async failures | `arch_01_system_architecture.md`, `arch_03_headless_core.md` |
UI inconsistency between modes | `design_02_ux_modes.md` |

## Required PR artifacts
- Bug summary:
  - user-visible symptom
  - reproduction steps (minimal)
  - expected vs actual behavior
- Root cause summary:
  - which layer failed (UI / bridge / worker / core)
  - why it failed
- Test added to prevent recurrence

## Workflow

### Step 0 — Reproduce minimally
Create the smallest:
- dataset fixture
- filter setup
- UI interaction sequence

that reliably triggers the bug.

### Step 1 — Classify the failure
Identify where it occurs:

| Layer | Typical Issues |
|-------|----------------|
UI | stale state, incorrect mode transitions |
Bridge | message payload mismatch |
Worker | query errors, missing columns |
Core | logic error in transforms |
Data | missing labels, invalid types |

### Step 2 — Trace the data flow
Follow:
- ingestion → core → worker → UI render

Check at each boundary:
- expected type/shape
- presence of labels for categorical
- denominators for computed stats

### Step 3 — Identify root cause
Examples:
- filter not applied before aggregation
- weights ignored in mean calc
- adapter returning mismatched schema
- UI assuming synchronous result

Avoid:
- patching the UI when the worker result is wrong
- casting types to “fix” mismatches

### Step 4 — Write a failing test
Prefer:
- unit or contract test for logic bugs
- golden test for stat discrepancies
- mode-boundary test for UI issues

Test must fail before fix is applied.

### Step 5 — Implement the fix
Fix in the correct layer:
- ingestion → schema handling
- core → logic
- worker → query
- UI → rendering/state only

Avoid cross-layer fixes.

### Step 6 — Validate architecture constraints
Confirm:
- core remains portable
- compute remains in worker
- dual-state preserved

### Step 7 — Reviewer checklist
Reviewers should verify:
- minimal reproduction described
- root cause identified (not guessed)
- failing test added before fix
- correct layer addressed

## Common failure modes (avoid these)
- UI workaround for engine bug
- removing weights to avoid calc errors
- ignoring missing labels
- broad try/catch around query logic
- skipping tests for “small” bugs

## Definition of Done
- minimal repro documented
- failing test added then passes
- fix applied in correct layer
- no invariant violations introduced