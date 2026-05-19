---
name: worker-migration
description: Use when migrating browser code from direct worker messaging to VelocityEngine/EngineProxy, or removing browser-only logic that belongs in engine/core.
---

# Worker Migration

**Mandatory playbook:** `docs/playbooks/worker_migration.md`

Read and follow that playbook end-to-end before migrating a slice.

## When to use

- replacing `worker.postMessage` flows with `EngineProxy`
- aligning browser features with engine/session/deck abstractions
- removing duplicated business logic from the browser transport layer

## Also read

- `docs/arch_07_agent_architecture.md` (especially §11)
- `engine-boundary-change` when the engine API itself changes

## Completion criteria

- migration slice defined; behavior preserved or explicitly documented
- `EngineProxy` stays thin; logic in `src/engine/` / `src/core/`
- request/response tracing and tests updated
