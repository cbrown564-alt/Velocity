# Velocity agent skills

Project-local skills for Cursor agents. Complements [`AGENTS.md`](../AGENTS.md) and [`docs/playbooks/`](../docs/playbooks/).

**Location:** `.agents/skills/<skill-name>/SKILL.md`  
**Note:** `.agents/` is gitignored by default — copy or un-ignore if you want these versioned with the repo.

## How skills relate to playbooks

| Type | Role |
| :--- | :--- |
| **Playbook** (`docs/playbooks/*.md`) | Canonical procedure and invariants |
| **Skill** (this folder) | When to trigger + pointers; thin wrappers delegate to playbooks |
| **AGENTS.md** | Global rules and playbook index |

If a skill names a playbook, read and follow that playbook — the skill does not replace it.

## Task → skill index

### Planning and scope

| Task | Skill |
| :--- | :--- |
| Stress-test a plan before coding | `grill-with-docs` |
| Turn a plan into a dependency board | `plan-to-kanban` |
| Check alignment with roadmap/tracker | `scope-drift-audit` |
| Decide if work is in scope / worth doing | `workstream-scope-gate` |
| Review or extend the skill set | `skill-system-review` |

### Data and statistics

| Task | Skill | Playbook / doc |
| :--- | :--- | :--- |
| Ingestion, harmonization, categorical codes/labels | `dual-state-data` | `arch_02_data_model.md` |
| Crosstabs, weights, significance, denominators | `stats-integrity` | `playbooks/stats_integrity.md` |

### Engine, worker, MCP

| Task | Skill | Playbook / doc |
| :--- | :--- | :--- |
| Engine API, MCP tools, session, ResultEnvelope | `engine-boundary-change` | `playbooks/engine_api_change.md` |
| Browser → EngineProxy migration | `worker-migration` | `playbooks/worker_migration.md` |
| MCP analysis session → deck | `agent-analysis-workflow` | `playbooks/agent_analysis_workflow.md`, `guide_agent_quickstart.md` |

### UI, performance, debugging

| Task | Skill | Playbook |
| :--- | :--- | :--- |
| React UI, tokens, Manager vs Canvas | `ui-mode-change` | `playbooks/ui_mode_change.md` |
| Slow queries, jank, perf regression | `performance-pass` | `playbooks/performance_pass.md` |
| Runtime errors, wrong output, worker failures | `log-triage` | `playbooks/log_triage.md` |

### Implementation process

| Task | Skill | Playbook |
| :--- | :--- | :--- |
| New behavior / features (test strategy) | `add-tests-first` | `playbooks/add_tests_first.md` |
| Red/green/refactor while coding | `tdd` | `arch_08_testing.md` |
| Refactor without behavior change | `refactor-safely` | `playbooks/refactor_safely.md` |

### Evals

| Task | Skill | Doc |
| :--- | :--- | :--- |
| Run or interpret agent capability evals | `agent-eval-run` | `eval_framework.md`, `evals/README.md` |

## Playbooks without a dedicated skill

All listed playbooks have a matching skill except none — full mapping:

| Playbook | Skill |
| :--- | :--- |
| `stats_integrity.md` | `stats-integrity` |
| `ui_mode_change.md` | `ui-mode-change` |
| `refactor_safely.md` | `refactor-safely` |
| `performance_pass.md` | `performance-pass` |
| `log_triage.md` | `log-triage` |
| `worker_migration.md` | `worker-migration` |
| `agent_analysis_workflow.md` | `agent-analysis-workflow` |
| `add_tests_first.md` | `add-tests-first` |
| `engine_api_change.md` | `engine-boundary-change` |

## Skill inventory (17)

```
add-tests-first
agent-analysis-workflow
agent-eval-run
dual-state-data
engine-boundary-change
grill-with-docs
log-triage
performance-pass
plan-to-kanban
refactor-safely
scope-drift-audit
skill-system-review
stats-integrity
tdd
ui-mode-change
worker-migration
workstream-scope-gate
```

## Adding a skill

1. Create `.agents/skills/<kebab-name>/SKILL.md` with YAML `name` and `description` (description is the trigger signal).
2. Prefer thin wrappers for playbooks; put repo-specific guardrails in the skill, procedures in the playbook.
3. Add a row to this README.
4. Run `skill-system-review` periodically against git history and tracker drift.
