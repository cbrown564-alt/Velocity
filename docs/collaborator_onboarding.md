# Velocity — Collaborator Onboarding

**Audience:** Engineers, designers, and researchers joining the project  
**Last updated:** July 2026  
**Rich companion:** [`collaborator_onboarding.html`](collaborator_onboarding.html) — interactive evidence, architecture explorer, and codebase map

---

## What Velocity is

Velocity is a **local-first survey analysis platform**. All computation runs in the browser (WebAssembly) or locally via Node — **no respondent data is uploaded to a server**.

The product thesis (June 2026 market reset): the fastest, simplest, and most private path from an **analysis-ready SAV file** to a **defensible, editable client deck** for boutique quantitative agencies and independent consultants.

Velocity is not trying to replace SPSS or Displayr wholesale. It wins one high-frequency workflow: receive `.sav`, produce weighted crosstabs with significance, build a multi-slide deck, export editable PPTX — all without leaving the machine.

---

## Strategic context

| Question | Answer (July 2026) |
| :--- | :--- |
| Can the engine thesis work? | **Yes** — Phase 4 validation complete; mean eval score **4.7/5** across six families |
| What is the active wedge? | SAV → defensible deck for boutique researchers |
| What is frozen? | WebR, weight creation, client template import, cloud collaboration, broad AI autonomy |
| Current priority | **Stabilization before expansion** — docs truth, workspace reopen, export quality, design-system enforcement, CI truthfulness |

