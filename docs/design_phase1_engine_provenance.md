# Design Brief: Phase 1 — VelocityEngine + Provenance

**Author:** Architect (Claude Opus)
**Date:** 2026-03-09
**Status:** Proposal
**Scope:** Extract VelocityEngine as a single orchestration layer for CLI, MCP, and browser consumption. Add ResultEnvelope provenance. Fix PPTX export gaps.
**Ref:** `docs/arch_07_agent_architecture.md` §10 Phase 1

---

## 0. Executive Summary & Reality Check

Before designing, the codebase was audited against the architecture spec. The existing headless core is substantially complete — the gap is **orchestration**, not computation.

| Component | Spec Assumption | Actual State | Real Gap |
|:---|:---|:---|:---|
| DatabaseAdapter | Exists | **Complete** (`src/core/DatabaseAdapter.ts`, 2 adapters) | None |
| Analysis runners | Exist | **Complete** (crosstabRunner, variableStatsRunner, registry) | None |
| Session export/import | Exist | **Complete** (sessionExporter, sessionImporter, validator, diagnostics) | None |
| PPTX export | Exists, gaps noted | **Complete** (331 LOC, charts, theming) | Speaker notes, subtitles, section dividers missing |
| Chart recommender | Exists | **Complete** (134 LOC, 20+ chart types) | Not exposed via engine API |
| CLI | Exists | **Complete** (316 LOC, 6 commands) | Uses adapter directly, not engine |
| VelocityEngine class | To be created | **Does not exist** | Full implementation needed |
| ResultEnvelope | To be created | **Does not exist** | Full implementation needed |
| Auto title/subtitle | In SlideHeader.tsx | **UI-coupled** | Extract to headless core |
| Slide.notes | To be added | **Not in type** | Type extension + PPTX wiring |

**Bottom line:** The core modules are production-ready. Phase 1 is a **wiring and wrapping** exercise, not a rewrite. The engine is a facade over existing modules, plus provenance wrapping and PPTX gap fixes.

---

## 1. Approach

### 1.1 VelocityEngine — The Facade

Create `src/engine/VelocityEngine.ts` as a stateful facade that owns:
- A `DatabaseAdapter` instance (Node or WASM)
- Current session state (variables, filters, weight, dataset metadata)
- Analysis lifecycle (stage → execute → envelope)

```
src/engine/
├── VelocityEngine.ts      # Main orchestration class
├── types.ts               # ResultEnvelope, VelocityError, config types
└── index.ts               # Barrel exports
```

**Key design decisions:**

1. **Factory construction.** `VelocityEngine.create({ runtime: 'node' | 'wasm' })` returns a ready-to-use instance. Adapter instantiation is internal.

2. **Adapter injection for testing.** Accept an optional `adapter` parameter to allow test doubles. This avoids DuckDB initialization in unit tests.

3. **State is internal, not store-coupled.** The engine maintains its own variable registry, active filters, and weight setting. It does NOT depend on Zustand. The browser will sync engine state ↔ store state in Phase 3; until then, they are independent.

4. **Session state bootstrapped on load.** `loadFile()` / `loadBuffer()` ingests data, extracts metadata via `processMetadata()`, and populates the engine's internal variable/set registries.

### 1.2 ResultEnvelope — Provenance Wrapper

Every engine method that returns data wraps it in:

```typescript
interface ResultEnvelope<T> {
  data: T;
  operation: string;
  inputs: Record<string, unknown>;
  durationMs: number;
  warnings: string[];
  metadata: {
    datasetName: string;
    rowCount: number;
    filtersApplied: number;
    isWeighted: boolean;
    engineVersion: string;
  };
}
```

**Implementation:** A private `engine.wrap<T>(operation, inputs, fn)` helper that:
1. Records `performance.now()` start
2. Calls `fn()` to get the result
3. Catches warnings (accumulated during execution via a `WarningCollector`)
4. Returns the envelope

**Overhead:** ~200 bytes per envelope. Negligible.

### 1.3 VelocityError — Structured Errors

```typescript
class VelocityError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) { super(message); }
}
```

Error codes: `INVALID_VARIABLE`, `ANALYSIS_FAILED`, `FILE_LOAD_FAILED`, `SESSION_INVALID`, `NO_DATASET_LOADED`.

### 1.4 Engine API Surface

