# Velocity — Collaborator Onboarding

**Audience:** Engineers, researchers, and product collaborators joining the project.  
**Rich companion:** Open [`docs/assets/collaborator-onboarding/index.html`](assets/collaborator-onboarding/index.html) in a browser for an interactive, evidence-backed tour (architecture diagrams, inspectable eval JSON, dual-state demos, codebase map).

**Last updated:** July 2026 · commit evidence on `main`

---

## 1. What Velocity Is

Velocity is a **local-first survey analysis platform** that runs entirely in the browser (or headlessly via CLI/MCP). No respondent data leaves the machine.

**Current commercial wedge (PILOT-0):** The fastest path from an **analysis-ready `.sav` file** to a **defensible, editable client deck** — aimed at boutique quantitative agencies and independent consultants who receive SPSS files and deliver branded PowerPoint.

**What it is not:** Broad SPSS/Displayr replacement, cloud collaboration, weight creation/raking, or unsupervised AI analyst. See `docs/pilot_00_brief.md` for explicit in/out scope.

---

## 2. Strategic Context (July 2026)

| Question | Answer | Evidence |
| :--- | :--- | :--- |
| Can the engine thesis work? | **Yes**, within validated scope | Phase 4 evals: mean ~4.7/5 across six families; EVAL-04 browser/MCP convergence |
| What is the active bet? | **SAV-to-deck pilot validation** | `docs/roadmap_00_strategic_guide.md` §2.1 |
| What shipped recently? | Stabilization: workspace reopen, export quality, design-token CI, truthful gates | `docs/completed_foundations_summary.md` |
| What is frozen? | WebR, Phase 5+ expansion until PILOT-7 evidence | Roadmap §2.1, feature matrix |

---

## 3. Architecture at a Glance

```
Browser (React) ──┐
CLI (Node)      ──┼──► VelocityEngine ──► DatabaseAdapter ──► DuckDB
MCP (Agents)    ──┘         │                    (WASM or Node)
                            ▼
                      src/core/ (pure functions)
                      ingestion · crosstabs · export · session
```

**Invariants (never break):**

1. `src/core/` and `src/engine/` have **no React/DOM** dependencies.
2. Heavy compute runs in the **Web Worker**, not the main thread.
3. **Dual-state data:** integer codes in DuckDB, display labels in UI — never conflate.
4. **Engine boundary:** logic in core/engine; transports (MCP handlers, worker proxy) stay thin.
5. **Provenance:** every engine operation returns a `ResultEnvelope`.
6. **Session stability:** `.velocity` format is versioned; no field removals without migration.

Full contracts: `docs/arch_01_system_architecture.md`, `docs/arch_07_agent_architecture.md`, `AGENTS.md`.

---

## 4. The Hard Parts (Read These First)

### 4.1 Dual-State Categorical Data

Survey variables store **integer codes** (for fast SQL) and **value labels** (for human display). The UI always shows labels; the engine always computes on codes. Breaking this invariant produces wrong crosstabs that look correct.

→ Skill: `.agents/skills/dual-state-data/SKILL.md` · Contract: `docs/arch_02_data_model.md`

### 4.2 VelocityEngine vs Transports

`VelocityEngine` owns session state, the database adapter, and analysis lifecycle. React, MCP, and CLI are **thin clients**. Business logic never belongs in MCP handlers or worker message routers.

→ Skill: `.agents/skills/engine-boundary-change/SKILL.md` · Code: `src/engine/VelocityEngine.ts`

### 4.3 Slides Are Configs, Not Pixels

A deck slide is a declarative spec (row vars, col var, filters, weight, chart type). Data is **recomputed** from the spec on every render. Agents assemble slide configs; they do not generate chart images.

→ Contract: `docs/arch_07_agent_architecture.md` §1, `src/engine/DeckBuilder.ts`

### 4.4 Survey-Native Significance

Cell-vs-rest comparisons (not cell-vs-total), Welch's t-test, Kish ESS for weighted data. Documented approximations are defensible for boutique sample sizes.

→ Contract: `docs/arch_04_statistical_engine.md` · Code: `src/core/analysis/crosstab/significance.ts` · Trust: `docs/pilot_02_trust_pack.md`

### 4.5 Worker Convergence

The browser path uses `EngineProxy` → Web Worker → `VelocityEngine`. Main-thread blocking is forbidden for DuckDB queries.

→ Playbook: `docs/playbooks/worker_migration.md`

---

## 5. Key Results & Evidence

### 5.1 Agent Capability Evals (Frozen Baselines)

