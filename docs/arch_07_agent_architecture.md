# Agent Architecture

Velocity exposes the same analytical engine to both human users (browser) and AI agents (MCP/CLI). This document defines the architecture that makes that possible.

## 1. Design Principles

**Shared engine, different interfaces.** The browser's React UI and an AI agent's tool-use calls are both thin clients of a single `VelocityEngine`. Neither gets special access to capabilities the other lacks.

**Explicit execution, not implicit side effects.** State changes and analysis runs are separate operations. An agent (or the UI) stages intent, then explicitly executes. No auto-triggering `runAnalysis()` on config mutation.

**Slides are configs, not content.** A slide is a declarative specification — row vars, col var, filters, weight, chart type, title, notes. The data is always recomputed from this spec. Agents compose decks by assembling slide configs, not by generating pixels.

**Provenance by default.** Every engine operation returns a `ResultEnvelope` containing the result, the inputs that produced it, execution metadata, and any warnings. This is mandatory for defensible survey research.

**Session files are the handoff primitive.** The `.velocity` session format is the sync point between agents and humans. An agent writes a session; a human opens it in the browser and refines it. The format is versioned and stable.

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CONSUMERS                             │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐  │
│  │ Browser  │   │   CLI    │   │MCP Server│   │HTTP API│  │
│  │  (React) │   │(terminal)│   │(tool-use)│   │ (REST) │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └───┬────┘  │
│       │               │               │              │       │
│  ┌────▼───────────────▼───────────────▼──────────────▼────┐ │
│  │                  VelocityEngine                         │ │
│  │                                                         │ │
│  │  ┌─────────────┐ ┌───────────────┐ ┌───────────────┐  │ │
│  │  │   Session    │ │   Analysis    │ │    Deck       │  │ │
│  │  │   Manager    │ │   Registry    │ │    Builder    │  │ │
│  │  └─────────────┘ └───────────────┘ └───────────────┘  │ │
│  │  ┌─────────────┐ ┌───────────────┐ ┌───────────────┐  │ │
│  │  │   Export     │ │  Harmonize    │ │  Introspect   │  │ │
│  │  │   Pipeline   │ │  Pipeline     │ │  / Describe   │  │ │
│  │  └─────────────┘ └───────────────┘ └───────────────┘  │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│  ┌───────────────────────▼─────────────────────────────────┐ │
│  │                DatabaseAdapter                           │ │
│  │    DuckDBWasmAdapter (browser) │ DuckDBNodeAdapter (CLI) │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   src/core/ (pure functions)              │ │
│  │  crosstabRunner · variableStatsRunner · queryBuilder      │ │
│  │  savLoader · gridDetection · matchEngine                  │ │
│  │  pptxExporter · xlsxExporter · sessionExporter            │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 3. VelocityEngine

The engine is a stateful class that owns the database adapter, session state, and analysis lifecycle. All consumers call it; it delegates to `src/core/` pure functions.

### 3.1 Lifecycle

```typescript
class VelocityEngine {
  static async create(options?: {
    runtime: 'node' | 'wasm';
    dataDir?: string;       // Sandboxed file access root
  }): Promise<VelocityEngine>;

  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>>;
  async loadBuffer(name: string, buffer: ArrayBuffer, format: 'sav' | 'csv'): Promise<ResultEnvelope<DatasetSummary>>;
  async close(): Promise<void>;
}
```

`create()` initializes the DatabaseAdapter (Node or WASM) and an empty session. The engine is long-lived — it persists across multiple operations within a CLI REPL session, MCP connection, or browser tab lifetime.

### 3.2 Introspection

```typescript
  // Full dataset metadata: variables, sets, folders, types, value labels
  describe(): DatasetDescription;

  // Deep dive on one variable: frequencies, stats, missing breakdown
  async describeVariable(id: string): Promise<ResultEnvelope<VariableDetail>>;

  // Available analysis types + their config schemas
  listAnalyses(): AnalysisDescriptor[];

  // Current session state as a portable snapshot
  getSession(): VelocitySessionFile;
```

