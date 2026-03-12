# Velocity Agent Operating System

This document serves as the master index and rulebook for all autonomous agents operating within the Velocity repository. Our goal is to prevent documentation staleness and ensure architectural invariants are respected across multi-agent workflows.

## 1. Documentation Index & Trigger Conditions

Before modifying code, agents must read the relevant documentation based on the components they are touching.

| If you are touching... | You MUST read... | Why? (The invariant) |
| :--- | :--- | :--- |
| **Using MCP tools to analyze data (as an AI agent)** | **`guide_agent_quickstart.md`** | **Tool reference, parameters, output formats, common patterns. Start here.** |
| **Planning, running, or interpreting agent capability evals** | **`plan_phase4_agent_capability_validation.md`**, **`eval_00_agent_interface_validation.md`**, **`eval_00_outcome_decision_framework.md`**, **`eval_00_capability_gap_review.md`** | **To evaluate the full app surface against the current Phase 4 mandate and distinguish rough-edge fixes from capability gaps, interface re-engineering, or scope revision.** |
| Any new feature or major refactor | `arch_01_system_architecture.md` | To understand the "Map of the World" (main thread vs worker vs core). |
| Data structures, ingestion, or types | `arch_02_data_model.md` | To strictly preserve the "Dual-State" principle (Raw vs Labeled). |
| `src/core/*` or `adapters/*` | `arch_03_headless_core.md` | To maintain the platform-independent seam and dependency direction. |
| `src/engine/*` or `VelocityEngine` | `arch_07_agent_architecture.md` & `design_phase1_engine_provenance.md` | To respect the engine boundary (stateful orchestration over pure core), ResultEnvelope provenance, and the consumer contract. |
| `mcp-server/*` or MCP tools | `arch_07_agent_architecture.md` §6 & `design_phase2_mcp_deck_builder.md` | To keep MCP as a thin transport adapter. Zero business logic in tool handlers. |
| `src/core/semantic/*` or annotations/concepts | `design_phase4_semantic_layer.md` | To follow the tiered semantic design (annotations → concepts → suggestions) and confidence scoring rules. |
| Session format or `.velocity` files | `design_04_session_portability.md` & `arch_07_agent_architecture.md` §5 | To maintain session format backward compatibility and provide migration paths for version changes. |
| Statistical calcs, weights, or significance | `arch_04_statistical_engine.md` | To adhere to survey-native methodology and known correctness standards. |
| Charts, D3 renderers, or canvas layout | `arch_05_visualisation_engine.md` | To follow the phased chart system architecture. |
| Worker protocol or `EngineProxy` | `design_phase3_browser_convergence.md` | To follow the request-ID protocol and slice-by-slice migration order. |
| The `docs/` folder or prioritizing work | `plan_phase4_agent_capability_validation.md`, `roadmap_00_strategic_guide.md`, `blue_02_feature_matrix.md` (and `blue_01_unified_roadmap.md` for full context) | To enforce scope gates and keep sequencing aligned to the current strategic plan, including the Phase 4 validation-first priority. |
| React UI, CSS, or Theme tokens | `design_01_system.md` & `design_02_ux_modes.md` | To respect strict mode separation (Manager vs Canvas) and tokens. |

---

## 2. Global Invariants & Constraints

1. **Dependency Direction:** Code in `src/core/` MUST NOT depend on React, DOM APIs, or the browser (`window`, `localStorage`). All platform-specific logic must be injected via `DatabaseAdapter` or run in `adapters/`. Code in `src/engine/` follows the same rule — no browser dependencies.
2. **Main Thread Compute:** Heavy data processing, Arrow table manipulation, and DuckDB queries MUST run in the Web Worker. The main thread is for UI rendering and state management only.
3. **Data Model Integrity:** Never break the dual-state survey model. Categorical data must retain both its underlying integer codes and its string labels.
4. **Docs-to-Code Sync:** DO NOT proactively create new documentation files unless explicitly requested. ONLY update existing documentation if a PR actively changes an established contract or invariant.
5. **Engine Boundary:** `src/core/` contains pure functions with no state. `src/engine/` contains stateful orchestration that delegates to `src/core/`. Business logic MUST NOT live in transport adapters (`mcp-server/`, CLI handlers, `EngineProxy`). These are thin wiring layers only.
6. **Provenance:** Every `VelocityEngine` method that returns data MUST wrap its output in a `ResultEnvelope` containing inputs, duration, warnings, and dataset metadata. Skipping the envelope breaks agent auditability.
7. **Session Format Stability:** Changes to `VelocitySessionFile` MUST bump the version number and include a migration function from the previous version. No field removals — only additions (optional fields). Old sessions must import without data loss.

---

## 3. Coordination Templates

Use these templates for consistent multi-agent execution and handoffs:

- PR template: `.github/pull_request_template.md`
- Handoff template: `docs/agent_handoff_template.md`

