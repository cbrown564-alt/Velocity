# Design Brief: Phase 2 — MCP Server + Deck Builder

**Author:** Architect (Claude Opus)
**Date:** 2026-03-09
**Status:** Proposal
**Scope:** Implement DeckBuilder in engine. Create MCP server package. Map engine methods to MCP tools. Enable AI agents to load data, analyze, build decks, and export.
**Ref:** `docs/arch_07_agent_architecture.md` §10 Phase 2
**Depends on:** Phase 1 (VelocityEngine + Provenance) complete

---

## 0. Executive Summary & Reality Check

Phase 2 builds the agent-facing interface on top of the VelocityEngine established in Phase 1. Two major components:

| Component | Current State | Work Required |
|:---|:---|:---|
| DeckBuilder | **Does not exist.** Slides are created one-at-a-time via Zustand store actions. | New module: batch deck composition from declarative spec |
| MCP Server | **Does not exist.** No `mcp-server/` directory. | New package: transport adapter over VelocityEngine |
| Chart recommender exposure | **Exists** (`chartRecommender.ts`, 134 LOC) but not accessible via engine | Wire through engine API |
| Analysis config schemas | **AnalysisRunner interface exists** (`AnalysisRunner.ts`, 24 LOC) with registry | Expose `configSchema` from runners |
| Harmonization tools | **matchEngine exists** (10.8KB), waveDetector, harmonizationQueries | Wire through engine, expose via MCP |

**Bottom line:** DeckBuilder is the major new module (~300 LOC). MCP server is a thin transport layer (~400 LOC). Most work is wiring existing capabilities to new interfaces.

---

## 1. Approach

### 1.1 DeckBuilder — Batch Deck Composition

**Location:** `src/engine/DeckBuilder.ts`

The DeckBuilder takes a `DeckSpec` (pure data — no results, no pixels) and materializes it into a `BuiltDeck` by executing every slide's analysis.

```typescript
class DeckBuilder {
  constructor(private engine: VelocityEngine) {}

  async build(spec: DeckSpec): Promise<ResultEnvelope<BuiltDeck>>;
  async export(deck: BuiltDeck, options: DeckExportOptions): Promise<Uint8Array>;
}
```

**Build pipeline (per slide):**

```
SlideSpec
  │
  ├─ 1. Validate: rowVars exist in engine.describe()
  │     → VelocityError('INVALID_VARIABLE') if not
  │
  ├─ 2. Stage state: apply slide-level filters/weight
  │     (isolated from engine's global state via snapshot/restore)
  │
  ├─ 3. Execute: engine.runAnalysis('crosstab', {
  │       rowVars, colVar, filters, weightVar
  │     })
  │     → ResultEnvelope<AnalysisResult>
  │
  ├─ 4. Process: processAnalysisData(result)
  │     → ProcessedAnalysisData (tree, series, columns)
  │     (reuse existing processAnalysisData from export pipeline)
  │
  ├─ 5. Resolve defaults:
  │     ├─ title: resolveSlideTitle(vars, colVar)
  │     ├─ subtitle: resolveSlideSubtitle(filters, weight, N)
  │     └─ chartType: recommendChart(processed) if not specified
  │
  └─ 6. Package: BuiltSlide { spec, result, processed, resolved* }
```

**Key design decisions:**

1. **Per-slide isolation.** Each slide may have its own filters and weight, different from the engine's global state. The builder snapshots engine state, applies slide-specific overrides, runs the analysis, then restores. This prevents slides from interfering with each other.

2. **Fail-soft per slide.** If one slide's analysis fails (bad variable, empty result), the builder records the error in that slide's envelope and continues. The `BuiltDeck` includes partial results with clear error diagnostics. Agents can inspect failures and retry or skip.

3. **Sequential execution.** Slides execute sequentially, not in parallel. DuckDB is single-connection in both Node and WASM. Parallelism adds complexity for negligible gain since DuckDB queries are already fast (<100ms each).

4. **Export delegates to existing pipeline.** `DeckBuilder.export()` wraps the existing `exportPptx()` / `exportXlsx()` functions from `src/core/export/`, passing the materialized slides. Phase 1's PPTX gap fixes (notes, subtitles, section dividers) are prerequisites.

### 1.2 DeckSpec Types

**Location:** `src/engine/types.ts` (extend Phase 1 types file)