**Governance docs:** `docs/roadmap_00_strategic_guide.md`, `docs/tracker_00_implementation_status.md`, `docs/blue_02_feature_matrix.md`, `AGENTS.md`.

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONSUMER LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Browser (React)  │  CLI (Node)  │  MCP Server (Agents)       │
│         └──────────┴──────┬───────┴──────────┘                 │
│                           ▼                                     │
│                  VelocityEngine (orchestrator)                    │
│                           │                                     │
│                  DatabaseAdapter (DuckDB)                       │
│                           │                                     │
│                  Headless Core (pure functions)                 │
│     Ingestion · Analysis · Export · Session · Semantic          │
└─────────────────────────────────────────────────────────────────┘
```

### Global invariants (never break these)

1. **Dependency direction:** `src/core/` and `src/engine/` have no React/DOM/browser dependencies.
2. **Main-thread compute:** Heavy work runs in the Web Worker.
3. **Dual-state integrity:** Categorical data keeps integer codes (compute) and display labels (UI) together.
4. **Engine boundary:** Pure logic in `core/`; orchestration in `engine/`; transports (MCP, worker handlers) are thin wiring only.
5. **Provenance:** Engine outputs use `ResultEnvelope` (duration, warnings, inputs, metadata).
6. **Session stability:** `.velocity` file version bumps require migrations; no field removals.

---

## The dual-state data model

Every survey variable exists in two states simultaneously:

| State | Where | Example |
| :--- | :--- | :--- |
| **Raw codes** | DuckDB columns, engine queries | `1`, `2`, `3` |
| **Display labels** | UI, exports, slide titles | `Male`, `Female`, `Prefer not to say` |

The UI must always show **labels**. The engine must always compute on **raw values**. Breaking this invariant causes silent statistical errors.

See `docs/arch_02_data_model.md`.

---

## Statistical engine (survey-native)

Velocity is survey-native, not generic BI:

| Principle | Approach |
| :--- | :--- |
| Weighting | Kish ESS (n² / Σw²) — prevents false significance on weighted data |
| Comparisons | Cell vs Rest (not cell vs total) |
| Test statistic | Welch's t-test on proportions and means |
| Chi-square | Pearson, no Yates correction (matches R `chisq.test(correct=FALSE)`) |

**Trust evidence:** 12 R parity tests on `sleep.sav` and `bsa93.sav`, 18 SPSS-style formula tests, 8 browser-vs-Node adapter parity tests. See `docs/pilot_02_trust_pack.md`.

---

## Key results (evidence-backed)

### Phase 4 agent capability validation

| Eval | Outcome | Engine | Deliverable |
| :--- | :--- | :---: | :---: |
| EVAL-01 (small deck) | Good insight, painful workflow | 4 | 4 |
| EVAL-04 (convergence) | End-to-end success | 5 | 5 |
| EVAL-06 (stress) | Frozen baseline | — | — |

Four benchmark baselines frozen: EVAL-01, EVAL-02, EVAL-04, EVAL-06.

### Pilot workflow benchmarks

| Benchmark | Result | Criteria |
| :--- | :--- | :--- |
| Five-minute pass (`sleep.sav`) | **11.5 s** to 3 slides + PPTX | < 5 min, 0 interruptions |
| R parity suite | **12/12** active tests pass | CI on every PR |
| Adapter parity | **8/8** WASM vs Node | tolerance 1e-10 |

### Foundations shipped

- SAV/CSV ingest via ReadStat WASM
- Weighted crosstabs + automatic significance
- Editable PPTX/XLSX export
- OPFS workspace reopen
- Portable `.velocity` session handoff
- MCP server with lifecycle, analyze, deck, export, semantic tools
- Harmonization workspace (cross-wave mapping)

Full map: `docs/completed_foundations_summary.md`.

---

## Codebase map

| Path | ~Files | Role |
| :--- | ---: | :--- |
| `src/core/` | 115 | Portable kernel — analysis, ingestion, export, session, semantic, stats |
| `src/engine/` | 21 | `VelocityEngine`, `DeckBuilder`, session state, workspace manager |
| `src/services/` | 52 | Worker, OPFS, `EngineProxy`, codecs |
| `src/features/` | 135 | Workspace, Variable Manager, Analysis Canvas (dashboard) |
| `src/store/` | 38 | Zustand slices (migrating to UI-only state) |
| `mcp-server/` | 17 | MCP tools over Node `VelocityEngine` |
| `tests/` | 77+ | Golden parity, adapter parity, E2E |
| `packages/readstat-wasm/` | — | Custom C→WASM SPSS parser |

**Entry points:** `src/main.tsx` → `App.tsx` → `EngineProxy` → `analysisWorker.ts` → `VelocityEngine.ts`. MCP: `mcp-server/index.ts`.

---

## Hard parts (where complexity lives)

1. **Dual-runtime SAV ingestion** — Node `read_stat` vs browser WASM chunked/streaming paths must agree.
2. **EngineProxy protocol** — 30+ typed `postMessage` types; serial queue in worker.
3. **OPFS persistence** — COOP/COEP headers, corruption quarantine, reload reconciliation.
4. **Weighted significance** — ESS, cell-vs-rest, multiple-testing correction; R golden parity.
5. **Grid detection** — Heuristic clustering of Likert grids into `VariableSet` shells.
6. **Session migration** — V1→V2 `.velocity` files; no breaking field removals.
7. **Deck pipeline** — `DeckRecipe` → `BuiltDeck` → `MaterializedDeck` → PPTX; fail-soft per slide.
8. **Semantic layer** — Deterministic annotation, concept clustering, analysis guardrails.

Each is explorable in the HTML companion with file paths and diagrams.

---

## UX modes

Velocity uses a **hub-and-spoke** model:

| Mode | Density | Purpose |
| :--- | :--- | :--- |
| **Analysis Canvas** | Low | Reading, drag-and-drop slides, deck building |
| **Variable Manager** | High | Cleaning, recoding, semantic tagging (overlay, not route) |

Design system: **Evolved Soft Machine** — ground `#F1EFEA`, accent `#B54E33` (significance + primary action only), data marks `#6F8177`. See `docs/design_01_system.md`.

---

## Getting started

```bash
git clone <repo> && cd velocity
git submodule update --init --recursive   # readstat-wasm
npm ci --legacy-peer-deps
npm run dev                               # COOP/COEP required for DuckDB-WASM
```

**Verification gates before PR:**

```bash
npm run test:run          # unit + golden
npm run test:parity       # WASM vs Node
npm run check:design-tokens
```

Playbooks: `docs/playbooks/pre_pr_verification.md`. Agent rules: `AGENTS.md`.

---

## Documentation map

| Need | Read |
| :--- | :--- |
| What to work on | `tracker_00_implementation_status.md` |
| Architecture | `arch_01` through `arch_08` |
| Data model | `arch_02_data_model.md` |
| Engine / MCP | `arch_07_agent_architecture.md` |
| Statistics | `arch_04_statistical_engine.md` |
| Design tokens | `design_01_system.md`, `design_02_ux_modes.md` |
| Trust claims | `pilot_02_trust_pack.md` |
| Agent workflow | `guide_agent_quickstart.md` |
| Eval scoring | `eval_framework.md` |

---

## Open the interactive companion

For inspectable golden-test JSON, architecture flow diagrams, screenshot journeys, eval scorecards, and an explorable codebase map:

**→ [`collaborator_onboarding.html`](collaborator_onboarding.html)**
