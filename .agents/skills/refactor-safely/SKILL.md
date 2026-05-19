---
name: refactor-safely
description: Use for non-trivial refactors that move, rename, or restructure code without intending behavior change. Follow the refactor safely playbook.
---

# Refactor Safely

**Mandatory playbook:** `docs/playbooks/refactor_safely.md`

Read and follow that playbook end-to-end. If behavior changes, switch to `add-tests-first` or `tdd` instead of treating this as a refactor-only PR.

## When to use

- moving code across modules or layers
- renaming or splitting abstractions
- simplifying worker/async boundaries
- folder or file reorganization

## Also read

Per touched area (see playbook): `arch_02`, `arch_03`, `arch_04`, `design_01`, `design_02`

## Completion criteria

- zero behavior change unless explicitly scoped otherwise
- existing tests still pass; no tests deleted to green the build
- PR states refactor goal and modules moved