`describe()` is the most important method for agents. It returns the full `Variable[]` and `VariableSet[]` arrays with human-readable labels, value label mappings, types, and missing value definitions. This is what lets an agent understand the dataset and propose meaningful analyses.

`listAnalyses()` exposes `configSchema` from each `AnalysisRunner`, giving agents machine-readable knowledge of what analyses exist and what parameters they accept.

### 3.3 Analysis (Explicit Execution)

```typescript
  // Run a registered analysis (crosstab, variableStats, etc.)
  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<AnalysisResult>>;

  // Raw SQL escape hatch
  async query(sql: string): Promise<ResultEnvelope<QueryResult>>;
```

Analysis execution is always explicit. There is no auto-run on config change. The caller decides when to execute. This is critical for agents that want to stage multiple config changes before running, and for the browser to implement batch/atomic updates.

### 3.4 State Mutation

```typescript
  // Variable transforms
  async recode(sourceVar: string, config: RecodeConfig): Promise<ResultEnvelope<Variable>>;
  async setWeight(variableId: string | null): void;

  // Filters (staged, not auto-executed)
  addFilter(filter: FilterSpec): void;
  removeFilter(filterId: string): void;
  clearFilters(): void;
  getActiveFilters(): Filter[];
```

Filters and config changes are staged. They take effect on the next `runAnalysis()` call. This replaces the current pattern where `analysisSlice.addFilter()` immediately triggers `runAnalysis()`.

### 3.5 Session Management

```typescript
  async exportSession(): Promise<VelocitySessionFile>;
  async importSession(session: VelocitySessionFile): Promise<ResultEnvelope<SessionImportDiagnostics>>;
```

Sessions are the checkpoint/restore mechanism. An agent can export a session after building a deck, pass it to a human, and the human can import it into the browser. The diagnostics report tells the importer what was preserved and what was dropped (missing variables, invalid filters, etc.).

### 3.6 Deck Builder

```typescript
  // Compose a complete deck from slide specifications
  async buildDeck(spec: DeckSpec): Promise<ResultEnvelope<BuiltDeck>>;

  // Export a built deck to PPTX or XLSX
  async exportDeck(deck: BuiltDeck, options: DeckExportOptions): Promise<Uint8Array>;
```

See section 5 for the full deck builder design.

## 4. ResultEnvelope

Every engine operation that produces data wraps it in a provenance envelope:

```typescript
interface ResultEnvelope<T> {
  // The result itself
  data: T;

  // What produced it
  operation: string;              // e.g. "runAnalysis:crosstab"
  inputs: Record<string, unknown>; // The config/params that were passed
  durationMs: number;

  // Diagnostics
  warnings: string[];             // Non-fatal issues (e.g. "3 variables had >50% missing")
  metadata: {
    datasetName: string;
    rowCount: number;
    filtersApplied: number;
    isWeighted: boolean;
    engineVersion: string;
  };
}
```

This is lightweight — a few hundred bytes of overhead per call. But it gives agents and humans a complete audit trail. When an agent generates a deck, every slide's analysis result carries the envelope, making the entire report reproducible and defensible.

For errors, the engine throws structured `VelocityError` objects:

```typescript
class VelocityError extends Error {
  code: string;           // e.g. "INVALID_VARIABLE", "ANALYSIS_FAILED"
  details?: unknown;      // Context-specific (e.g. { available: ["Q1", "Q2"] })
}
```

## 5. Deck Builder

The deck builder is how agents (and eventually the browser) compose multi-slide reports.