---

## 4. Agent Role Cards

Configure your system prompt or task instructions according to your current role.

### 🏛️ Architect (Gemini Pro / Claude Opus)
*Role: System design, risk assessment, and sequencing.*
* **Inputs needed:** System architecture (`arch_01`), headless core seam (`arch_03`), agent architecture (`arch_07`), relevant phase design brief (`design_phase{1-4}_*.md`), the Phase 4 validation plan when agent-facing capability is in scope, and Roadmap/Feature Matrix for scope boundaries.
* **Outputs expected:** A 1-2 page Design Brief containing approach, risks, invariants touched, test strategy, and performance expectations.
* **Definition of Done:** Proposal respects the adapter seam, engine boundary (core vs engine vs transport), dual-state data model, ResultEnvelope provenance, session format stability, and explicitly defers out-of-scope features.

### 🛠️ Implementer (Codex / Specific Coding Models)
*Role: Code generation and test passing.*
* **Inputs needed:** Data model (`arch_02`), Headless core interface (`arch_03`), agent architecture (`arch_07` if touching engine/MCP/semantic layer), plus specific domain docs (e.g., Stats Engine or Visualisation Engine) based on the task.
* **Outputs expected:** Working code, companion unit/golden tests, and minimal doc updates ONLY if a contract was changed.
* **Definition of Done:** Code compiles, tests pass, no heavy compute on the main thread, no schema drift, engine methods return `ResultEnvelope`, and transport handlers contain no business logic.

### 🧹 Maintainer (Claude Sonnet)
*Role: Refactoring, cleanup, and technical debt reduction.*
* **Inputs needed:** Headless core structure, Design system (`design_01`), UX modes (`design_02`).
* **Outputs expected:** Refactor PRs that reduce complexity, introduce cleaner seams, improve naming conventions, and reduce coupling.
* **Definition of Done:** Zero behavior change. If behavior changes, it must be fully covered by updated tests.

### 👁️ Reviewer (Cross-Model / Adversarial)
*Role: Gatekeeper for PRs and architectural integrity.*
* **Checklist anchored to docs:**
  * [ ] Did this preserve the Dual-State data model?
  * [ ] Is portable logic strictly kept in `src/core/`?
  * [ ] Does this calculate statistics according to survey-native invariants?
  * [ ] Are UX modes and design theme tokens respected?
  * [ ] Is the engine boundary respected? (pure logic in `core/`, orchestration in `engine/`, zero logic in transport layers)
  * [ ] Do new engine methods return `ResultEnvelope`?
  * [ ] Are MCP tool handlers free of business logic? (dispatch to engine only)
  * [ ] If session format changed: version bumped + migration function + backward-compat test?
* **Outputs expected:** A concise review containing 5-10 bullet points with at least 2 concrete "checked X, found Y" observations.

---

## 5. Operational Playbooks ("Skills")

For common execution tasks that require a repeatable workflow, agents MUST consult the relevant playbook **before making changes**.

These playbooks define execution-safe procedures designed to prevent architectural drift, statistical regressions, UI mode leakage, and main-thread performance violations.

| If you are attempting to... | You MUST read... |
|-----------------------------|------------------|
Refactor or reorganize existing logic | `docs/playbooks/refactor_safely.md` |
Implement new functionality or change behavior | `docs/playbooks/add_tests_first.md` |
Modify statistical calculations, weights, or denominators | `docs/playbooks/stats_integrity.md` |
Perform performance optimization or query changes | `docs/playbooks/performance_pass.md`|
Triaging runtime issues or debugging failures | `docs/playbooks/log_triage.md`  |
Change UI layout, interaction, or UX mode responsibilities | `docs/playbooks/ui_mode_change.md` |
Add or change VelocityEngine public methods | `docs/playbooks/engine_api_change.md` |
Migrate a store slice from worker to EngineProxy (Phase 3) | `docs/playbooks/worker_migration.md` |
**Analyze a dataset via MCP tools (as an AI agent)** | **`docs/guide_agent_quickstart.md`** & **`docs/playbooks/agent_analysis_workflow.md`** |
**Design or execute agent capability validation work** | **`docs/plan_phase4_agent_capability_validation.md`**, **`docs/eval_00_agent_interface_validation.md`**, **`docs/eval_00_outcome_decision_framework.md`**, **`docs/eval_00_capability_gap_review.md`** |

### Enforcement Rule
Failure to follow the relevant playbook may result in:
- silent regression of survey-native statistical correctness
- violation of `src/core/` portability constraints
- main-thread performance degradation
- UX mode responsibility leakage (Manager ↔ Canvas)
- engine API divergence across consumers (CLI, MCP, browser)
- broken provenance chain (missing ResultEnvelope on engine outputs)
- session format backward-compatibility breakage

Playbooks are mandatory for execution-style tasks and should be treated as procedural constraints in addition to architectural invariants.
