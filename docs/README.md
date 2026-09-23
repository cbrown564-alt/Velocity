# Velocity Documentation

Navigation hub for live documentation. **Agent rules: [`AGENTS.md`](../AGENTS.md)** at repo root.

## Start here

| Need | Read |
| :--- | :--- |
| What to work on | `tracker_00_implementation_status.md` (short current-work board and parked work) |
| Historical cursor capacity sprint | `cursor-capacity-sprint/PLAN.md` + `cursor-capacity-sprint/R0_RECONCILIATION.md` (past execution aid; tracker owns current work) |
| **Engine boot / CI truth incident** | **`audit_10_engine_boot_ci_truth_rca_2026-07-14.md`** — closed July 15, 2026; canonical root cause, protected-promotion, and ten-pair soak evidence |
| **Historical pilot UI presentation review** | **`audit_07_pilot_presentation_readiness_2026-07-01.md`** — pre-reset baseline and PPR fix evidence; not final redesign photography |
| **User journey screenshots** | **`user_journey_screenshots.md`** — current reset-era journey, evidence screenshots, and known gaps |
| Historical pilot preparation | `pilot_00_brief.md`, `pilot_01_packaging.md`, `pilot_02_trust_pack.md`, `pilot_06_paid_pilot_program.md`, and `pilot_evidence_collection_checklist.md` — reference material; external pilot work is inactive |
| Historical deck-native plan | `deck_native_multi_agent_plan.md` — past planner/designer/builder/evaluator protocol |
| What has shipped | `completed_foundations_summary.md` |
| Code quality remediation | `kanban_thermo_nuclear_remediation.md` (June 2026 thermo-nuclear review board) |
| Why and sequencing | `roadmap_00_strategic_guide.md` |
| Feature decisions | `blue_02_feature_matrix.md` (historical Keep/Delay/Reject record; current choices live in the tracker and strategic guide) |
| Local setup | `dev_01_contributing.md` |
| MCP / agent workflow | `guide_agent_quickstart.md` + `AGENTS.md` |
| Research-quality benchmark | `workstreams/research_quality/00_strategy.md` + `../evals/research_quality/README.md` (experimental; frozen studies, capped model pilot and blinded review prototype) |
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
| `arch_08_testing.md` | Testing and CI checks |

## Design (`design_*`)

| Doc | Topic |
| :--- | :--- |
| `design_01_system.md` | Theme tokens and Tailwind rules |
| `design_02_ux_modes.md` | Workspace, Canvas, Variable Manager |
| `design_06_semantic_layer.md` | Annotations, concepts, discovery |
| `plan_05_design_reset_implementation.md` | Design-reset foundation status and remaining validation |
| `plan_07_researcher_journey_and_output_quality.md` | Current two-track plan: continuous researcher journey and evidence-led PPTX/XLSX quality |

Deck, session, and workspace contracts are in **`arch_07`** §5, §8–§9. Historical UX/deck/workspace design briefs: `archive/2026-05/design/`.

## Procedures

- `plan_01_comprehensive_ui_ux_review.md` — multi-session UI/UX review program (May 2026; UXR complete)
- `plan_02_ui_presentation_workstream.md` — historical presentation plan; check the tracker for current work
- `plan_03_ui_technical_foundation.md` — historical technical UI plan; check the tracker for current work
- `plan_05_design_reset_implementation.md` — implemented reset foundation and remaining validation context; the tracker owns current sequencing
- `plan_07_researcher_journey_and_output_quality.md` — current steps and evidence for the researcher journey and separate output-quality track
- **`audit_07_pilot_presentation_readiness_2026-07-01.md`** — historical pre-reset presentation baseline (Linear bar, PPR fixes, screenshots in `assets/ui-pilot-readiness-audit/`)
- `reviews/ui_ux_review_2026-05/` — findings register and session notes for that program
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

Phase 4 synthesis (historical): `archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md`. Check the tracker and strategic guide for current claims.

## Archive

`docs/archive/` — historical plans, audits, reports, and superseded design briefs. Evidence only; extract invariants into active docs before citing. May 2026 deep review: `archive/2026-05/audits/audit_05_deep_code_review_2026-05-19.md` is summarized in `completed_foundations_summary.md`; active sequencing lives in the tracker.
