## Purpose
Change the public `VelocityEngine` API safely without breaking browser, MCP, CLI, session, or provenance contracts.

This playbook applies to:
- adding a new `VelocityEngine` public method
- changing parameters or return shapes of existing engine methods
- changing engine behavior visible to MCP, CLI, browser, or session workflows
- introducing new engine-owned abstractions for analysis, export, harmonization, or session work

## Non-negotiable invariants (must remain true)
- `src/core/` stays portable: **no React, no DOM APIs, no `window`, no `localStorage`**.
- `src/engine/` remains orchestration-only: stateful coordination over pure `src/core/` functions.
- Business logic MUST NOT move into transport layers (`mcp-server/`, CLI handlers, `EngineProxy`).
- Engine methods that return data MUST return a `ResultEnvelope`, unless an existing explicit exception is intentionally preserved and documented.
- Session format changes must remain backward-compatible: version bump + migration path + compatibility test.
- Browser and agent consumers should converge on the same effective engine surface, not fork it.

## Inputs you MUST read
- `docs/arch_07_agent_architecture.md`
- `docs/arch_03_headless_core.md`
- `docs/arch_07_agent_architecture.md` §8 if session or `.velocity` behavior is touched
- `docs/arch_07_agent_architecture.md` §6 if deck or MCP-facing flows are touched
- `docs/playbooks/worker_migration.md` if browser/worker consumers are touched

## Output artifacts required in the PR
- PR description includes:
  - the API change in 1-3 bullets
  - why the engine is the right layer for it
  - all consumers affected (`browser`, `MCP`, `CLI`, `session`, `export`, etc.)
  - tests added for the engine contract
  - any compatibility notes or migration plan
- Tests that cover:
  - engine happy path
  - engine error/edge case
  - at least one consumer-facing contract boundary when relevant

## Workflow

### Step 0 — Write the contract before code
Specify in 5-10 lines:
- method name
- inputs
- output shape
- warnings/errors behavior
- whether it mutates engine state
- whether it affects session, export, or transport contracts

If you cannot describe the contract clearly, do not add the method yet.

### Step 1 — Prove the engine is the right layer
Before implementation, answer:
- Is this orchestration rather than pure computation?
- Does it belong in `src/core/` instead?
- Is this actually transport-specific and therefore wrong for the engine?
- Would adding this method reduce interface divergence across browser, CLI, and agent paths?

If the answer is “this is just MCP convenience logic,” it probably does not belong on the engine.

### Step 2 — Identify all consumers
List every current or near-term consumer that depends on the engine contract:
- browser via `EngineProxy`
- MCP tools
- CLI/scripts
- session import/export
- deck/export flows

If any of these will need a contract update, include it in the same change or document why it is deferred.

### Step 3 — Add contract tests first
Prefer tests in this order:

1. Engine unit/contract tests
- assert method return shape
- assert `operation`, `inputs`, `warnings`, and `metadata` in the `ResultEnvelope`
- assert state mutations when relevant

2. Consumer seam tests
- MCP tool handler dispatches to engine without adding business logic
- `EngineProxy` mirrors engine behavior correctly

3. Session compatibility tests
- only when the API affects persisted state or import/export

### Step 4 — Implement at the right seam
Keep responsibilities clear:
- `src/core/`: pure logic and computation
- `src/engine/`: orchestration, state, provenance wrapping
- `EngineProxy`: transport bridge only
- `mcp-server/`: thin adapter only

Avoid:
- implementing the same logic in both engine and MCP
- adding browser-only conditionals inside engine methods
- leaking transport concerns into engine signatures

### Step 5 — Preserve provenance discipline
For every data-returning method, confirm:
- `data` is the result
- `operation` is meaningful and stable
- `inputs` are sufficient for auditability
- `warnings` capture non-fatal issues
- `metadata` reflects dataset/filter/weight state correctly

If provenance becomes hand-wavy, the API change is not done.

### Step 6 — Check compatibility explicitly
Review whether the change affects:
- MCP tool schemas
- quickstart/playbook docs
- browser call sites through `EngineProxy`
- session versioning
- deck/export assumptions

If a method changes shape, update all direct consumers in the same PR unless a staged migration is deliberate and documented.

### Step 7 — Document only contract changes
Update existing docs when:
- method signatures changed
- return envelopes changed
- session behavior changed
- new consumer obligations exist

Do not write speculative documentation for methods that are not actually shipped.

## Reviewer checklist
Reviewers should verify:
- the new or changed method belongs in the engine layer
- `ResultEnvelope` usage is consistent and complete
- no business logic leaked into MCP, CLI, or `EngineProxy`
- consumer contracts were updated where needed
- session/version compatibility was handled if applicable

## Common failure modes (avoid these)
- adding convenience methods that duplicate transport logic
- returning raw objects instead of `ResultEnvelope`
- changing method shapes without updating `EngineProxy` or MCP schemas
- silently changing session semantics
- putting pure computation into `src/engine/` because it feels faster

## Definition of Done
- engine contract is explicit and tested
- consumer impacts are handled or deliberately staged
- provenance remains intact
- no seam violations introduced
- docs updated only where actual contracts changed
