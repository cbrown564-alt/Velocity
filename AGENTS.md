# Velocity Agent Operating System

Single source of truth for autonomous agents in this repository: invariants, documentation triggers, role expectations, and mandatory playbooks.

## 0. Documentation Model

Use `docs/README.md` as the navigation hub. Active docs are product contracts, strategy, playbooks, and the tracker. `docs/archive/` is historical evidence only.

**Before substantive work, read:**

- `docs/README.md` — documentation map
- `docs/roadmap_00_strategic_guide.md` — strategy and sequencing
- `docs/tracker_00_implementation_status.md` — execution board (includes `STAB-DS-1` design-system tasks in §7)
- `docs/blue_02_feature_matrix.md` — scope gates

Current priority: **stabilization before expansion** (docs truth, workspace reopen, export quality, design-system enforcement, CI truthfulness).

Phase 4 validation is complete. New eval work uses `docs/eval_framework.md` and frozen `evals/` artifacts.

## 1. Documentation Triggers

Paths are relative to `docs/` unless noted.

| If you are touching... | You MUST read... | Why? |
| :--- | :--- | :--- |
| **MCP tools / agent analysis** | `guide_agent_quickstart.md` | Tool reference and workflow entry point |
| **Agent capability evals** | `eval_framework.md`, `evals/README.md` | Scoring, gap classification, run artifacts |
| New feature or major refactor | `arch_01_system_architecture.md` | System boundaries |
| Data structures, ingestion, types | `arch_02_data_model.md` | Dual-state model |
| `src/core/*` or `adapters/*` | `arch_03_headless_core.md` | Adapter seam |
| `src/engine/*` or `VelocityEngine` | `arch_07_agent_architecture.md` | Engine boundary and provenance |
| `mcp-server/*` or MCP tools | `arch_07_agent_architecture.md` §6 | Thin transport; no business logic in handlers |
| `src/core/semantic/*` | `design_06_semantic_layer.md` | Semantic tiering and confidence rules |
| Session / `.velocity` files | `arch_07_agent_architecture.md` §8 | Session format and import invariants |
| Workspace / OPFS / multi-dataset UI | `arch_07_agent_architecture.md` §9 | Workspace types and persistence |
| Analysis deck / slides | `arch_07_agent_architecture.md` §5 | Deck spec and slide contracts |
| Statistics, weights, significance | `arch_04_statistical_engine.md` | Survey-native methodology |
| Charts, D3, canvas | `arch_05_visualisation_engine.md` | Visualization architecture |
| Worker / `EngineProxy` | `arch_07_agent_architecture.md` §11, `playbooks/worker_migration.md` | Convergence and migration |
| `docs/` or prioritization | `README.md`, `roadmap_00_strategic_guide.md`, `tracker_00_implementation_status.md`, `blue_02_feature_matrix.md` | Scope and sequencing |
| React UI, CSS, tokens | `design_01_system.md`, `design_02_ux_modes.md`, tracker §7 if styling | Tokens and mode separation |
| CI / testing / workflows | `arch_08_testing.md`, `playbooks/pre_pr_verification.md` | Local ↔ CI gate parity |

## 2. Global Invariants

1. **Dependency direction:** `src/core/` and `src/engine/` have no React/DOM/browser dependencies.
2. **Main-thread compute:** Heavy work runs in the Web Worker.
3. **Data model integrity:** Dual-state categorical data (codes + labels) is never broken.
4. **Docs-to-code sync:** No new docs unless requested; update existing docs only when contracts change.
5. **Engine boundary:** Pure logic in `core/`; orchestration in `engine/`; transports are thin wiring only.
6. **Provenance:** Engine outputs use `ResultEnvelope`.
7. **Session stability:** `VelocitySessionFile` version bumps require migrations; no field removals.

## 3. Coordination Templates

- PR: `.github/pull_request_template.md`
- Handoff: `docs/agent_handoff_template.md`

## 4. Agent Role Cards

### Architect
Inputs: `arch_01`, `arch_03`, `arch_07`, relevant `design_*`, roadmap, feature matrix. Output: design brief. Done when invariants and scope gates are respected.

### Implementer
Inputs: `arch_02`, `arch_03`, `arch_07` (+ domain docs). Output: code + tests. Done when `docs/playbooks/pre_pr_verification.md` gates pass (or CI equivalent), envelope/provenance rules hold, no logic in transports.

### Maintainer
Inputs: `arch_03`, `design_01`, `design_02`. Zero behavior change unless tests updated.

### Reviewer
Checklist: dual-state, core portability, stats/UX/engine/MCP/session rules per §2.

## 5. Operational Playbooks

| Task | Playbook |
| :--- | :--- |
| Refactor | `docs/playbooks/refactor_safely.md` |
| New behavior | `docs/playbooks/add_tests_first.md` |
| Pre-PR / CI verification | `docs/playbooks/pre_pr_verification.md` |
| Statistics | `docs/playbooks/stats_integrity.md` |
| Performance | `docs/playbooks/performance_pass.md` |
| Triage | `docs/playbooks/log_triage.md` |
| UI / UX modes | `docs/playbooks/ui_mode_change.md` |
| Engine API | `docs/playbooks/engine_api_change.md` |
| Worker migration | `docs/playbooks/worker_migration.md` |
| MCP analysis | `docs/guide_agent_quickstart.md`, `docs/playbooks/agent_analysis_workflow.md` |
| Evals | `docs/eval_framework.md`, `evals/README.md` |

Playbooks are mandatory for execution tasks.