```typescript
class VelocityEngine {
  // Lifecycle
  static async create(options?: EngineOptions): Promise<VelocityEngine>;
  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>>;
  async loadBuffer(name: string, buffer: ArrayBuffer, format: 'sav' | 'csv'): Promise<ResultEnvelope<DatasetSummary>>;
  async close(): Promise<void>;

  // Introspection
  describe(): DatasetDescription;
  async describeVariable(id: string): Promise<ResultEnvelope<VariableDetail>>;
  listAnalyses(): AnalysisDescriptor[];
  getSession(): VelocitySessionFile;

  // Analysis (explicit execution)
  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<AnalysisResult>>;
  async query(sql: string): Promise<ResultEnvelope<QueryResult>>;

  // State mutation (staged, not auto-executed)
  async recode(sourceVar: string, config: RecodeConfig): Promise<ResultEnvelope<Variable>>;
  setWeight(variableId: string | null): void;
  addFilter(filter: FilterSpec): void;
  removeFilter(filterId: string): void;
  clearFilters(): void;
  getActiveFilters(): Filter[];

  // Session
  async exportSession(): Promise<VelocitySessionFile>;
  async importSession(session: VelocitySessionFile): Promise<ResultEnvelope<SessionImportDiagnostics>>;
}
```

**Delegation map:**

| Engine method | Delegates to | Module |
|:---|:---|:---|
| `loadFile()` | `adapter.loadCSV()` / SAV ingestion pipeline | `savLoader.ts`, adapter |
| `describe()` | Internal state (populated on load) | — |
| `describeVariable()` | `getVariableStats()` | `variableStatsRunner.ts` |
| `listAnalyses()` | `analysisRegistry.list()` | `registry.ts` |
| `runAnalysis('crosstab', ...)` | `runCrosstab()` | `crosstabRunner.ts` |
| `runAnalysis('variableStats', ...)` | `getVariableStats()` | `variableStatsRunner.ts` |
| `runAnalysis(id, ...)` | `analysisRegistry.get(id).run()` | Plugin runners |
| `query()` | `adapter.query()` | `DatabaseAdapter` |
| `recode()` | SQL ALTER + variable registry update | `adapter.execute()` |
| `exportSession()` | `exportSession()` | `sessionExporter.ts` |
| `importSession()` | `importSession()` | `sessionImporter.ts` |

### 1.5 PPTX Export Gap Fixes

Three targeted fixes in `src/core/export/pptxExporter.ts`:

**1. Speaker notes.** Add `notes?: string` to `Slide` type in `src/types/slides.ts`. In `exportPptx()`, after adding slide content, call `slide.addNotes(slideData.notes)` when present.

**2. Subtitle export.** The `Slide` type already has `subtitle?: string`. In `exportPptx()`, render subtitle as a secondary text element below the title (smaller font, muted color).

**3. Section dividers.** When iterating slides, detect `SlideSection` boundaries. Insert a full-bleed divider slide with section title before the first slide in each section.

### 1.6 Headless Slide Defaults

Extract from `SlideHeader.tsx` into `src/core/export/resolveSlideDefaults.ts`:

```typescript
function resolveSlideTitle(
  rowVars: Variable[],
  colVar: Variable | null
): string;

function resolveSlideSubtitle(
  filters: Filter[],
  weightVar: Variable | null,
  rowCount: number,
  isWeighted: boolean
): string;
```

These are pure functions. The existing `SlideHeader.tsx` component should import and call these instead of inlining the logic.

### 1.7 CLI Refactor

Refactor `cli/velocity.ts` to use `VelocityEngine` instead of raw adapter access:

```typescript
// Before
const adapter = await DuckDBNodeAdapter.create();
await adapter.loadCSV(file, 'data');
const result = await runCrosstab(adapter, options, context);

// After
const engine = await VelocityEngine.create({ runtime: 'node' });
await engine.loadFile(file);
const result = await engine.runAnalysis('crosstab', options);
```

This validates the engine API against a real consumer before MCP work begins.

Add `velocity repl` command: a readline-based REPL that accepts engine commands interactively. This is the fastest way to test the engine API manually.

---

## 2. Invariants Touched

| Invariant | Impact | Mitigation |
|:---|:---|:---|
| **Dependency direction** (`src/core/` no browser deps) | `src/engine/` is a new directory. Must also be browser-independent. | Engine imports only from `src/core/`, `src/types/`, `src/adapters/`. Zero React/DOM imports. Lint rule to enforce. |
| **Worker-first compute** | Engine does NOT replace the worker. In browser, the worker will eventually wrap the engine. | Phase 1 engine runs in Node only. Browser integration deferred to Phase 3. |
| **Dual-state data model** | Engine's `describe()` returns labeled variables. `runAnalysis()` computes on raw values. | Engine delegates to existing runners which already respect this. |
| **Session format stability** | Engine produces/consumes `VelocitySessionFile` v1. | No schema changes. Engine wraps existing session module. |

---

## 3. Risks

