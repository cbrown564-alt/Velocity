---
name: log-triage
description: Use when debugging runtime errors, wrong stats, ingestion failures, worker protocol issues, or UI regressions. Follow the log triage playbook before applying fixes.
---

# Log Triage

**Mandatory playbook:** `docs/playbooks/log_triage.md`

Read and follow that playbook end-to-end before landing a fix.

## When to use

- crashes or uncaught errors
- incorrect statistical output
- ingestion or schema mismatch
- worker/message protocol failures
- UI state inconsistent after user actions

## Also read

Use the playbook's symptom → doc table. Common pairings:

- data shape → `arch_02`, `dual-state-data`
- stats wrong → `arch_04`, `stats-integrity`
- worker errors → `arch_01`, `arch_03`, `worker-migration`
- UI modes → `design_02`, `ui-mode-change`

## Completion criteria

- root cause identified with evidence
- fix respects core/worker/UI boundaries
- regression test or repro steps captured
