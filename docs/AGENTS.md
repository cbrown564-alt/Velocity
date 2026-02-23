# Velocity Agent Operating System

This document serves as the master index and rulebook for all autonomous agents operating within the Velocity repository. Our goal is to prevent documentation staleness and ensure architectural invariants are respected across multi-agent workflows.

## 1. Documentation Index & Trigger Conditions

Before modifying code, agents must read the relevant documentation based on the components they are touching.

| If you are touching... | You MUST read... | Why? (The invariant) |
| :--- | :--- | :--- |
| Any new feature or major refactor | `arch_01_system_architecture.md` | To understand the "Map of the World" (main thread vs worker vs core). |
| Data structures, ingestion, or types | `arch_02_data_model.md` | To strictly preserve the "Dual-State" principle (Raw vs Labeled). |
| `src/core/*` or `adapters/*` | `arch_03_headless_core.md` | To maintain the platform-independent seam and dependency direction. |
| Statistical calcs, weights, or significance | `arch_04_statistical_engine.md` | To adhere to survey-native methodology and known correctness standards. |
| Charts, D3 renderers, or canvas layout | `arch_05_visualisation_engine.md` | To follow the phased chart system architecture. |
| The `docs/` folder or prioritizing work | `roadmap_00_strategic_guide.md`, `blue_02_feature_matrix.md` (and `blue_01_unified_roadmap.md` for full context) | To enforce scope gates and keep sequencing aligned to the current strategic plan. |
| React UI, CSS, or Theme tokens | `design_01_system.md` & `design_02_ux_modes.md` | To respect strict mode separation (Manager vs Canvas) and tokens. |

---

## 2. Global Invariants & Constraints

1. **Dependency Direction:** Code in `src/core/` MUST NOT depend on React, DOM APIs, or the browser (`window`, `localStorage`). All platform-specific logic must be injected via `DatabaseAdapter` or run in `adapters/`.
2. **Main Thread Compute:** Heavy data processing, Arrow table manipulation, and DuckDB queries MUST run in the Web Worker. The main thread is for UI rendering and state management only.
3. **Data Model Integrity:** Never break the dual-state survey model. Categorical data must retain both its underlying integer codes and its string labels.
4. **Docs-to-Code Sync:** DO NOT proactively create new documentation files unless explicitly requested. ONLY update existing documentation if a PR actively changes an established contract or invariant.

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
* **Inputs needed:** System architecture (`arch_01`), headless core seam (`arch_03`), and Roadmap/Feature Matrix for scope boundaries.
* **Outputs expected:** A 1-2 page Design Brief containing approach, risks, invariants touched, test strategy, and performance expectations.
* **Definition of Done:** Proposal respects the adapter seam, dual-state data model, and explicitly defers out-of-scope features.

### 🛠️ Implementer (Codex / Specific Coding Models)
*Role: Code generation and test passing.*
* **Inputs needed:** Data model (`arch_02`), Headless core interface (`arch_03`), plus specific domain docs (e.g., Stats Engine or Visualisation Engine) based on the task.
* **Outputs expected:** Working code, companion unit/golden tests, and minimal doc updates ONLY if a contract was changed.
* **Definition of Done:** Code compiles, tests pass, no heavy compute on the main thread, and no schema drift.

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
* **Outputs expected:** A concise review containing 5-10 bullet points with at least 2 concrete "checked X, found Y" observations.
