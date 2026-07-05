# Backend Reset: The Friday 4pm Engine

**Status:** Proposed — review complete, awaiting approval to execute
**Date:** July 5, 2026
**Purpose:** Apply the design-reset lens (Sarah the Strategist, Friday 4 PM) to the backend and architecture. The UI now serves the five-minute journey; this plan makes the platform underneath it *reliable, fast, and small enough to trust*.
**Companion docs:** [`plan_04_design_reset_pathways.md`](plan_04_design_reset_pathways.md) (the lens), [`plan_05_design_reset_implementation.md`](plan_05_design_reset_implementation.md) (frontend execution + precedent), [`arch_06_local_first_persistence.md`](arch_06_local_first_persistence.md) (persistence doctrine), [`roadmap_00_strategic_guide.md`](roadmap_00_strategic_guide.md) (scope gates), tracker §4.3.2 (`DESIGN-CONV` board)

---

## 0. Framing

The design reset succeeded because it named the clutter *generators*, not just instances, and deleted them ("deleted, not deprecated"). This plan does the same for the platform. The test for every work package is the roadmap's own question: **does this improve paid-pilot completion, trust, or willingness to pay for the SAV-to-deck wedge?** We are not changing for the sake of change; each item below is tied to a failure mode Sarah can hit or a tax the team pays on every change.

### Sarah's backend-critical path

| Step | Backend surface | What can go wrong today |
| :--- | :--- | :--- |
| Open the app | Vite boot → worker init → OPFS candidate scan → DuckDB-WASM fetch (~34 MB, one of three variants) | Slow first contact; OPFS open can hang or select a stale/empty DB ("start from scratch" loop) |
| Drop the `.sav` | `readstat-wasm` → Arrow → DuckDB (worker) | Memory pressure on big files; legacy + current chunked loaders both alive |
| Run crosstabs | `queryBuilder` → DuckDB → crosstab post-process → grid | Solid — validated by parity/golden evidence; not a reset target |
| Compose the deck | `slidesSlice` (Zustand) | Deck exists **twice** (store + engine `DeckBuilder`); parity kept honest only by a script |
| Export PPTX | `ExportModal` → `exportPptx` on the **main thread** | Second, separate deck/export path from the agent one; preview-before-export (`DESIGN-CONV-B`) has no single source to render |
| Close Friday, reopen Monday | OPFS DB cache + OPFS source files + localStorage snapshot + `.velocity` sessions, coordinated by ~1,200 lines across 5+ modules | The one unforgivable failure: workspace doesn't come back. In-flight timeout patches are treating symptoms |
| Wave refresh | engine + `core/export/slideRecipe` | Healthy path; confirms harmonization is *not* needed for the wedge |

### Review verdict

The architecture thesis is sound and validated (engine evals 4.7/5, parity evidence, worker migration essentially complete — `analysisWorker.ts` is a 24-line shell over the engine dispatch). **No rewrite.** The problems are:

1. **~6,000 lines of dead or frozen code still wired into the live runtime** — WebR, harmonization, deprecated main-thread DuckDB, an unused Monaco-based R editor — registered in the store, the worker handler map, the type kernel, and CI.
2. **A split-brain deck**: the UI's deck (`slidesSlice`) and the engine's deck (`DeckBuilder`/`DeckSpec`) are different objects with different export paths. Canvas↔PPTX parity is enforced by a script instead of by construction, and `DESIGN-CONV-B` (export preview) cannot be built honestly on two decks.
3. **Persistence has the right doctrine but no single owner**: the "DuckDB OPFS file is a cache; source file + transform log is truth" rule from `arch_06` is implemented as heuristics (candidate scanning, validation probes, quarantine) spread across `enginePersistenceBridge`, `datasetSessionCoordinator`, `workspaceDatasetLifecycle`, `persistenceActions`, `opfsPersistence`, and three worker-side modules. The currently uncommitted timeout/error-propagation work is necessary but symptomatic.
4. **First-contact weight**: ~34 MB WASM fetch with no service-worker cache and no warm-up on intent.

---

## 1. Success metrics (backend mirror of the five-minute metric)

Frozen budgets, asserted in CI once Phase 0 lands the instrumentation:

