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

As of the May 2026 maturity review, Phase 4 Agent Capability Validation is **complete** and the next phase should be treated as stabilization, not expansion. Key findings:

- **Engine validated:** Mean score 4.7/5 across six eval families. Computation, provenance, export, and session mechanics all work.
- **Discovery and MCP breadth are the primary gaps:** Semantic discovery (mean 3.0) and MCP workflow coverage (mean 3.0) need capability expansion. Category-aware discovery and workspace MCP tools are the P1/P2 next investments.
- **No architecture rewrite needed:** All gaps are capability expansion within the current thesis. The product direction is correct; the agent-guidance layers need to catch up with the computational substrate.
- **Four benchmark baselines frozen:** EVAL-01 (small deck), EVAL-02 (large survey), EVAL-04 (convergence), EVAL-06 (stress).
- **Quality gates are currently green but narrow:** typecheck, tests, coverage, and build pass, but coverage excludes large UI/store/product surfaces.
- **Product durability is the largest blocker:** workspace metadata exists, but stored datasets still need reliable reopen/switch/delete behavior across sessions.

Implication:
- The strategic critical path is now a **stabilization overlay** before Phase 5 expansion: reconcile docs, finish reopenable workspace durability, polish export output, enforce design-system rules, split monoliths at stable boundaries, and tighten CI/coverage truthfulness.
- All feature additions must be evaluated against the question: "Does this close a validated gap from Phase 4?"
- WebR, deeper AI, and cloud collaboration should remain deferred unless they directly support the stabilization priorities above.
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
