# Velocity Strategic Roadmap (Short Guide)

This is the high-level planning document. It defines what we are optimizing for, in what order, and which docs govern decisions.

For execution details and dependencies, use:
- [docs/tracker_00_implementation_status.md](tracker_00_implementation_status.md)

## 1. Strategic Intent

- Deliver survey-native analysis parity with Displayr/SPSS workflows while preserving local-first speed.
- Keep architecture strict: portable core logic, Worker-side compute, and dual-state data integrity.
- Sequence advanced capabilities only after Phase 2 commercial-critical gaps are closed.

## 2. Delivery Sequence (Priority Clusters)

1. Phase 2 closure (commercial critical)
- Statistical Engine Phase 2 (pairwise, correction, overlap, TSL decision)
- Editable PPTX export parity

2. Phase 3 foundation (Engine Convergence)
- `VelocityEngine` unification
- Semantic layer & discovery tools
- MCP server foundation

3. Phase 4 validation (Agent Capability)
- Intended-path readiness & session round-tripping
- Task portfolio execution & eval tracking
- Capability gap analysis

4. Phase 5 expansion (Advanced stats)
- Harmonization workspace baseline
- WebR bridge & advanced stats

5. Phase 6/7 extensions (Cognitive Engine & Cloud)
- Deep semantic reasoning
- Realtime collaboration & platform imports

## 2.1 Current Reality Check

As of **May 19, 2026**, Phase 4 validation is complete and the **May stabilization sprint is complete** (`STAB-DOC-1` through `STAB-CI-1` on tracker §4.2). Key findings:

- **Engine validated:** Mean score 4.7/5 across six eval families. Computation, provenance, export, and session mechanics all work.
- **Stabilization shipped:** Reopenable workspace (`STAB-WS-1`), matrix MCP + PPTX polish (`STAB-EXP-1`), design-token CI (`STAB-DS-1`), production build + E2E gates (`STAB-CI-1`).
- **Discovery and MCP breadth remain the active Phase 4 gaps:** Semantic discovery (mean 3.0) and MCP workflow coverage (mean 3.0). Category-aware discovery (`S4-DISC-1`) is Done; **next authorized expansion:** finish `S4-DEF-1`, then `S4-MCP-1` / `S4-MCP-2` / `S4-EVAL-5b` (tracker §4.2.1).
- **No architecture rewrite needed:** Gaps are capability expansion within the current thesis. Orchestration debt in `App.tsx` / `dataSlice` is addressed via scoped `STAB-ARCH-1` slices (tracker §8), not a big-bang refactor.
- **Four benchmark baselines frozen:** EVAL-01 (small deck), EVAL-02 (large survey), EVAL-04 (convergence), EVAL-06 (stress).
- **Quality gates are green but narrow:** typecheck (incl. MCP), tests, coverage, build, and Playwright E2E pass; Vitest coverage still excludes large UI/store surfaces.

Implication:
- The strategic critical path is **Phase 4 follow-through**, not Phase 5 expansion: `S4-DEF-1` → `S4-MCP-1` → parallel `S4-MCP-2` / `S4-EVAL-5b`, with `STAB-ARCH-1` thin slices in parallel when they do not conflict with active MCP PRs.
- All feature additions must be evaluated against: "Does this close a validated gap from Phase 4?"
- WebR (`S5-R-1`), deeper AI (Phase 6), and cloud collaboration (Phase 7) remain frozen until Phase 4 follow-through rows are Done.
- See `docs/archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md` for the full Phase 4 decision package.

## 3. Scope Governance

- Default to `Keep/Delay/Reject` logic from feature matrix before starting implementation.
- All new capabilities must be exposed via the `VelocityEngine` and MCP before the React UI.
- Do not start dependent work if predecessor contracts (eval passes) are unresolved.

## 4. Which Docs To Use (And When)

| Doc | Use when | Why it exists |
| :--- | :--- | :--- |
| [docs/README.md](README.md) | Looking for documentation | Active documentation map and archive policy |
| [`AGENTS.md`](../AGENTS.md) | Starting any task or assigning agent roles | Master operating rules, invariants, and role expectations |
| [docs/tracker_00_implementation_status.md](tracker_00_implementation_status.md) | Planning or executing active work | Dependency-first execution board with statuses and gates |
| [docs/blue_02_feature_matrix.md](blue_02_feature_matrix.md) | Deciding whether a feature is in/out/late | Scope gate source of truth (`Keep/Delay/Reject`) |
| [docs/archive/strategy/blue_01_unified_roadmap.md](archive/strategy/blue_01_unified_roadmap.md) | Need full historical roadmap rationale | Archived long-form context, not current status authority |
| [archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md](archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md) | Interpreting Phase 4 conclusions (historical) | Validated/unvalidated claims and frozen baseline summary |
| [docs/eval_framework.md](eval_framework.md) | Creating, running, or judging an agent evaluation | Scoring rubric and capability-gap classification |
| [docs/arch_01_system_architecture.md](arch_01_system_architecture.md) | New feature or major refactor | System boundaries and component map |
| [docs/arch_07_agent_architecture.md](arch_07_agent_architecture.md) | Modifying engine boundaries or MCP tools | Strict rules for the headless orchestration layer |
| [docs/arch_02_data_model.md](arch_02_data_model.md) | Data structures, ingestion, metadata, types | Dual-state data model invariants |
| [docs/arch_03_headless_core.md](arch_03_headless_core.md) | Touching `src/core/*` or adapters | Platform seam and dependency direction |
| [docs/arch_04_statistical_engine.md](arch_04_statistical_engine.md) | Statistical methods or significance logic | Survey-native statistical correctness rules |
| [docs/arch_05_visualisation_engine.md](arch_05_visualisation_engine.md) | Charts/D3/canvas behavior or performance | Visualization architecture and rendering phases |
| [docs/arch_06_local_first_persistence.md](arch_06_local_first_persistence.md) | Persistence/state durability decisions | Local-first persistence strategy and tradeoffs |
| [docs/design_01_system.md](design_01_system.md) | UI styling, tokens, component theming | Design-system tokens and visual rules |
| [docs/design_02_ux_modes.md](design_02_ux_modes.md) | Manager vs Canvas flow changes | UX mode separation constraints |
| [docs/arch_08_testing.md](arch_08_testing.md) | Test planning for new/changed behavior | Testing strategy and quality guardrails |
| [.github/pull_request_template.md](../.github/pull_request_template.md) | Opening any PR | Standard contract/risk/test evidence format |
| [docs/agent_handoff_template.md](agent_handoff_template.md) | Any multi-agent handoff | Required transfer artifact between owners |

## 5. Working Agreement

1. Strategy lives here.
2. Execution order and state live in `tracker_00_implementation_status.md`.
3. Contracts and evidence live in PRs using `.github/pull_request_template.md`.
4. Multi-agent transitions require `docs/agent_handoff_template.md`.
5. When tracker status and roadmap narrative diverge, reconcile using the most recent commit evidence first, then update both docs in the same PR.