### 5.1 DeckSpec — Declarative Deck Definition

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
  // Analysis config (required)
  rowVars: string[];
  colVar?: string | null;
  filters?: FilterSpec[];
  weightVar?: string | null;

  // Presentation (optional — defaults are generated)
  title?: string;                    // Default: auto-generated from variables
  subtitle?: string;                 // Default: auto-generated from filters/weight/N
  notes?: string;                    // Speaker notes (agent's interpretation)
  visualizationType?: 'table' | 'chart';  // Default: table
  chartType?: ChartType;            // Default: from chartRecommender
  displayOptions?: {
    showSignificance?: boolean;      // Default: true
    showPercents?: boolean;          // Default: true
    showCounts?: boolean;            // Default: false
  };
}
```

A `DeckSpec` is pure data. It contains no results, no pixels, no execution state. An agent constructs it from its understanding of the dataset and the user's request.

### 5.2 BuiltDeck — Materialized Deck

```typescript
interface BuiltDeck {
  spec: DeckSpec;                    // The original spec (for audit)
  slides: BuiltSlide[];
  buildDurationMs: number;
}

interface BuiltSlide {
  spec: SlideSpec;                   // Original slide spec
  result: ResultEnvelope<AnalysisResult>;  // Analysis output with provenance
  processed: ProcessedAnalysisData;  // Ready for rendering
  resolvedTitle: string;             // Final title (auto-generated if not specified)
  resolvedSubtitle: string;          // Final subtitle
  resolvedChartType?: ChartType;     // From recommender if not specified
}
```

`buildDeck()` executes every slide's analysis, processes results, resolves defaults, and returns the materialized deck. Each slide carries its `ResultEnvelope` for provenance.

### 5.3 How buildDeck Works

```
DeckSpec (from agent or UI)
  │
  ▼
For each section → for each slide:
  │
  ├─ 1. Resolve variables: SlideSpec.rowVars → Variable[] via engine.describe()
  │
  ├─ 2. Execute analysis: engine.runAnalysis('crosstab', {
  │       rowVars, colVar, filters, weightVar
  │     })
  │
  ├─ 3. Process results: processAnalysisData(result)
  │       → ProcessedAnalysisData (tree, series, columns)
  │
  ├─ 4. Resolve defaults:
  │     ├─ title: auto-generate from variable labels if not specified
  │     ├─ subtitle: "Filtered: N · Weighted by X · N = Y"
  │     └─ chartType: chartRecommender(processed) if not specified
  │
  └─ 5. Package: BuiltSlide { spec, result, processed, resolvedTitle, ... }
  │
  ▼
BuiltDeck { spec, slides[], buildDurationMs }
  │
  ▼
exportDeck(deck, { format: 'pptx' })
  │
  ├─ Title slide: deck.title, deck.subtitle
  ├─ For each section: section divider slide
  ├─ For each slide:
  │     ├─ If table: buildSlideTable(processed, displayOptions)
  │     ├─ If chart: buildSlideChart(processed, chartType)
  │     ├─ Title: resolvedTitle
  │     ├─ Subtitle: resolvedSubtitle
  │     └─ Speaker notes: spec.notes (if present)
  └─ Return: Uint8Array (PPTX blob)
```

### 5.4 Speaker Notes — The Agent's Voice

Speaker notes are the single highest-value addition for agent-generated decks. An agent's real strength is interpretation — explaining what the numbers mean, why a finding matters, what the caveats are.

```typescript
// Agent constructs a slide with notes
{
  rowVars: ["satisfaction"],
  colVar: "age_group",
  title: "Satisfaction Declines Sharply in 25-34 Cohort",
  notes: [
    "Satisfaction scores for the 25-34 age group (M=3.2) are significantly",
    "lower than all other cohorts (p<0.05, Bonferroni-corrected).",
    "",
    "This is consistent with Q3 2025 findings and may reflect the pricing",
    "changes that disproportionately affected this segment.",
    "",
    "Recommend: deep-dive on satisfaction drivers for this cohort in next wave."
  ].join("\n")
}
```

Notes become PPTX speaker notes — visible in presenter view but not on the projected slide. This is where agent-generated insight lives without cluttering the visual presentation.

### 5.5 Auto-Generated Defaults

When agents (or humans) don't specify presentation details, the engine fills in sensible defaults:

**Title generation** (moved from `SlideHeader.tsx` to headless core):
```
rowVars: ["age_group", "gender"], colVar: "income"
→ "Age Group × Gender by Income"

