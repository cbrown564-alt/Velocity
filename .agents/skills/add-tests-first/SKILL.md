---
name: add-tests-first
description: Use when adding features or changing behavior (not zero-change refactors). Follow the add tests first playbook before implementation.
---

# Add Tests First

**Mandatory playbook:** `docs/playbooks/add_tests_first.md`

Read and follow that playbook end-to-end for new behavior, output changes, or API extensions.

## When to use

- new features
- bug fixes that change outputs
- extending public types or APIs
- statistical or UI-visible behavior changes

## Pair with

- `tdd` — red/green/refactor loop while implementing
- `refactor-safely` — when the PR is refactor-only with no behavior change

## Completion criteria

- tests planned or written before broad implementation
- PR lists behavior pinned by tests
- architecture docs read for touched layers (see playbook trigger table)