| Eval | Dataset | Outcome | Engine | Deliverable | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| EVAL-01 | sleep.sav (271×59) | success | 4 | 4 | 9-slide deck; MCP deck-commit gap found & fixed |
| EVAL-04 | sleep.sav | success | 5 | 5 | Browser/MCP convergence on 5-slide set |
| EVAL-06 | WVS Wave 7 (97k×693) | success | 5 | 4 | 21-chunk load; browser stress baseline |
| EVAL-07 | brandtracker_w4.sav | success | 5 | 5 | 18-slide story deck; ground-truth parity ±0.1pt |

Artifacts: `evals/eval-NN/runs/` · Rubric: `docs/eval_framework.md`

### 5.2 Statistical Trust Pack

| Claim | Status | Reproduce |
| :--- | :--- | :--- |
| R `survey` parity on real SAV | 12 tests pass | `npm test -- tests/golden/r_parity.test.ts` |
| SPSS-style weighted formulas | 18 tests pass | `npm test -- tests/golden/spss_parity.test.ts` |
| Brand tracker ground truth | ±0.1pt | `npm test -- tests/golden/brand_tracker_parity.test.ts` |
| WASM ↔ Node adapter parity | 8 tests pass | adapter parity suite |

Full pack: `docs/pilot_02_trust_pack.md`

### 5.3 Demo Scripts (Pilot Archetype)

```bash
npm run demo:brand-tracker-recipe   # raw wave → analysis-ready
npm run demo:brand-tracker          # 18-slide golden deck
npm run demo:brand-tracker-wave-refresh  # wave replacement review
```

---

## 6. Codebase Map

| Path | Role | Files (approx) |
| :--- | :--- | ---: |
| `src/core/` | Pure business logic: ingestion, crosstabs, export, session, semantic, harmonization | 115 |
| `src/engine/` | Stateful orchestration: VelocityEngine, DeckBuilder, envelopes | 21 |
| `src/features/` | Product UI: dashboard/canvas, variable manager, workspace | 112 |
| `src/services/` | Browser wiring: worker proxy, OPFS persistence, boot | 52 |
| `mcp-server/` | Agent transport: tool schemas + thin handlers | 14 |
| `tests/golden/` | Regression anchors for stats parity | 4 |
| `evals/` | Frozen benchmark briefs and run evidence | — |

**Dependency direction:** UI → services → engine → core → adapters. Never upward.

Setup: `docs/dev_01_contributing.md`

---

## 7. MCP Tool Surface (Agents)

38 tools across lifecycle, describe, analyze, deck, export, session, semantic, harmonization. Handlers delegate to `VelocityEngine` — no business logic in transport.

Key sequence for deck handoff:

1. `velocity_load` → `velocity_describe`
2. `velocity_crosstab` / `velocity_stats`
3. `velocity_build_deck` → `velocity_commit_deck` ← **mandatory before session export**
4. `velocity_export_deck` / `velocity_export_session`

Quickstart: `docs/guide_agent_quickstart.md`

---

## 8. How to Work Here

### Before substantive work

1. Read `docs/README.md`, `docs/roadmap_00_strategic_guide.md`, `docs/tracker_00_implementation_status.md`
2. Check scope gates: `docs/blue_02_feature_matrix.md`
3. Follow the playbook for your task type (`docs/playbooks/`)

### Pre-PR verification

```bash
npm run format:check
npm run typecheck
npm run test
npm run build
# If UI/shortcuts/onboarding changed:
npm run test:e2e
```

Playbook: `docs/playbooks/pre_pr_verification.md`

### Agent operating rules

`AGENTS.md` at repo root — invariants, documentation triggers, role cards.

---

## 9. Current Priorities (Tracker)

Stabilization before expansion:

- **STAB-UI-F / STAB-UI-T** — presentation & technical UI foundation
- **PILOT-3 / PILOT-6** — paid pilot packaging and evidence collection
- **STAB-CI-*** — truthful CI gates and coverage ratchets

Live board: `docs/tracker_00_implementation_status.md`

---

## 10. Where to Go Next

| If you want to… | Start here |
| :--- | :--- |
| Understand the product visually | [`assets/collaborator-onboarding/index.html`](assets/collaborator-onboarding/index.html) |
| Run the app locally | `docs/dev_01_contributing.md` |
| Analyze via MCP | `docs/guide_agent_quickstart.md` |
| Change statistics | `docs/playbooks/stats_integrity.md` + golden tests |
| Change UI modes | `docs/playbooks/ui_mode_change.md` |
| See what's shipped | `docs/completed_foundations_summary.md` |
| Terminology | `docs/ref_00_glossary.md` |