rowVars: ["satisfaction"], colVar: null
→ "Satisfaction"
```

**Subtitle generation:**
```
filters: [Region = "North"], weightVar: "weight_var", rowCount: 1500
→ "Filtered: Region = North · Weighted · N = 1,500"
```

**Chart type recommendation** (existing `chartRecommender.ts`, exposed via engine):
- 1 row var, no col → horizontal bar
- 1 row var, 1 col → grouped bar
- Scale measure → histogram
- Grid → stacked bar or diverging bar
- 2+ categories, small N → table (no chart)

### 5.6 What Agents Can Control Per-Slide

| Property | Agent specifies | Default if omitted |
|---|---|---|
| `rowVars` | Required | — |
| `colVar` | Optional | `null` (frequency table) |
| `filters` | Optional | Engine's current active filters |
| `weightVar` | Optional | Engine's current weight |
| `title` | Optional | Auto-generated from variable labels |
| `subtitle` | Optional | Auto-generated from filters/weight/N |
| `notes` | Optional | Empty (no speaker notes) |
| `visualizationType` | Optional | `'table'` |
| `chartType` | Optional | From `chartRecommender` |
| `showSignificance` | Optional | `true` |
| `showPercents` | Optional | `true` |
| `showCounts` | Optional | `false` |

## 6. MCP Server

The MCP server is a thin transport adapter over VelocityEngine. Each tool maps to one or two engine methods.

### 6.1 Tool Inventory

**Data lifecycle:**

| Tool | Engine method | Description |
|---|---|---|
| `velocity_load` | `loadFile()` | Load a SAV or CSV file |
| `velocity_describe` | `describe()` | Get variable metadata, sets, types, labels |
| `velocity_describe_variable` | `describeVariable()` | Deep dive: frequencies, stats for one variable |
| `velocity_list_analyses` | `listAnalyses()` | Available analysis types + config schemas |

**Analysis:**

| Tool | Engine method | Description |
|---|---|---|
| `velocity_crosstab` | `runAnalysis('crosstab', ...)` | Cross-tabulation with significance |
| `velocity_stats` | `runAnalysis('variableStats', ...)` | Univariate statistics |
| `velocity_sql` | `query()` | Raw SQL escape hatch |
| `velocity_recode` | `recode()` | Create derived variable |
| `velocity_filter` | `addFilter()` | Stage a filter |
| `velocity_clear_filters` | `clearFilters()` | Remove all filters |
| `velocity_set_weight` | `setWeight()` | Set/unset weight variable |

**Deck building:**

| Tool | Engine method | Description |
|---|---|---|
| `velocity_build_deck` | `buildDeck()` | Compose and materialize a full slide deck |
| `velocity_export_deck` | `exportDeck()` | Export materialized deck to PPTX/XLSX |
| `velocity_recommend_chart` | `recommendChart()` | Suggest chart type for given data shape |

**Harmonization:**

| Tool | Engine method | Description |
|---|---|---|
| `velocity_propose_mappings` | `proposeMappings()` | Auto-match variables across waves |
| `velocity_build_harmonized_table` | `buildHarmonizedTable()` | Materialize harmonized dataset |

**Session:**

| Tool | Engine method | Description |
|---|---|---|
| `velocity_export_session` | `exportSession()` | Save complete state to .velocity file |
| `velocity_import_session` | `importSession()` | Restore state from .velocity file |

### 6.2 Example Agent Workflow

An agent asked "Analyze this brand tracking survey and build a deck of key findings":

```
1. velocity_load({ path: "brand_tracker_q2.sav" })
   → { data: { name: "brand_tracker_q2.sav", rowCount: 2400, variableCount: 85 } }

