## Purpose
Migrate browser data and analysis flows from ad hoc worker messaging to `VelocityEngine` / `EngineProxy` safely, incrementally, and without moving compute onto the main thread.

This playbook applies to:
- migrating a store slice from direct `worker.postMessage` usage to `EngineProxy`
- replacing old worker message types with engine-aligned requests
- moving browser features onto shared engine/session/deck abstractions
- removing browser-only logic that should live in engine/core instead

## Non-negotiable invariants (must remain true)
- Heavy compute stays in the **Web Worker**.
- The browser remains a thin client of the shared engine surface.
- `EngineProxy` is a transport adapter, not a business-logic layer.
- `src/core/` and `src/engine/` remain browser-independent.
- Migration work should preserve behavior unless the change is explicitly called out.
- Request/response flows must remain traceable and collision-safe.

## Inputs you MUST read
- `docs/design_phase3_browser_convergence.md`
- `docs/arch_07_agent_architecture.md`
- `docs/arch_01_system_architecture.md`
- `docs/arch_03_headless_core.md`
- `docs/design_04_session_portability.md` if slide/session restoration is touched

## Output artifacts required in the PR
- PR description includes:
  - which slice or browser flow was migrated
  - which old worker messages were replaced
  - how behavior was preserved or intentionally changed
  - what tests protect the seam after migration
- Evidence should include:
  - at least one slice-level or seam test
  - at least one integration check for the migrated flow

## Workflow

### Step 0 — Define the migration boundary
Write down:
- which slice/module is being migrated
- which worker messages it currently sends
- which `VelocityEngine` / `EngineProxy` methods will replace them
- what user-visible behavior must stay the same

Do not migrate multiple high-risk slices at once unless there is a strong reason.

### Step 1 — Locate business logic before moving anything
Inspect the current flow and classify each piece as:
- UI state shaping
- transport
- orchestration
- pure computation

Move logic to the right layer if needed:
- pure computation -> `src/core/`
- orchestration/stateful coordination -> `src/engine/`
- transport wiring only -> worker handler / `EngineProxy`
- UI state only -> store/component

If business logic is currently hidden in a slice or worker handler, extract it before or during migration.

### Step 2 — Add characterization tests first
Before changing the slice, pin the current behavior at the best available boundary:
- slice action effects
- engine proxy response handling
- worker message contract
- rendered critical state for the migrated flow

The goal is to catch accidental behavior drift while the plumbing changes.

### Step 3 — Migrate to engine-aligned calls
Replace:
- raw `worker.postMessage(...)`
- custom response wiring
- ad hoc result shaping

With:
- `EngineProxy` method calls
- `ResultEnvelope`-aware handling
- shared engine/session/deck abstractions where available

Prefer adding an engine method first if the slice currently relies on browser-only orchestration that should become shared.

### Step 4 — Preserve explicit execution semantics
Do not reintroduce hidden coupling such as:
- state mutation that silently triggers analysis as a side effect in the engine layer
- browser-specific shortcuts that bypass shared engine abstractions

If the UI needs debounced or automatic execution, keep that policy in the UI/store layer, not in the engine contract.

### Step 5 — Validate request/response integrity
Confirm:
- each request has stable matching semantics
- concurrent calls cannot collide
- loading/error states still resolve correctly
- cancellation or stale-response behavior is sane where relevant

If the old protocol was fragile, the migration should improve this, not just preserve it.

### Step 6 — Check browser/agent convergence
Ask:
- does this migration move the browser closer to the shared engine surface?
- did we remove a browser-only affordance that agents lacked?
- are we leaving behind a divergence that should now become explicit technical debt?

If the answer is “the browser still needs special powers,” document that clearly.

### Step 7 — Remove obsolete plumbing carefully
Only remove old worker messages/handlers when:
- all call sites are migrated
- tests cover the new path
- no legacy feature still depends on the old contract

If a staged migration is needed, leave a short deprecation note in code or PR context.

## Reviewer checklist
Reviewers should verify:
- heavy compute still runs in the worker
- no business logic was added to `EngineProxy`
- the migrated slice now consumes shared engine behavior
- request/response handling is safer than before
- tests pin behavior at a meaningful seam

## Common failure modes (avoid these)
- moving logic into `EngineProxy` because it is convenient
- migrating multiple slices at once and losing causal clarity
- preserving old browser-only quirks that should have been normalized
- accidentally triggering analysis from state mutation in the wrong layer
- removing old worker handlers before all call sites are migrated

## Definition of Done
- the migrated browser flow uses `EngineProxy` / shared engine calls
- behavior is preserved or intentional changes are documented
- worker/main-thread seam remains clean
- tests cover the new seam
- obsolete plumbing is removed or deliberately staged
