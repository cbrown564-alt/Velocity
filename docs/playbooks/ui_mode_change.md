## Purpose
Make changes to the UI that respect mode separation and design system constraints, preventing “Manager vs Canvas” drift.

This playbook applies to:
- any changes in the Variable Manager, Analysis Canvas, or transitions between them
- adding panels, commands, keyboard shortcuts, or layout changes
- changes to theme tokens, typography, spacing, or component styling
- introducing new interactive flows (e.g., slide/deck interactions)

## Non-negotiable UI invariants
1) **Strict mode separation**
- The Variable Manager and Analysis Canvas have distinct responsibilities.
- Avoid adding Canvas-only concepts into the Manager (and vice versa) unless explicitly part of the UX spec.

2) **Design tokens are the source of truth**
- Use defined theme tokens and system components.
- Avoid one-off styling that creates a parallel design language.

3) **State boundaries remain intentional**
- UI state management should remain consistent with your architecture choices.
- Avoid “shortcut state” that duplicates canonical engine state unless explicitly justified.

4) **Performance sensitivity**
- UI must not trigger heavy compute on main thread.
- Prefer debounced actions and worker-side computation for expensive operations.

## Inputs you MUST read
- `design_01_system.md` (tokens, component system, styling rules)
- `design_02_ux_modes.md` (mode separation, intended UX responsibilities)
- If the change affects analysis deck/canvas concepts: `arch_07_agent_architecture.md` §5

## Output artifacts required in the PR
- PR description includes:
  - which mode(s) affected
  - UX intent in 3–6 bullets (what a user can now do)
  - any new state introduced and where it lives
- Tests or checks:
  - at least one mode-specific assertion (see Testing section)
  - manual verification checklist completed (5 minutes max)

## Workflow

### Step 0 — Identify the mode and the user job
Write one sentence:
- “In **[Mode]**, the user should be able to **[job]**.”

If your change affects both modes, say how responsibilities are split.

### Step 1 — Confirm the change belongs in this mode
Ask:
- Is this discovery/management of variables? → likely Manager
- Is this building/arranging/iterating on analyses/visuals? → likely Canvas
- Is this a cross-mode concern? → add explicit transition points (commands/navigation), don’t blur responsibilities.

### Step 2 — Use system components and tokens
- Prefer existing components/styles.
- If you need a new pattern:
  - first, attempt composition of existing components
  - if still needed, introduce a new component in the design system layer (not inline per-screen hacks)

### Step 3 — Keep state single-sourced
- Decide where the canonical state lives:
  - engine/core outputs (data/stats)
  - UI store (layout, selection, view state)
- Avoid duplicating derived state in multiple places; compute derived state in one place and memoize if needed.

### Step 4 — Ensure compute stays out of the main thread
- UI actions should enqueue work to worker/engine; UI renders results.
- Add debouncing/throttling for user-driven rapid updates (filters, sliders) where appropriate.
- Avoid large object cloning in UI state.

### Step 5 — Add the smallest meaningful test
Prefer tests that are resilient:

**Mode boundary tests (recommended)**
- Verify Manager renders Manager-only panels
- Verify Canvas renders Canvas-only controls
- Verify navigation/command transitions switch modes correctly
- Verify a Canvas action does not mutate Manager-only state unexpectedly

**E2E companions (required when changing shortcuts, onboarding, banners, or theme labels)**
- Update Playwright specs or helpers in the same PR — see `docs/playbooks/pre_pr_verification.md`
- Run `npm run ci:e2e` before merge

**Token usage checks**
- If you have lint rules: enforce token usage
- Otherwise, prefer component-level assertions rather than style snapshots

### Step 6 — Manual verification checklist (fast)
Do a short manual check:
- Switch Manager ↔ Canvas
- Confirm focus/keyboard behavior isn’t broken
- Confirm no UI freeze when triggering analysis (worker compute)
- Confirm responsive layout doesn’t collapse key panels
- Confirm theme/tokens still apply (no visual anomalies)

### Step 7 — Document only when it changes UX rules
Update existing design docs only if:
- you changed mode responsibilities
- you introduced a new reusable component pattern
- you changed tokens or theme rules

No proactive new docs.

## Reviewer checklist
Reviewers should verify:
- mode separation is preserved
- no main-thread heavy compute added
- design tokens/components are used consistently
- state is not duplicated or fighting canonical engine state
- tests/checklist are present and meaningful

## Common failure modes (avoid these)
- adding Canvas concepts into Manager “just to be convenient”
- inline styling that bypasses tokens
- “temporary” local state that becomes permanent and diverges
- triggering worker computations in tight UI loops without debouncing
- UI tests that assert brittle layout details instead of responsibilities

## Definition of Done
- UX intent stated
- mode separation preserved
- tokens/components used correctly
- at least one mode-boundary test or check added
- manual verification checklist completed