2. velocity_describe()
   → { variables: [...85 vars with labels, types, value labels...],
       variableSets: [...12 sets including grids, multi-response...] }

3. velocity_stats({ column: "overall_satisfaction" })
   → { frequencies: [...], numeric: { mean: 7.2, median: 7, stdDev: 1.8 } }

4. velocity_crosstab({
     rowVars: ["overall_satisfaction"],
     colVar: "age_group",
     weightVar: "weight"
   })
   → { data: { rows: [...], tableStats: { chiSquare: { pValue: 0.003 } } },
       warnings: ["Variable 'age_group' has 2.1% missing values"] }

5. ... (agent runs several more analyses, identifies key findings) ...

6. velocity_build_deck({
     title: "Q2 Brand Tracker: Key Findings",
     sections: [
       { title: "Executive Summary", slides: [
         { rowVars: ["overall_satisfaction"], colVar: "wave",
           title: "Overall Satisfaction Trending Down",
           notes: "Mean satisfaction dropped from 7.8 to 7.2 (p<0.01)...",
           chartType: "grouped-bar" },
       ]},
       { title: "Demographic Breaks", slides: [
         { rowVars: ["overall_satisfaction"], colVar: "age_group",
           title: "25-34 Cohort Drives the Decline",
           notes: "Satisfaction in 25-34 segment fell 1.2 points..." },
         { rowVars: ["purchase_intent"], colVar: "gender",
           title: "Purchase Intent Stable Across Gender",
           notes: "No significant gender differences (p=0.42)..." },
       ]},
     ]
   })
   → BuiltDeck with 3 materialized slides

7. velocity_export_deck({ format: "pptx" })
   → PPTX file (saved to disk)

8. velocity_export_session()
   → .velocity file (human can open in browser to review/refine)
```

## 7. Human-Agent Collaboration

The session file is the collaboration primitive. The workflow:

```
 AGENT                          SESSION FILE                    HUMAN
   │                                │                              │
   │  Explore dataset               │                              │
   │  Run analyses                  │                              │
   │  Build deck (10 slides)        │                              │
   │  Write speaker notes           │                              │
   │                                │                              │
   │──── exportSession() ──────────▶│                              │
   │                                │                              │
   │                                │◀──── open in browser ────────│
   │                                │                              │
   │                                │      Reorder slides          │
   │                                │      Edit titles             │
   │                                │      Swap chart types        │
   │                                │      Adjust filters          │
   │                                │      Add 2 more slides       │
   │                                │                              │
   │◀─── importSession() ──────────│◀──── save session ───────────│
   │                                │                              │
   │  Detect modified slides        │                              │
   │  Regenerate notes for changes  │                              │
   │  Run deeper analysis on        │                              │
   │    areas human flagged         │                              │
   │                                │                              │
   │──── exportDeck(pptx) ─────────▶│──── final review ───────────│
   │                                │                              │