```typescript
interface DeckSpec {
  title: string;
  subtitle?: string;
  branding?: ExportBranding;
  sections: DeckSectionSpec[];
}

interface DeckSectionSpec {
  title: string;
  slides: SlideSpec[];
}

interface SlideSpec {
  rowVars: string[];              // Required
  colVar?: string | null;
  filters?: FilterSpec[];
  weightVar?: string | null;
  title?: string;
  subtitle?: string;
  notes?: string;                 // → PPTX speaker notes
  visualizationType?: 'table' | 'chart';
  chartType?: ChartType;
  displayOptions?: {
    showSignificance?: boolean;
    showPercents?: boolean;
    showCounts?: boolean;
  };
}

interface BuiltDeck {
  spec: DeckSpec;
  slides: BuiltSlide[];
  errors: DeckBuildError[];       // Slides that failed
  buildDurationMs: number;
}

interface BuiltSlide {
  spec: SlideSpec;
  sectionTitle: string;
  result: ResultEnvelope<AnalysisResult>;
  processed: ProcessedAnalysisData;
  resolvedTitle: string;
  resolvedSubtitle: string;
  resolvedChartType?: ChartType;
}

interface DeckBuildError {
  slideIndex: number;
  sectionTitle: string;
  error: VelocityError;
}

interface DeckExportOptions {
  format: 'pptx' | 'xlsx';
  branding?: ExportBranding;
}
```

### 1.3 MCP Server — Transport Adapter

**Location:** `mcp-server/`

```
mcp-server/
├── package.json            # Separate package, depends on @modelcontextprotocol/sdk
├── tsconfig.json
├── index.ts                # Server entry point
├── tools.ts                # Tool definitions (schemas + handlers)
└── __tests__/
    └── tools.test.ts       # Tool handler unit tests
```

**Architecture:** The MCP server is a stateless adapter. It holds a single `VelocityEngine` instance and maps incoming tool calls to engine methods. No business logic lives in the MCP layer.

```typescript
// index.ts (simplified)
import { Server } from '@modelcontextprotocol/sdk/server';
import { VelocityEngine } from '../src/engine';
import { registerTools } from './tools';

const engine = await VelocityEngine.create({ runtime: 'node' });
const server = new Server({ name: 'velocity', version: '1.0.0' });

registerTools(server, engine);
server.listen();
```

### 1.4 MCP Tool Definitions

Each tool maps to 1-2 engine methods. Tool input schemas are derived from engine method signatures.

**Data lifecycle tools:**

| Tool | Engine method | Input schema | Output |
|:---|:---|:---|:---|
| `velocity_load` | `engine.loadFile(path)` | `{ path: string }` | `ResultEnvelope<DatasetSummary>` |
| `velocity_describe` | `engine.describe()` | `{}` | `DatasetDescription` (variables, sets, types) |
| `velocity_describe_variable` | `engine.describeVariable(id)` | `{ id: string }` | `ResultEnvelope<VariableDetail>` |
| `velocity_list_analyses` | `engine.listAnalyses()` | `{}` | `AnalysisDescriptor[]` with config schemas |

**Analysis tools:**

| Tool | Engine method | Input schema |
|:---|:---|:---|
| `velocity_crosstab` | `engine.runAnalysis('crosstab', config)` | CrosstabQueryOptions |
| `velocity_stats` | `engine.runAnalysis('variableStats', config)` | `{ column: string, type?: string }` |
| `velocity_sql` | `engine.query(sql)` | `{ sql: string }` |
| `velocity_recode` | `engine.recode(sourceVar, config)` | RecodeConfig |
| `velocity_filter` | `engine.addFilter(filter)` | FilterSpec |
| `velocity_clear_filters` | `engine.clearFilters()` | `{}` |
| `velocity_set_weight` | `engine.setWeight(varId)` | `{ variableId: string \| null }` |

**Deck building tools:**

| Tool | Engine method | Input schema |
|:---|:---|:---|
| `velocity_build_deck` | `engine.buildDeck(spec)` | DeckSpec |
| `velocity_export_deck` | `engine.exportDeck(deck, options)` | DeckExportOptions |
| `velocity_recommend_chart` | `engine.recommendChart(data)` | ProcessedAnalysisData summary |

**Harmonization tools:**

