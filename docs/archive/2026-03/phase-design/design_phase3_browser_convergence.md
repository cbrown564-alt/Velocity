# Design Brief: Phase 3 — Browser Convergence

**Author:** Architect (Claude Opus)
**Date:** 2026-03-09
**Status:** Proposal
**Scope:** Migrate browser to consume VelocityEngine. Eliminate divergence between agent and human capabilities. Enable live agent mode.
**Ref:** `docs/arch_07_agent_architecture.md` §10 Phase 3
**Depends on:** Phase 2 (MCP Server + Deck Builder) validated with real agent

---

## 0. Executive Summary & Reality Check

This is the highest-risk phase. It replaces the browser's data access plumbing — 27 `worker.postMessage` call sites across Zustand store slices — with engine method calls. The visual experience is unchanged; only the wiring beneath shifts.

| Component | Current State | Target State | Migration Risk |
|:---|:---|:---|:---|
| Store → Worker communication | 27 `postMessage` calls across slices | Store calls `engine.runAnalysis()`, etc. | **High** — touching every data flow path |
| Config → auto-execution | `setTableConfig()` triggers `runAnalysis()` | Config mutation separated from execution | **Medium** — changes user-facing timing |
| App.tsx orchestration | ~1750 LOC, handles persistence + worker init + file loading | Engine handles lifecycle; App renders | **Medium** — large file decomposition |
| Slide state switching | Snapshots/restores Zustand store state | Calls `engine.importSession(slide.analysisState)` | **Medium** — different restoration mechanism |
| Export modal | Calls `runCrosstabForExport()` via worker | Uses `engine.buildDeck()` / `engine.exportDeck()` | **Low** — cleaner path |
| Live agent mode | Does not exist | MCP commands reflected in browser state | **Medium** — new capability, not migration |

**Bottom line:** This is a refactoring phase with zero intended behavior change (except live agent mode). The risk is regression, not complexity. The mitigation is thorough testing and incremental migration (one slice at a time, behind a feature flag if needed).

---

## 1. Approach

### 1.1 Engine-in-Worker Architecture

The VelocityEngine currently runs in Node (CLI/MCP). In the browser, it must run **inside the Web Worker** to maintain the main-thread-zero constraint.

```
┌─────────────────────────────────────────────────────┐
│                    MAIN THREAD                        │
│                                                       │
│  ┌──────────┐    ┌──────────┐    ┌────────────────┐ │
│  │ React UI │◄──►│ Zustand  │◄──►│ EngineProxy    │ │
│  │          │    │  Store   │    │ (postMessage)  │ │
│  └──────────┘    └──────────┘    └───────┬────────┘ │
│                                           │          │
├───────────────────────────────────────────┼──────────┤
│                    WEB WORKER             │          │
│                                           │          │
│  ┌────────────────────────────────────────▼────────┐ │
│  │              VelocityEngine                      │ │
│  │  (owns DuckDBWasmAdapter, session state)         │ │
│  │                                                   │ │
│  │  ┌─────────────┐  ┌──────────────┐              │ │
│  │  │ crosstabRnr │  │ variableStats│              │ │
│  │  └─────────────┘  └──────────────┘              │ │
│  │  ┌─────────────┐  ┌──────────────┐              │ │
│  │  │ DeckBuilder │  │ sessionMgmt  │              │ │
│  │  └─────────────┘  └──────────────┘              │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**EngineProxy** is a main-thread class that mirrors the `VelocityEngine` API but sends every call as a typed message to the worker, awaits the response, and returns the result. From the store's perspective, it looks identical to calling the engine directly.

```typescript
// src/services/EngineProxy.ts
class EngineProxy {
  private worker: Worker;
  private pendingRequests: Map<string, { resolve, reject }>;

  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<AnalysisResult>> {
    const requestId = crypto.randomUUID();
    return this.send({ type: 'engine.runAnalysis', requestId, id, config });
  }

  // ... mirrors every VelocityEngine public method
}
```

**Critical:** This solves the existing worker message collision bug (known issue #5 in CLAUDE.md). Every request gets a UUID. The worker response includes the same UUID. No more collision.

### 1.2 Worker Protocol Migration

Replace the current `WorkerRequest` / `WorkerResponse` types with engine-aligned messages:

```typescript
// Current (ad-hoc, collision-prone)
{ type: 'loadSAV', buffer: ArrayBuffer }
{ type: 'query', sql: string }
{ type: 'runCrosstab', options: CrosstabQueryOptions }

