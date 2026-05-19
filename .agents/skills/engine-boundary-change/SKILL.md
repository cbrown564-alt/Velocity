---
name: engine-boundary-change
description: Use when adding or changing VelocityEngine methods, MCP tools, CLI handlers, EngineProxy/worker calls, session format, or ResultEnvelope outputs. Keeps logic in core/engine and transports thin.
---

# Engine Boundary Change

Treat engine and transport changes as **contract changes**, even when the diff looks small. Velocity has multiple consumers (browser, MCP, CLI, session) that must stay aligned.

## Mandatory Playbook

For engine API work, follow `docs/playbooks/engine_api_change.md` step by step. This skill adds repo-specific guardrails; it does not replace the playbook.

## Required Reading

Read based on touch surface:

| Touching | Read |
| :--- | :--- |
| Engine methods / orchestration | `docs/arch_07_agent_architecture.md`, `docs/arch_03_headless_core.md` |
| MCP tools | `arch_07` §6, `docs/guide_agent_quickstart.md` |
| Session / `.velocity` | `arch_07` §8 |
| Worker / browser | `arch_07` §11, `docs/playbooks/worker_migration.md` |
| Deck / slides | `arch_07` §5 |

## Workflow

1. State the contract change in 5–10 lines: inputs, outputs, consumers affected, failure modes.
2. Confirm layering:
   - pure logic → `src/core/`
   - stateful orchestration → `src/engine/`
   - wiring only → `mcp-server/`, CLI, `EngineProxy`
3. Ensure data-returning engine methods use `ResultEnvelope` (inputs, duration, warnings, dataset metadata).
4. If session format changes: bump version, add migration, add backward-compat test; no field removals.
5. Add tests at engine boundary first; add consumer contract test when behavior crosses transport.
6. Update docs only when an established contract changed.

## Red Flags

- SQL, stats, or harmonization logic inside MCP tool handlers
- new browser-only analysis paths that bypass the engine
- envelope skipped for convenience
- session fields removed or renamed without migration
- DuckDB/Arrow work scheduled on the main thread

## Completion Criteria

Before finishing, summarize:

- contract change and why engine is the right layer
- consumers updated (`browser`, `MCP`, `CLI`, `session`, `export`, etc.)
- tests and playbook steps completed
- compatibility or migration notes