| Metric | Budget | Where measured |
| :--- | :--- | :--- |
| Warm reopen → workspace restored | **< 2 s p50**, zero user action | boot telemetry + chaos E2E |
| Reopen success under chaos suite (corrupt DB, mid-write kill, second tab, quota pressure) | **100%** (fallback rebuild allowed, data loss not) | new chaos E2E |
| File-drop → first crosstab rendered (brand-tracker SAV) | **< 10 s** cold, **< 5 s** warm | five-minute-pass CI smoke |
| Export 3-slide deck → PPTX | **< 5 s**; preview and export rendered from the **same recipe object** | export pipeline test |
| Wave refresh (dataset replace + recompute + review) | **< 30 s** | wave-refresh demo contract |
| Main-thread stalls during the journey | none > 50 ms outside React rendering | perf Playwright config |
| Runtime source reduction | **≥ 5,000 lines** removed with zero wedge-capability loss | diff accounting per WP |

---

## 2. Phase map

| Phase | Name | Outcome | Ships alone? |
| :--- | :--- | :--- | :--- |
| 0 | Baseline | Journey instrumentation + budgets asserted in CI | Yes |
| 1 | Subtraction | Dead + frozen code excised; deps trimmed | Yes — lowest risk, do first |
| 2 | One deck | Single deck-recipe domain object; one export pipeline; parity by construction | Yes — unblocks `DESIGN-CONV-B` |
| 3 | Deterministic persistence | Boot state machine, chaos suite, coordinator collapse | Yes — the reliability payoff |
| 4 | First contact | WASM caching, warm-up on intent, bundle audit | Yes |
| 5 | Reconciliation | Engine API re-derivation, docs sync, opportunistic store→engine slice moves | Closes the reset |

Dependency rule: Phase 1 before 2 and 3 (less surface to migrate). Phases 2 and 3 are independent of each other. Phase 2 must stay single-threaded while it defines the deck contract (same rule as PILOT-3).

---

## 3. Phase 0 — Baseline

### WP0.1 — Journey telemetry

Extend the existing local pilot event log (`src/services/pilotOnboarding.ts`) with timing marks for: boot start → engine ready, OPFS decision taken (cache-open vs rebuild vs fresh), file-drop → dataset ready, first crosstab, export duration, and every persistence fallback/corruption event. Local-only, same privacy posture as today. This is also PILOT-6 evidence: reliability telemetry is trust-pack material.

### WP0.2 — Journey gate in CI

Promote `scripts/design-reset-five-minute-pass.mjs` and the wave-refresh demo contract from on-demand scripts to a CI smoke job with the §1 budgets as assertions. One journey gate beats ten unit ratchets for catching regressions Sarah would feel. (CI was just overhauled in STAB-CI-11–22 — this *adds one job*, it does not churn the pipeline again.)

---

## 4. Phase 1 — Subtraction

Precedent: WP1.x of the design reset. Deleted, not deprecated; git history is the archive. Everything here is gated behind PILOT-7 on the roadmap anyway — the code's continued presence in the runtime is a tax (store registration, worker handler map, kernel types, CI time, agent context) with no pilot payoff.

### WP1.1 — Dead code (zero importers, verified July 5)

- `src/services/duckDb.ts` — deprecated main-thread DuckDB singleton (the dual-DB bug source)
- `src/services/simulation.ts`
- `src/services/AgentBridge.ts` (not referenced by mcp-server or cli either)
- `src/components/common/RCodeEditor.tsx` + **drop `@monaco-editor/react` dependency**
- `vite.config.ts` `define` block: `process.env.API_KEY` / `GEMINI_API_KEY` (no usage in `src/`)
- Stale one-off scripts from closed workstreams (e.g. design-reset verification runners) → `docs/archive/` or delete; keep anything referenced by CI or the trust pack

### WP1.2 — Excise the WebR cluster (~2,570 lines + `webr` dependency)

`src/engine/webr/` (364), `src/services/webRWorker.ts` (638), `src/store/slices/webrSlice.ts` (213), `src/types/webr.ts` (271), `src/core/analysis/runners/MixedEffectsRunner.ts` (384), `src/core/analysis/runners/SurveyWeightingRunner.ts` (337), plus store/slices registration and lazy chunks.

Evidence this is safe: the runners **throw at runtime** if executed (`surveyWeighting requires WebR execution via WebREngine`); weighted analysis in the wedge (including the brand-tracker rim weights) runs through DuckDB SQL (`core/stats/statistics.ts`), not R. S5-R-1/S5-STATS-1 are frozen behind PILOT-7. If PILOT-7 reopens advanced stats, it re-enters as a **lazy plugin package** (the arch_01 plugin seam), not as store slices and kernel types.