| Tool | Engine method | Input schema |
|:---|:---|:---|
| `velocity_propose_mappings` | `engine.proposeMappings(waves)` | Wave descriptors |
| `velocity_build_harmonized_table` | `engine.buildHarmonizedTable(mappings)` | Confirmed mappings |

**Session tools:**

| Tool | Engine method | Input schema |
|:---|:---|:---|
| `velocity_export_session` | `engine.exportSession()` | `{}` |
| `velocity_import_session` | `engine.importSession(session)` | VelocitySessionFile |

### 1.5 Tool Response Format

All tool responses follow MCP content conventions:

```typescript
// Success
{
  content: [{
    type: 'text',
    text: JSON.stringify(resultEnvelope, null, 2)
  }]
}

// Error
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      error: velocityError.code,
      message: velocityError.message,
      details: velocityError.details
    })
  }],
  isError: true
}
```

### 1.6 Analysis Config Schemas

Expose `configSchema` from each `AnalysisRunner` so agents can discover what parameters are available without hardcoding knowledge:

```typescript
// AnalysisRunner interface extension
interface AnalysisRunner<TConfig, TResult> {
  id: string;
  name: string;
  configSchema: JSONSchema;  // Machine-readable parameter spec
  run(adapter: DatabaseAdapter, config: TConfig, context: AnalysisContext): Promise<TResult>;
}
```

The `velocity_list_analyses` tool returns these schemas, enabling agents to construct valid configs dynamically.

### 1.7 File Access Sandboxing

The MCP server must restrict file access to a configurable `dataDir`:

```typescript
const engine = await VelocityEngine.create({
  runtime: 'node',
  dataDir: process.env.VELOCITY_DATA_DIR || process.cwd()
});
```

`loadFile()` resolves paths relative to `dataDir` and rejects traversal attempts (`../`, absolute paths outside root). This prevents an agent from reading arbitrary files on the host.

---

## 2. Invariants Touched

| Invariant | Impact | Mitigation |
|:---|:---|:---|
| **Dependency direction** | `mcp-server/` is a new package. Must depend on `src/engine/`, never on React/browser code. | Package boundary enforced by separate `tsconfig.json` with explicit `paths`. |
| **src/core/ portability** | DeckBuilder lives in `src/engine/`, not `src/core/`. It orchestrates core modules but is not itself a pure function. | Clear boundary: `src/core/` = pure computation, `src/engine/` = stateful orchestration. |
| **Dual-state data model** | MCP tools expose labeled variable metadata. Analysis operates on raw values. | Engine maintains this separation already (Phase 1). MCP layer is pass-through. |
| **No server-side data** | MCP server runs locally. Data stays on disk. No network upload. | MCP uses stdio transport, not HTTP. Agent connects locally. |

---

## 3. Risks

| Risk | Severity | Mitigation |
|:---|:---|:---|
| **MCP SDK instability** | Medium | `@modelcontextprotocol/sdk` is actively maintained. Pin exact version. Thin adapter means low coupling — SDK changes affect only `mcp-server/index.ts`. |
| **Agent hallucination (wrong variables)** | Medium | `velocity_describe()` returns full variable metadata. Provenance envelopes audit every analysis. Session handoff lets humans review. Agent mistakes are traceable. |
| **DeckBuilder perf with many slides** | Low | 50-slide deck = 50 sequential DuckDB queries. At ~50ms each = ~2.5s total. Acceptable. If needed, batch SQL generation is a future optimization. |
| **Tool schema divergence** | Medium | MCP tool input schemas are generated from TypeScript types, not hand-written JSON. Single source of truth prevents drift. |
| **Harmonization tool completeness** | Medium | `matchEngine.ts` implements auto-matching. `proposeMappings` needs an engine method wrapper. Scope to read-only proposal; manual confirmation via session file. |
| **Large dataset memory pressure** | Low | DuckDB handles memory management. Engine doesn't buffer full datasets. MCP responses are streamed via stdio. |

---

## 4. Test Strategy

### 4.1 DeckBuilder Tests

| Test | Coverage |
|:---|:---|
| `DeckBuilder.test.ts` | Build 1-section, 1-slide deck → verify BuiltDeck structure |
| | Build multi-section deck → verify slide count, section titles |
| | Build with invalid variable → verify error in `errors[]`, other slides succeed |
| | Build with per-slide filters → verify isolation (slide A's filter doesn't affect slide B) |
| | Build with per-slide weight → verify weighted results |
| | Build with auto-title → verify `resolvedTitle` matches expected pattern |
| | Build with explicit title → verify `resolvedTitle` = spec title |
| | Export to PPTX → verify file is valid PPTX (parse ZIP, check slide count) |