// New (engine-aligned, request-ID'd)
{ type: 'engine.loadBuffer', requestId: string, name: string, buffer: ArrayBuffer, format: 'sav' | 'csv' }
{ type: 'engine.query', requestId: string, sql: string }
{ type: 'engine.runAnalysis', requestId: string, id: 'crosstab', config: CrosstabQueryOptions }
```

**Backward compatibility:** During migration, the worker handles both old and new message formats. Old-format handlers log deprecation warnings. Once all 27 call sites are migrated, old handlers are removed.

### 1.3 Store Slice Migration

Each Zustand slice is migrated independently. Order by risk (lowest first):

**Migration order:**

| # | Slice | Call sites | Risk | Notes |
|:---|:---|:---|:---|:---|
| 1 | `drillDownSlice` | 1 | Low | Single `query()` call for raw record display |
| 2 | `webrSlice` | 2 | Low | Isolated R runtime, minimal coupling |
| 3 | `workspaceSlice` | 3 | Low | Dataset listing, no analysis |
| 4 | `slidesSlice` | 4 | Medium | State snapshot/restore changes mechanism |
| 5 | `dataSlice` | 6 | Medium | File loading, metadata extraction |
| 6 | `analysisSlice` | 11 | High | Core analysis flow, most call sites |

**Migration pattern per slice:**

```typescript
// Before (dataSlice)
loadFile: async (file) => {
  const worker = getWorker();
  worker.postMessage({ type: 'loadSAV', buffer });
  // ... await response via onmessage handler
}

// After (dataSlice)
loadFile: async (file) => {
  const engine = getEngineProxy();
  const result = await engine.loadBuffer(file.name, buffer, 'sav');
  // result is a ResultEnvelope — structured, typed, with provenance
  set({ variables: result.data.variables, rowCount: result.data.rowCount });
}
```

### 1.4 Separating Config Mutation from Execution

Currently in `analysisSlice`:
```typescript
setTableConfig: (config) => {
  set({ tableConfig: config });
  runAnalysis();  // auto-triggers on every config change
}
```

**After:**
```typescript
setTableConfig: (config) => {
  set({ tableConfig: config });
  // No auto-execution. UI explicitly calls runAnalysis() when ready.
}