Keep: `SurveyWeightingRunner.generateRCode()`'s methodology value is already captured in the trust pack; snapshot the generated-R examples into `docs/` if `pilot_02` references them, then delete the runner.

### WP1.3 — Excise the harmonization cluster (~2,915 lines)

`src/core/harmonization/` (1,252), `src/features/harmonization/` (1,152), `src/store/slices/harmonizationSlice.ts` (274), `src/services/worker/engineHandlersHarmonization.ts` (100), `src/types/harmonization.ts` (137), ModalHost wiring, persistConfig partialize entries.

Evidence this is safe: wave refresh — the wedge's tracker-update job — goes through `VelocityEngine` + `core/export/slideRecipe` and does not import harmonization (verified). S5-HARM-1 is Phase 5, gated on PILOT-7. EVAL-05b artifacts are frozen under `evals/` and stay as historical evidence; the eval does not need live code to remain valid history.

Gate: before deletion, run `npm run eval:05b:engine` one final time and freeze its output, then remove the script entry.

### WP1.4 — Ingestion consolidation (small, evidence-gated)

`savChunkedLegacy.ts` survives only as a fallback inside `savChunkedLoader.ts`. Add a telemetry counter (WP0.1); if pilots never hit the legacy path in a full pilot cycle, delete it. Do **not** touch `packages/readstat-wasm` (its internal `jsavvy` fallback included) — ingestion correctness is trust-pack surface.

**Phase 1 exit:** `npm run ci` green; five-minute pass green; ~5,500+ lines and 2 dependencies (`@monaco-editor/react`, `webr`) removed; store slice index, worker handler map, and kernel types contain only wedge + agent surfaces.

---

## 5. Phase 2 — One deck, one export path

The deck-native charter says the deck recipe is the durable object. Today there are two decks:

- **UI:** `slidesSlice` (489 lines, Zustand, persisted via localStorage partialize)
- **Engine:** `DeckBuilder`/`DeckSpec` (used by VelocityEngine for MCP/CLI/agent decks — zero UI consumers)

