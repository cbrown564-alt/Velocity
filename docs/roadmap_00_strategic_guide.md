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

2. Phase 3 foundation (advanced statistics and harmonization)
- Harmonization workspace baseline
- WebR bridge
- Advanced stats + reproducible data-prep flows

3. Phase 4 expansion (AI-native)
- Semantic coding
- Natural language querying
- Action hub integrations

4. Phase 5 extensions (backend-required)
- Realtime collaboration
- Direct platform imports

## 2.1 Current Reality Check (Based on Last 20 Commits)

As of the recent commit window (February 5, 2026 to February 23, 2026), implementation progress includes:

- Export track moved forward materially: PPTX/XLSX UI integration and shared crosstab/export plumbing landed (commits `3d80d06`, `cab233a`, `e840767`).
- Analysis Deck UX progressed: state capture, editable headers, unsaved indicators, slide duplicate/delete, and inline film-strip timeline dock (commits `a3679f7`, `b97658f`, `14adb12`, `26e0d6f`).
- Workspace advanced features landed ahead of strict critical path sequencing: longitudinal support and batch operations/export-import workflows (commits `947f2fd`, `11bfd89`).

Implication:
- The strategic critical path remains Phase 2 statistical parity closure + export fidelity sign-off.
- Recently delivered workspace/deck improvements should be treated as completed side-stream capacity, not as substitutes for remaining parity gates.

## 3. Scope Governance

- Default to `Keep/Delay/Reject` logic from feature matrix before starting implementation.
- Do not start dependent work if predecessor contracts are unresolved.
- Prefer small contract-first increments before parallel implementation.

## 4. Which Docs To Use (And When)

| Doc | Use when | Why it exists |
| :--- | :--- | :--- |
| [docs/AGENTS.md](AGENTS.md) | Starting any task or assigning agent roles | Master operating rules, invariants, and role expectations |
| [docs/tracker_00_implementation_status.md](tracker_00_implementation_status.md) | Planning or executing active work | Dependency-first execution board with statuses and gates |
| [docs/blue_02_feature_matrix.md](blue_02_feature_matrix.md) | Deciding whether a feature is in/out/late | Scope gate source of truth (`Keep/Delay/Reject`) |
| [docs/blue_01_unified_roadmap.md](blue_01_unified_roadmap.md) | Need full historical roadmap rationale | Long-form context and strategic tradeoffs |
| [docs/arch_01_system_architecture.md](arch_01_system_architecture.md) | New feature or major refactor | System boundaries and component map |
| [docs/arch_02_data_model.md](arch_02_data_model.md) | Data structures, ingestion, metadata, types | Dual-state data model invariants |
| [docs/arch_03_headless_core.md](arch_03_headless_core.md) | Touching `src/core/*` or adapters | Platform seam and dependency direction |
| [docs/arch_04_statistical_engine.md](arch_04_statistical_engine.md) | Statistical methods or significance logic | Survey-native statistical correctness rules |
| [docs/arch_05_visualisation_engine.md](arch_05_visualisation_engine.md) | Charts/D3/canvas behavior or performance | Visualization architecture and rendering phases |
| [docs/arch_06_local_first_persistence.md](arch_06_local_first_persistence.md) | Persistence/state durability decisions | Local-first persistence strategy and tradeoffs |
| [docs/design_01_system.md](design_01_system.md) | UI styling, tokens, component theming | Design-system tokens and visual rules |
| [docs/design_02_ux_modes.md](design_02_ux_modes.md) | Manager vs Canvas flow changes | UX mode separation constraints |
| [docs/arch_03_testing.md](arch_03_testing.md) | Test planning for new/changed behavior | Testing strategy and quality guardrails |
| [.github/pull_request_template.md](../.github/pull_request_template.md) | Opening any PR | Standard contract/risk/test evidence format |
| [docs/agent_handoff_template.md](agent_handoff_template.md) | Any multi-agent handoff | Required transfer artifact between owners |

## 5. Working Agreement

1. Strategy lives here.
2. Execution order and state live in `tracker_00_implementation_status.md`.
3. Contracts and evidence live in PRs using `.github/pull_request_template.md`.
4. Multi-agent transitions require `docs/agent_handoff_template.md`.
5. When tracker status and roadmap narrative diverge, reconcile using the most recent commit evidence first, then update both docs in the same PR.