runAnalysis: async () => {
  const { tableConfig, filters, weightVar } = get();
  const engine = getEngineProxy();
  const result = await engine.runAnalysis('crosstab', {
    rowVars: tableConfig.rowVars,
    colVar: tableConfig.colVar,
    filters,
    weightVar,
  });
  set({ analysisResult: result });
}
```

**UX impact:** Users currently see immediate updates when dragging variables. After this change, there's a moment between config change and result display. Two options:

1. **Debounced auto-run** (recommended): `setTableConfig()` schedules `runAnalysis()` after a 200ms debounce. Feels instant for single changes, batches rapid changes (e.g., drag-and-drop reordering).

2. **Explicit "Run" button**: More control but worse UX for the drag-and-drop flow.

Recommendation: Option 1. The engine-explicit principle is about the API contract (no side effects in the engine layer), not the UI behavior. The UI can still auto-trigger — it just does so explicitly via `runAnalysis()` rather than as a side effect of `setTableConfig()`.

### 1.5 App.tsx Decomposition

Current App.tsx (~1750 LOC) handles:
- DuckDB worker initialization
- OPFS persistence setup
- File loading orchestration
- Workspace state management
- Modal routing
- Error boundaries

**After:** App.tsx becomes a thin shell:

```typescript
function App() {
  const engineReady = useEngineProxy();  // Hook: initializes worker + engine
  if (!engineReady) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
```

Extracted modules:
- `src/services/engineInit.ts` — Worker creation, engine proxy setup, OPFS configuration
- `src/hooks/useEngineProxy.ts` — React hook for engine lifecycle
- `src/hooks/useFileLoader.ts` — Drop zone + file ingestion orchestration

### 1.6 Slide State Switching

Currently, switching slides snapshots/restores entire Zustand store slices. This is fragile (store shape changes break snapshots).

**After:** Each slide stores a `SlideAnalysisState` (rowVars, colVar, filters, weight). Switching slides:

```typescript
switchSlide: async (slideId) => {
  const slide = get().slides.find(s => s.id === slideId);
  const engine = getEngineProxy();

  // Apply slide's analysis state
  engine.clearFilters();
  slide.analysisState.filters.forEach(f => engine.addFilter(f));
  engine.setWeight(slide.analysisState.weightVar);

  // Run the analysis
  const result = await engine.runAnalysis('crosstab', {
    rowVars: slide.analysisState.rowVars,
    colVar: slide.analysisState.colVar,
  });

  set({ currentSlide: slideId, analysisResult: result });
}
```

This is simpler and more robust than full store snapshots.

### 1.7 Export Pipeline Migration

Current export flow:
```
Export Modal → runCrosstabForExport() → worker → DuckDB → PPTX/XLSX
```

After:
```
Export Modal → engine.buildDeck(spec) → engine.exportDeck(deck, { format }) → Uint8Array
```

The export modal constructs a `DeckSpec` from the current slides, calls `buildDeck()`, then `exportDeck()`. This is the same path agents use — full convergence.

### 1.8 Live Agent Mode

Once the browser consumes the engine via EngineProxy, a WebSocket bridge can connect an external MCP agent to the same engine instance:

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐
│ Claude   │◄───►│  WebSocket    │◄───►│ EngineProxy  │
│ (Agent)  │     │  Bridge       │     │ (in worker)  │
└──────────┘     └───────────────┘     └──────────────┘
                                              ▲
                                              │
                                       ┌──────┴──────┐
                                       │  React UI   │
                                       │  (observes) │
                                       └─────────────┘
```

Agent calls arrive via WebSocket → dispatch to the same engine instance → Zustand store updates → React re-renders. The human watches the agent work in real-time.

**Scope for Phase 3:** Implement the bridge scaffold only. Full bidirectional collaboration (human edits reflected back to agent) is Phase 4 territory.

---

## 2. Invariants Touched

| Invariant | Impact | Mitigation |
|:---|:---|:---|
| **Main thread zero** | EngineProxy sends messages to worker. Engine runs in worker. Main thread does zero compute. | Same constraint as today, but with structured messages instead of ad-hoc postMessage. |
| **Worker-first compute** | Engine replaces raw DuckDB access inside the worker. Worker becomes thinner. | Worker's `onmessage` dispatches to `VelocityEngine` methods instead of raw SQL. |
| **Zustand state management** | Store still manages UI state. Analysis results come from engine via proxy. | Clean separation: store = UI state, engine = data state. Store reads engine results. |
| **OPFS persistence** | Engine in worker has access to OPFS (same as today). | `VelocityEngine.create({ runtime: 'wasm' })` initializes OPFS path. |
| **Dual-state data model** | Unchanged. Engine returns labeled metadata, computes on raw values. | Already enforced by core runners. |

---

## 3. Risks

| Risk | Severity | Mitigation |
|:---|:---|:---|
| **27-call-site migration regression** | **High** | Migrate one slice at a time. Each slice migration is a separate commit with its own test pass. Feature flag to fall back to old worker protocol during transition. |
| **UX timing change (debounced execution)** | Medium | 200ms debounce feels instant. A/B test with internal usage. If problematic, reduce to 100ms or use optimistic UI (show stale results with loading indicator). |
| **App.tsx decomposition scope** | Medium | Strict scope: extract only worker init and file loading. Do NOT refactor UI components, modal routing, or error handling in this phase. |
| **Slide snapshot backward compatibility** | Medium | Migrate saved slides on import: detect old format (full store snapshot), extract `SlideAnalysisState` fields, discard rest. One-time migration, not ongoing compat. |
| **Live agent mode security** | Medium | WebSocket bridge is localhost-only. No remote connections. Rate-limit engine calls from agent to prevent runaway loops. |
| **EngineProxy message serialization** | Low | `ArrayBuffer` transfers use `postMessage` transferables (zero-copy). `ResultEnvelope` is small JSON. No performance regression. |

---

## 4. Test Strategy

### 4.1 Migration Parity Tests

For each migrated slice, create a parity test:

```typescript
// test: analysisSlice migration parity
it('produces identical results via EngineProxy vs old worker protocol', async () => {
  const oldResult = await runViaOldWorker(fixture, config);
  const newResult = await runViaEngineProxy(fixture, config);
  expect(newResult.data).toEqual(oldResult);
});
```

Run these against every golden test fixture. Any divergence is a regression.

### 4.2 Slice-by-Slice Smoke Tests

| Slice | Test |
|:---|:---|
| `drillDownSlice` | Open data drawer → verify raw records display |
| `webrSlice` | Run R analysis → verify results render |
| `workspaceSlice` | Load multiple files → verify dataset list |
| `slidesSlice` | Create slide → switch away → switch back → verify state restored |
| `dataSlice` | Drop file → verify variables, rowCount, metadata |
| `analysisSlice` | Drag variable to rows → verify crosstab renders |

### 4.3 EngineProxy Protocol Tests

| Test | Coverage |
|:---|:---|
| Request-response matching | Send 10 concurrent requests → verify each response matches its request ID |
| Error propagation | Engine throws VelocityError → EngineProxy rejects with same error |
| ArrayBuffer transfer | Load file via transferable → verify zero-copy (no main-thread memory spike) |
| Timeout handling | Engine hangs → EngineProxy rejects after configurable timeout |

### 4.4 Export Convergence Test

| Test | Coverage |
|:---|:---|
| Browser export = CLI export | Same DeckSpec → export via browser EngineProxy and CLI engine → compare PPTX structure |

### 4.5 Live Agent Mode Tests

| Test | Coverage |
|:---|:---|
| Agent loads file → browser reflects | WebSocket `velocity_load` → verify Zustand store updates → verify UI renders variables |
| Agent adds filter → FilterBar updates | WebSocket `velocity_filter` → verify FilterBar chip appears |
| Agent builds deck → slides appear | WebSocket `velocity_build_deck` → verify TimelineDock shows slides |

---

## 5. Performance Expectations

| Operation | Current | Target | Notes |
|:---|:---|:---|:---|
| File load (10MB SAV) | <2s | <2s | No regression. Engine adds <10ms overhead. |
| Crosstab execution | ~50-150ms | ~50-150ms | Same DuckDB query. EngineProxy adds <5ms round-trip. |
| Slide switch | ~100ms | ~150ms | Slightly slower (engine state reset + re-execute vs store snapshot restore). Acceptable. |
| Export (10-slide PPTX) | N/A (per-slide) | <3s | New batch capability via DeckBuilder. |
| Config change → result display | ~0ms (auto-trigger) | <250ms (debounced) | 200ms debounce + <50ms execution. Feels instant. |
| EngineProxy round-trip overhead | N/A | <5ms | postMessage + JSON serialize/deserialize |

---

## 6. Deliverables

| # | Deliverable | Location | LOC Estimate |
|:---|:---|:---|:---|
| 1 | EngineProxy class | `src/services/EngineProxy.ts` | ~250 |
| 2 | Engine worker message types | `src/types/engineWorker.ts` | ~100 |
| 3 | Worker engine handler | `src/services/analysisWorker.ts` (modify) | ~200 (rewrite message handler) |
| 4 | Engine initialization hook | `src/hooks/useEngineProxy.ts` | ~60 |
| 5 | drillDownSlice migration | `src/store/slices/drillDownSlice.ts` | ~20 (edit) |
| 6 | webrSlice migration | `src/store/slices/webrSlice.ts` | ~30 (edit) |
| 7 | workspaceSlice migration | `src/store/slices/workspaceSlice.ts` | ~40 (edit) |
| 8 | slidesSlice migration | `src/store/slices/slidesSlice.ts` | ~60 (edit) |
| 9 | dataSlice migration | `src/store/slices/dataSlice.ts` | ~80 (edit) |
| 10 | analysisSlice migration | `src/store/slices/analysisSlice.ts` | ~150 (edit) |
| 11 | App.tsx decomposition | `src/App.tsx` → extracted modules | ~200 (extract) |
| 12 | Export modal migration | `src/components/overlays/` | ~60 (edit) |
| 13 | WebSocket bridge scaffold | `src/services/AgentBridge.ts` | ~150 |
| 14 | Migration parity tests | `tests/migration/` | ~400 |
| 15 | EngineProxy tests | `src/services/__tests__/EngineProxy.test.ts` | ~200 |
| 16 | Live agent mode tests | `tests/e2e/liveAgent.test.ts` | ~150 |

**Total:** ~2,150 LOC new/modified code

---

## 7. Sequencing

```
Week 1:  [1] EngineProxy + worker message types
         [2] Worker engine handler (new protocol alongside old)
         [3] useEngineProxy hook + engine init
Week 2:  [4] Migrate drillDownSlice, webrSlice, workspaceSlice (low risk)
         [5] Parity tests for migrated slices
Week 3:  [6] Migrate slidesSlice (slide state switching mechanism change)
         [7] Migrate dataSlice (file loading path)
         [8] Parity tests
Week 4:  [9] Migrate analysisSlice (highest risk, most call sites)
         [10] Separate config mutation from execution + debounce
         [11] Comprehensive regression testing
Week 5:  [12] App.tsx decomposition
         [13] Export modal migration to DeckBuilder
         [14] Remove old worker protocol handlers
Week 6:  [15] WebSocket bridge scaffold (live agent mode)
         [16] Live agent mode tests
         [17] Full regression pass + performance benchmarks
```

### Critical Gate

After Week 4 (analysisSlice migration), run the full test suite + manual testing of:
- File load → crosstab → filter → weight → export
- Slide creation → reorder → switch → delete
- Variable Manager → recode → verify in analysis

If any regression is found, fix before proceeding to Weeks 5-6.

### Dependencies on Phase 4

Phase 4 (Semantic Layer) requires:
- Engine as the single source of truth for data access (no legacy worker paths)
- Live agent mode operational (for semantic search integration)
- Session format stable (semantic annotations extend it)