and two export routes (browser: `ExportModal` → main-thread `exportPptx`; agent: engine → `DeckBuilder` → exporter). The cost is concrete: canvas↔PPTX parity needs a standing script (`scripts/report-quality/canvas-pptx-parity.mjs`), review-before-export (`DESIGN-CONV-B`, the frontend's Wave-1 priority) has no single object to preview, and every slide feature is reasoned about twice.

### WP2.1 — Deck recipe as the single domain object

Define the canonical deck model in `src/core` (grow it out of the existing `core/export/slideRecipe` + `core/session/sessionDeckRecipe` types rather than inventing a third). `slidesSlice` becomes a thin view/controller over it: UI state (selection, hover, editing) stays in Zustand; slide *content* (recipe: analysis spec, title, notes, order) is the core object. Engine `DeckBuilder` consumes the same model. Session files already carry deck recipes — this converges on the format that persists.

### WP2.2 — Single export pipeline

Both the UI export action and the engine/MCP export route through one `core/export` entry that takes the canonical deck recipe. Measure export time in WP0.1 first; move PPTX generation into the worker **only if** the 5 s budget or main-thread stall budget is violated on real decks (pptxgenjs is currently main-thread; don't relocate it on principle).

### WP2.3 — Parity by construction

Replace the standing parity *script* with a unit contract: the preview renderer and the PPTX exporter consume the same recipe object, and one golden test asserts structural equivalence. This is the backend half of `DESIGN-CONV-B` — the preview lane renders the exact object that exports.

**Phase 2 exit:** one deck model; `DeckBuilder` UI/engine unification complete; export preview unblocked; parity script retired; golden PPTX fixtures re-blessed once with evidence.

---

## 6. Phase 3 — Deterministic persistence

The reliability payoff. Reopen failure is the single worst thing the product can do to Sarah, and today's boot path is heuristic: scan OPFS candidates, try opens, probe validity, quarantine on corruption — coordinated across five store/service modules plus three worker modules, with timeouts being patched in right now (uncommitted work on `opfsPersistence.ts` / `EngineProxy.ts` / `enginePersistenceBridge.ts`).

### WP3.1 — Land the in-flight hardening

Finish and merge the current working-tree changes (per-attempt OPFS timeouts, worker `error`/`messageerror` propagation, engine-init dedupe, COOP/COEP headers). They are correct and Phase-3-aligned; they should land as the first commit of this phase, not sit dirty.

### WP3.2 — Boot state machine with budgets

One module owns boot: `restore = open-cache ∣ rebuild-from-source ∣ fresh`, chosen by explicit rules with time budgets (e.g. cache open ≤ 2 s or abandon to rebuild), emitting WP0.1 telemetry at every transition. The `arch_06` doctrine becomes code: **the DuckDB OPFS file is only ever an optimization; rebuild from OPFS source file + transform log is the guaranteed path and is exercised on every CI run, not just on disaster.** No path may create a new empty DB while a valid source file exists.

### WP3.3 — Chaos suite

Playwright E2E: corrupt the DB file, kill the worker mid-write, open a second tab holding the access handle, simulate quota pressure — assert the workspace reopens (rebuild allowed) with slides and transforms intact. This suite *is* the 100% reopen metric, and its green run is trust-pack evidence for PILOT-6.

### WP3.4 — Collapse the coordinators

With the state machine in place, fold `enginePersistenceBridge`, `datasetSessionCoordinator`, `workspaceDatasetLifecycle`, and the persistence halves of `persistenceActions` into it (~750 lines today → target well under half, net negative). localStorage keeps only the fingerprint + view state; it stops being a second authority on dataset identity.

**Phase 3 exit:** chaos suite green and in CI; reopen p50 < 2 s; one module answers "how does Velocity boot?"

---

## 7. Phase 4 — First contact

- **WP4.1 — WASM caching + warm-up:** service worker (or Cache Storage API) for the DuckDB bundle so the 34 MB fetch happens once per version; begin engine init on first user intent (landing interaction / file-picker open) so ingestion starts hot. Measure via WP0.1 cold/warm split.
- **WP4.2 — Bundle audit:** drop the `mvp` DuckDB variant if telemetry shows no browser selecting it (every pilot-supported browser takes `eh`/`coi`); assert chunk budgets in CI (`index` < 350 KB, no frozen-feature chunks reappearing). Evaluate whether `motion-vendor` (126 KB, framer-motion in 42 files) is still warranted under the calm design language — coordinate with the DESIGN-CONV owners; likely a CSS-transition diet, but that is a frontend call.

---

## 8. Phase 5 — Reconciliation

- **WP5.1 — Engine API re-derivation:** after Phases 1–2, walk `BrowserEngine`'s 26 methods and the worker handler map; remove orphaned messages/methods; regenerate the `arch_07` surface table. The engine API should read as: Sarah's six jobs + the bounded-agent tools that serve PILOT-5. CLI stays but is frozen as a parity/evidence harness (no feature growth).
- **WP5.2 — Opportunistic store→engine migration:** continue per-slice migration (playbook exists) **only** where a slice's duplication with engine session state causes real bugs. No big-bang store rewrite; the split-brain that matters (the deck) was fixed in Phase 2.
- **WP5.3 — Docs sync:** update `arch_01` (component map minus WebR/Pyodide plugins — note them as a *future* plugin seam), `arch_06` (state machine as implemented), `arch_07` (engine surface), `blue_02` feature matrix rows to `Removed (gated re-entry)`. Archive superseded persistence RCA docs. Propose (separately, not in this plan's scope) a docs-weight pass: the mandatory-read matrix in `AGENTS.md` is itself a Friday-4pm tax on every agent session.

---

## 9. Non-goals (do not re-litigate without new evidence)

- **No engine/architecture rewrite.** The layering (core → engine → transports; worker compute; dual-state data) is validated and keeps its invariants.
- **No touching the statistical core** (`core/stats`, crosstab runners, significance). It is the trust asset; parity evidence stays frozen.
- **MCP server stays.** It is the PILOT-5 strategic surface and lives headless-side; it costs the browser nothing.
- **No new abstraction layers** (no repository patterns, no event buses). Every phase here is subtraction or unification.
- **Nothing that blocks PILOT-6 recruiting** — phases ship alone, CI stays green throughout, and Phase 1 explicitly precedes riskier work.

## 10. Sequencing note

Recommended order: **0 → 1 → 3 → 2 → 4 → 5** if reopen reliability is judged the top pilot risk (it is, per this review); 2 before 3 only if `DESIGN-CONV-B` is committed for the next pilot wave. Phases 1 and 0 can run in the same week; both are low-risk and immediately reduce the surface every later phase must reason about.