```

The browser's drag-and-drop UX is ideal for the human refinement step. The agent handles tedious exploration and initial assembly. Each plays to their strengths.

## 8. Slide System Gaps (Current → Required)

### 8.1 Must-Fix for Agent Decks

| Gap | Current state | Required change | Location |
|---|---|---|---|
| Subtitle not exported | Silently dropped in PPTX | Pass `subtitle` to pptxgenjs slide | `pptxExporter.ts` |
| No speaker notes | `Slide` type has no `notes` field | Add `notes?: string` to `Slide`, pass to pptxgenjs `addNotes()` | `slides.ts`, `pptxExporter.ts` |
| No section dividers in PPTX | Sections exist in data model, not exported | Generate section-title slides in `exportPptx()` | `pptxExporter.ts` |
| Auto-title lives in UI component | `SlideHeader.tsx` generates titles | Extract to headless `resolveSlideTitle()` in `src/core/export/` | New function |
| Auto-subtitle lives in UI component | Same | Extract to headless `resolveSlideSubtitle()` | New function |
| No batch deck creation | Slides created one-at-a-time via store | `DeckBuilder` in engine builds entire deck from spec | New module |

### 8.2 Should-Fix for Good Agent Decks

| Gap | Required change |
|---|---|
| No chart recommendation exposed | Expose `chartRecommender.ts` via engine method |
| Per-slide branding overrides | Add optional `branding?: Partial<ExportBranding>` to `SlideSpec` |
| Text cells stubbed | Implement `SlideCell` with `type: 'text'` for agent annotations |
| No conditional formatting | Add `highlights?: HighlightRule[]` to `SlideSpec` for "bold cells where p<0.05" |

### 8.3 Future (Exceptional Agent Decks)

| Gap | Required change |
|---|---|
| Multi-cell layouts | Implement grid/comparison `layoutMode` (cells already in type system) |
| Slide templates | Predefined layouts: title, key-finding, comparison, methodology |
| Comparison slides | Side-by-side charts for A/B or wave-over-wave |
| Executive summary generation | Agent-composed text slide summarizing deck findings |

## 9. Browser Convergence

After the engine and MCP server are working, the browser should migrate to consume the engine too. This eliminates divergence between what agents and humans can do.

### 9.1 What Changes

| Current | After convergence |
|---|---|
| Store slices call `worker.postMessage()` directly (27 call sites) | Store slices call `engine.runAnalysis()`, `engine.recode()`, etc. |
| `setTableConfig()` auto-triggers `runAnalysis()` | UI calls `engine.runAnalysis()` explicitly after config changes |
| `App.tsx` orchestrates persistence, worker init, file loading | `VelocityEngine.create()` handles lifecycle; App just renders |
| Slide switching snapshots/restores store state | Slide switching calls `engine.importSession(slide.analysisState)` |
| Export modal calls `runCrosstabForExport()` with worker | Export uses `engine.buildDeck()` / `engine.exportDeck()` |

### 9.2 What Doesn't Change

- React components, CSS, drag-and-drop, virtualization — all stay
- Zustand store still manages UI state (which mode, which modal, selections)
- OPFS persistence strategy stays (engine wraps it)
- The visual experience is unchanged; only the plumbing beneath it shifts

### 9.3 New Capability: Live Agent Mode

Once the browser consumes the engine, an agent connected via MCP could operate the browser in real-time:

- Agent calls `velocity_build_deck()` → slides appear in TimelineDock
- Agent calls `velocity_filter()` → FilterBar updates
- Agent calls `velocity_recode()` → new variable appears in sidebar

The human watches the agent work and can intervene at any point. This is the "pair analyst" experience.

## 10. Implementation Phases

### Phase 1: VelocityEngine + Provenance

**Goal:** Single orchestration layer that CLI and MCP can consume.

1. Extract `VelocityEngine` class in `src/engine/VelocityEngine.ts`
2. Implement `ResultEnvelope` wrapping all engine outputs
3. Implement `describe()`, `runAnalysis()`, `query()`, `recode()`, filter methods
4. Implement `exportSession()` / `importSession()` using existing session module
5. Move auto-title/subtitle generation from `SlideHeader.tsx` to `src/core/export/resolveSlideDefaults.ts`
6. Add `notes?: string` to `Slide` type
7. Fix subtitle and section export in `pptxExporter.ts`
8. Refactor CLI (`cli/velocity.ts`) to use VelocityEngine — validates the API
9. Add REPL mode to CLI (`velocity repl`)

### Phase 2: MCP Server + Deck Builder

**Goal:** AI agents can load data, analyze, build decks, and export via MCP tools.

1. Implement `DeckBuilder` in engine: `buildDeck()`, `exportDeck()`
2. Expose `chartRecommender` via engine method
3. Create `mcp-server/` package using `@modelcontextprotocol/sdk`
4. Map engine methods → MCP tools (per section 6.1)
5. Expose `configSchema` from AnalysisRunners as tool input schemas
6. Add harmonization tools (`proposeMappings`, `buildHarmonizedTable`)
7. Test with Claude Code + real datasets

### Phase 3: Browser Convergence

**Goal:** Browser consumes VelocityEngine; agents and humans share identical capabilities.

1. Replace 27 `worker.postMessage` calls in store slices with engine method calls
2. Separate config mutation from analysis execution in `analysisSlice`
3. Move App.tsx orchestration logic (persistence, file loading, workspace) into engine
4. Implement live agent mode (MCP commands reflected in browser state)
5. Implement multi-cell slide layouts
6. Implement text cells for agent-authored annotations

### Phase 4: Semantic Layer

**Goal:** Agents reason about data in domain terms, not raw column IDs.

1. Enrich `Variable` with semantic annotations (topic, intent, concept family)
2. Add `Concept` entity linking variables across datasets/waves
3. Expose semantic search: "find satisfaction variables" → filtered variable list
4. Enable domain-aware chart/analysis suggestions

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Complexity explosion** (4 consumers on 1 engine) | High | Engine is the only place business logic lives. Consumers are thin transport adapters. Engine test suite covers all logic. |
| **State divergence** (browser vs. engine) | High | Phase 3 eliminates this by making browser consume the engine. Until then, session format is the sync point. |
| **Agent hallucination** (wrong variables, bad interpretations) | Medium | Provenance envelopes make agent work auditable. Session handoff lets humans review before export. Speaker notes are clearly agent-authored. |
| **Maintenance burden** (single developer) | High | Phase priority: Engine → MCP → Browser convergence. Skip HTTP API unless demand appears. |
| **Performance under agent load** (many analyses) | Medium | Engine reuses adapter across operations (no per-invocation file reload). DuckDB is fast for OLAP queries. |
| **PPTX quality gap** | Medium | Tier the deck builder additions. Speaker notes and section dividers first. Multi-cell layouts later. |
| **Trust in survey context** | High | ResultEnvelope provides full provenance. Significance markers and test statistics always included. Agent notes are clearly labeled as machine-generated. |

## 12. File Locations

### Existing (to be consumed by engine)

| Module | Location |
|---|---|
| DatabaseAdapter interface | `src/core/DatabaseAdapter.ts` |
| AnalysisRunner interface | `src/core/analysis/AnalysisRunner.ts` |
| Analysis registry | `src/core/analysis/registry.ts` |
| Crosstab runner | `src/core/analysis/crosstabRunner.ts` |
| Variable stats runner | `src/core/analysis/variableStatsRunner.ts` |
| Query builder | `src/services/queryBuilder.ts` |
| Session exporter | `src/core/session/sessionExporter.ts` |
| Session importer | `src/core/session/sessionImporter.ts` |
| Session types | `src/core/session/sessionTypes.ts` |
| PPTX exporter | `src/core/export/pptxExporter.ts` |
| XLSX exporter | `src/core/export/xlsxExporter.ts` |
| Export types | `src/core/export/types.ts` |
| Chart recommender | `src/services/chartRecommender.ts` |
| Harmonization match engine | `src/core/harmonization/matchEngine.ts` |
| Slide types | `src/types/slides.ts` |
| Node adapter | `src/adapters/DuckDBNodeAdapter.ts` |
| WASM adapter | `src/adapters/DuckDBWasmAdapter.ts` |
| CLI | `cli/velocity.ts` |

### New (to be created)

| Module | Location |
|---|---|
| VelocityEngine | `src/engine/VelocityEngine.ts` |
| ResultEnvelope types | `src/engine/types.ts` |
| DeckBuilder | `src/engine/DeckBuilder.ts` |
| Slide defaults resolver | `src/core/export/resolveSlideDefaults.ts` |
| MCP server entry | `mcp-server/index.ts` |
| MCP tool definitions | `mcp-server/tools.ts` |