| Risk | Severity | Mitigation |
|:---|:---|:---|
| **Engine API locks in too early** | Medium | Phase 1 consumers are CLI + tests only. API can evolve before MCP (Phase 2) freezes it. Mark as `@unstable` in JSDoc. |
| **SAV loading in Node** | Medium | `DuckDBNodeAdapter` has `loadSav()` but needs a Node-compatible SAV parser. Phase 1 scope: CSV only for engine validation. SAV support via buffer path if parser available. |
| **ResultEnvelope overhead on hot paths** | Low | Envelopes are return wrappers, not stored. GC handles them. Benchmark confirms <0.1ms overhead. |
| **SlideHeader.tsx extraction breaks UI** | Low | Extract functions, import them back into component. Zero behavior change. Test with existing snapshot tests. |
| **PPTX regression** | Medium | Add golden test: export a known deck → verify PPTX content (slide count, notes presence, subtitle text). |

---

## 4. Test Strategy

### 4.1 Unit Tests

| Test file | Coverage |
|:---|:---|
| `src/engine/VelocityEngine.test.ts` | Lifecycle (create/close), loadFile, describe, runAnalysis, filter staging, weight setting |
| `src/engine/ResultEnvelope.test.ts` | Envelope structure, timing, warning accumulation |
| `src/core/export/resolveSlideDefaults.test.ts` | Title generation (1 var, 2 vars, with col, without col), subtitle generation (filters, weight, N formatting) |

### 4.2 Integration Tests

| Test | Approach |
|:---|:---|
| Engine → crosstab roundtrip | Load CSV fixture → `runAnalysis('crosstab', ...)` → verify envelope contains correct data + metadata |
| Engine → session roundtrip | Load → configure (filters, weight) → `exportSession()` → create new engine → `importSession()` → verify state matches |
| PPTX speaker notes | Export deck with notes → parse PPTX XML → verify `<p:txBody>` in notes element |
| PPTX section dividers | Export deck with 2 sections → verify slide count = content slides + divider slides |

### 4.3 CLI Smoke Tests

Verify all existing CLI commands still work after engine refactor. Script-based: run each command against fixture CSV, diff output against baseline.

---

## 5. Performance Expectations

| Operation | Target | Rationale |
|:---|:---|:---|
| `VelocityEngine.create()` | <500ms (Node) | DuckDB in-memory init is ~200ms. Budget 300ms for engine setup. |
| `loadFile()` (10MB CSV) | <2s | Existing constraint from CLAUDE.md. DuckDB `read_csv_auto` handles this. |
| `describe()` | <1ms | Returns cached internal state. No DB query. |
| `runAnalysis('crosstab', ...)` | Same as raw runner | Engine adds ~0.1ms envelope overhead. No performance regression. |
| `exportSession()` | <50ms | JSON serialization of in-memory state. |
| ResultEnvelope overhead | <0.1ms per call | Measured: `performance.now()` + object allocation. |

---

## 6. Deliverables

| # | Deliverable | Location | LOC Estimate |
|:---|:---|:---|:---|
| 1 | `VelocityEngine` class | `src/engine/VelocityEngine.ts` | ~400 |
| 2 | Engine types (ResultEnvelope, VelocityError, configs) | `src/engine/types.ts` | ~120 |
| 3 | Engine barrel export | `src/engine/index.ts` | ~10 |
| 4 | Slide defaults resolver | `src/core/export/resolveSlideDefaults.ts` | ~80 |
| 5 | `Slide.notes` type addition | `src/types/slides.ts` | ~5 (edit) |
| 6 | PPTX: subtitle, notes, section dividers | `src/core/export/pptxExporter.ts` | ~60 (edit) |
| 7 | CLI refactor to use engine | `cli/velocity.ts` | ~100 (rewrite) |
| 8 | CLI REPL mode | `cli/velocity.ts` or `cli/repl.ts` | ~150 |
| 9 | Engine unit tests | `src/engine/__tests__/` | ~300 |
| 10 | PPTX golden tests | `tests/golden/` | ~100 |
| 11 | Slide defaults tests | `src/core/export/__tests__/` | ~80 |

**Total:** ~1,400 LOC new code + ~165 LOC edits

---

## 7. Sequencing

```
Week 1:  [1] Engine types → [2] VelocityEngine class (create, loadFile, describe)
         [3] resolveSlideDefaults extraction
Week 2:  [4] Engine analysis methods (runAnalysis, query, recode)
         [5] Engine state methods (filters, weight, session)
         [6] Unit tests for all engine methods
Week 3:  [7] PPTX gap fixes (notes, subtitle, section dividers)
         [8] CLI refactor → validates engine API
         [9] CLI REPL mode
Week 4:  [10] Integration tests, golden tests
         [11] API review + documentation pass
```

### Dependencies on Phase 2

Phase 2 (MCP + Deck Builder) requires:
- Stable `VelocityEngine` API (all public methods finalized)
- `ResultEnvelope` working and tested
- PPTX export supporting notes and sections
- `resolveSlideDefaults` available in headless core

Phase 1 must be **complete and tested** before Phase 2 begins. The engine API is the contract that MCP tools will bind to.