### 4.2 MCP Server Tests

| Test | Coverage |
|:---|:---|
| `tools.test.ts` | Each tool handler: valid input → correct engine method called → correct response format |
| | Each tool handler: invalid input → `isError: true` response with VelocityError code |
| | `velocity_load` with path traversal → rejected |
| | `velocity_build_deck` → full roundtrip (load → describe → build → export) |
| Integration | Connect Claude Code to MCP server → run example workflow from arch doc §6.2 |

### 4.3 End-to-End Agent Workflow Test

Script the example workflow from `arch_07_agent_architecture.md` §6.2:
1. `velocity_load` → verify dataset summary
2. `velocity_describe` → verify variable list
3. `velocity_stats` → verify frequencies
4. `velocity_crosstab` → verify table with significance
5. `velocity_build_deck` → verify built deck
6. `velocity_export_deck` → verify PPTX file exists and is valid
7. `velocity_export_session` → verify .velocity file

This is the acceptance test for Phase 2.

---

## 5. Performance Expectations

| Operation | Target | Rationale |
|:---|:---|:---|
| `velocity_load` (10MB CSV) | <3s | 2s for DuckDB + 1s for metadata extraction |
| `velocity_describe` | <10ms | Cached engine state, JSON serialization |
| `velocity_crosstab` | <200ms | DuckDB OLAP query + significance testing |
| `velocity_build_deck` (10 slides) | <3s | ~200ms per slide + overhead |
| `velocity_build_deck` (50 slides) | <12s | Sequential execution, acceptable for batch |
| `velocity_export_deck` (PPTX, 10 slides) | <2s | pptxgenjs generation + ZIP compression |
| MCP tool overhead | <5ms | JSON parse/serialize + method dispatch |

---

## 6. Deliverables

| # | Deliverable | Location | LOC Estimate |
|:---|:---|:---|:---|
| 1 | DeckBuilder class | `src/engine/DeckBuilder.ts` | ~300 |
| 2 | Deck types (DeckSpec, BuiltDeck, etc.) | `src/engine/types.ts` | ~100 (extension) |
| 3 | Engine methods for deck + harmonization | `src/engine/VelocityEngine.ts` | ~100 (extension) |
| 4 | Chart recommender engine wrapper | `src/engine/VelocityEngine.ts` | ~20 (extension) |
| 5 | Analysis config schemas on runners | `src/core/analysis/` | ~50 (edits) |
| 6 | MCP server package | `mcp-server/package.json` | ~20 |
| 7 | MCP server entry | `mcp-server/index.ts` | ~80 |
| 8 | MCP tool definitions | `mcp-server/tools.ts` | ~400 |
| 9 | MCP tsconfig | `mcp-server/tsconfig.json` | ~15 |
| 10 | DeckBuilder tests | `src/engine/__tests__/DeckBuilder.test.ts` | ~350 |
| 11 | MCP tool tests | `mcp-server/__tests__/tools.test.ts` | ~300 |
| 12 | E2E agent workflow test | `tests/e2e/agentWorkflow.test.ts` | ~150 |

**Total:** ~1,900 LOC new code

---

## 7. Sequencing

```
Week 1:  [1] Deck types → [2] DeckBuilder class
         [3] DeckBuilder tests (unit)
Week 2:  [4] Engine extensions (buildDeck, exportDeck, recommendChart)
         [5] Analysis config schemas on runners
         [6] Harmonization engine wrappers
Week 3:  [7] MCP server scaffold (package.json, tsconfig, index.ts)
         [8] MCP tool definitions (all ~20 tools)
         [9] MCP tool tests
Week 4:  [10] File access sandboxing
         [11] E2E agent workflow test
         [12] Test with Claude Code + real .SAV dataset
```

### Dependencies on Phase 3

Phase 3 (Browser Convergence) requires:
- Stable engine API (frozen after Phase 2 MCP testing)
- DeckBuilder producing correct BuiltDeck structures
- Session roundtrip working between engine and browser

Phase 2 must be **validated with a real agent** (Claude Code) before Phase 3 begins. The MCP integration test is the gate.
