# Velocity Documentation

Navigation hub for live documentation. **Agent rules: [`AGENTS.md`](../AGENTS.md)** at repo root.

## Start here

| Need | Read |
| :--- | :--- |
| What to work on | `tracker_00_implementation_status.md` |
| Why and sequencing | `roadmap_00_strategic_guide.md` |
| Scope gates | `blue_02_feature_matrix.md` |
| Local setup | `dev_01_contributing.md` |
| MCP / agent workflow | `guide_agent_quickstart.md` + `AGENTS.md` |
| Eval scoring & gaps | `eval_framework.md` + `evals/README.md` |

## Architecture (`arch_*`)

| Doc | Topic |
| :--- | :--- |
| `arch_01_system_architecture.md` | System map: UI, worker, core |
| `arch_02_data_model.md` | Dual-state survey data model |
| `arch_03_headless_core.md` | Portable core and adapters |
| `arch_04_statistical_engine.md` | Survey-native statistics |
| `arch_05_visualisation_engine.md` | Charts and rendering |
| `arch_06_local_first_persistence.md` | Persistence strategy |
| `arch_07_agent_architecture.md` | Engine, MCP, deck, session, workspace, provenance |
| `arch_08_testing.md` | Testing and CI gates |

## Design (`design_*`)

| Doc | Topic |
| :--- | :--- |
| `design_01_system.md` | Theme tokens and Tailwind rules |
| `design_02_ux_modes.md` | Workspace, Canvas, Variable Manager |
| `design_06_semantic_layer.md` | Annotations, concepts, discovery |

Deck, session, and workspace contracts are in **`arch_07`** §5, §8–§9. Historical UX/deck/workspace design briefs: `archive/2026-05/design/`.

## Procedures

- `playbooks/` — refactors, stats, engine API, UI modes, worker migration, agent analysis, triage
- `guide_plugin_authoring.md` — plugins
- `agent_handoff_template.md` — multi-agent handoffs
- `ref_00_glossary.md` — terminology

## Evals (outside `docs/`)

| Location | Contents |
| :--- | :--- |
| `eval_framework.md` | Scoring rubric + gap classification |
| `eval_00_run_summary_schema.ts` | `summary.json` schema |
| `evals/eval-NN/brief.md` | Canonical benchmark briefs |
| `evals/eval-NN/runs/` | Frozen run evidence |
| `evals/eval-NN/scripts/` | Optional engine repro scripts (e.g. EVAL-02) |
| `evals/templates/` | Result and synthesis templates |

Phase 4 synthesis (historical): `archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md`. Current claims: roadmap §2.1 and tracker.

## Archive

`docs/archive/` — historical plans, audits, reports, and superseded design briefs. Evidence only; extract invariants into active docs before citing.
