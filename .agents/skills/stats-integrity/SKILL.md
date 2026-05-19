---
name: stats-integrity
description: Use when changing crosstabs, weights, significance tests, denominators, ESS, or any computation that affects displayed survey results. Follow the stats integrity playbook before editing.
---

# Stats Integrity

**Mandatory playbook:** `docs/playbooks/stats_integrity.md`

Read and follow that playbook end-to-end before changing statistical code. Do not paraphrase its invariants away.

## When to use

- crosstabs, means, proportions, totals
- significance testing
- weighting or effective sample size
- filters that change denominators
- any user-visible computed result

## Also read

- `docs/arch_04_statistical_engine.md`
- `docs/arch_02_data_model.md` when categories, missing values, or labels are involved
- Use `dual-state-data` if the change touches categorical representation

## Completion criteria

- playbook steps completed
- tests pin denominators, weighting mode, and expected outputs
- PR notes whether results are weighted vs unweighted and which denominator applies
