---
name: performance-pass
description: Use when investigating slow queries, UI freezes, ingestion bottlenecks, or performance regressions. Follow the performance pass playbook and measure before optimizing.
---

# Performance Pass

**Mandatory playbook:** `docs/playbooks/performance_pass.md`

Read and follow that playbook end-to-end. Measure the bottleneck before changing code.

## When to use

- slow DuckDB/Arrow operations
- main-thread jank or frame drops
- repeated recomputation of derived results
- perf regression after a feature or refactor

## Also read

- `docs/arch_01_system_architecture.md`
- `docs/arch_03_headless_core.md`
- `docs/arch_04_statistical_engine.md` if outputs might change

## Completion criteria

- PR includes perf hypothesis, measurement, and before/after evidence
- heavy work remains in the worker
- statistical outputs unchanged unless explicitly in scope
