# AI Agents as First-Class Consumers: Architectural Evaluation

**Date:** 2026-03-09
**Scope:** Full codebase analysis of Velocity from the perspective of making AI agents co-equal or primary consumers of the application.

---

## Executive Summary

Velocity is **surprisingly well-positioned** for an AI-agent pivot, but not because the current app was designed for it — rather, because several recent architectural decisions (the headless core extraction, DatabaseAdapter interface, CLI, analysis registry, and session file format) have accidentally created most of the scaffolding that agent consumption requires. The gap is real but bridgeable: **the primitives exist, but the orchestration layer that agents need does not.**

The core finding: Velocity currently has two clean interfaces (DatabaseAdapter + AnalysisRunner) and one serialization format (VelocitySessionFile) that together cover ~70% of what an AI agent would need. The missing 30% — a stateless request/response API, structured output schemas, introspection endpoints, and an intent-level command vocabulary — is where the architectural work lies.

---

## 1. Current State: How Would an AI Agent Use Velocity Today?

### 1.1 The CLI Path (Best Available)

The CLI (`cli/velocity.ts`) is the closest thing to an agent-usable interface today. An AI agent with shell access (like Claude Code, Cursor, or an MCP tool-use agent) could:

```bash
# Load and inspect data
npx tsx cli/velocity.ts load data.sav
npx tsx cli/velocity.ts schema data.sav

# Run crosstab analysis
npx tsx cli/velocity.ts query data.sav --rows Gender,AgeGroup --cols Region --format json

# Get variable statistics
npx tsx cli/velocity.ts stats data.sav Income --type numeric --bins 20

# Run arbitrary SQL
npx tsx cli/velocity.ts sql data.sav "SELECT Gender, COUNT(*) FROM main GROUP BY Gender"

# Export to PowerPoint
npx tsx cli/velocity.ts export data.sav --rows Gender --cols Region --format pptx --output report.pptx

# Run any registered analysis plugin
npx tsx cli/velocity.ts analyze data.sav crosstab --config '{"rowVars":["Q1"],"colVar":"Gender"}'
```

**What works:**
- JSON output format is machine-parseable
- Covers the core analysis loop: load → inspect → analyze → export
- Uses the same headless core as the browser, so results are identical
- SAV support is present (via `DuckDBNodeAdapter.loadSav`)
- Plugin system (`analyze` command + `analysisRegistry`) is extensible

**What doesn't work:**
- **Stateless per-invocation**: Each command creates a new DuckDB instance, loads the file from scratch, runs the query, and closes. No session persistence between commands. A multi-step analysis workflow re-parses the file every time.
- **No variable discovery**: An agent can't ask "what variables are available and what do they mean?" in a structured way. `schema` returns DuckDB column types, not Velocity's rich variable metadata (labels, value labels, types, missing values).
- **No session management**: Can't save/restore analysis state, slides, or filter configurations.
- **No streaming for large results**: Output is buffered to stdout.
- **Error messages are human-readable, not structured**: Failures produce console.error strings, not JSON error objects with codes.

### 1.2 The Browser Path (Not Agent-Friendly)

An AI agent controlling the browser (via Playwright, Puppeteer, or computer-use) would face:
- 2,485-line App.tsx monolith with complex initialization sequences
- Drag-and-drop as the primary interaction paradigm (hostile to programmatic control)
- No URL-based deep linking to analysis states
- No keyboard-shortcut-complete workflow
- Modal dialogs for most operations (recode, filter, export)

### 1.3 The Programmatic Store Path (Theoretically Possible)

An agent running in the same JS context could call Zustand actions directly:

```typescript
const store = useVelocityStore.getState();
await store.initWorker();
await store.loadSAV('file.sav', buffer);
store.setTableConfig({ rowVars: ['Gender'], colVar: 'AgeGroup' });
// ... wait for async worker response
const result = store.queryResult;
```

**Problems:**
- Worker communication is async with event-based responses — no promise-based API
- Race conditions: 27 `worker.postMessage` calls in store slices, responses identified by `type` string with optional `requestId`
- State mutations are side-effectful (e.g., `setTableConfig` auto-triggers `runAnalysis`)
- No way to wait for completion without subscribing to store changes

---

## 2. What the Architecture Already Provides

### 2.1 DatabaseAdapter — The Critical Abstraction

```typescript
interface DatabaseAdapter {
  query(sql: string): Promise<QueryResult>;
  queryStream?(sql: string, options?: StreamOptions): AsyncIterable<QueryResult>;
  execute(sql: string): Promise<void>;
  insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void>;
  getTableNames(): Promise<string[]>;
  close(): Promise<void>;
}
```

This interface is **the single most valuable piece for agent consumption**. It:
- Decouples from browser/WASM runtime (two implementations: Wasm + Node)
- Returns structured `QueryResult` objects (`{ columns, rows, rowCount }`)
- Supports streaming via `queryStream`
- Is the injection point for all analysis runners

### 2.2 AnalysisRunner + Registry — Plugin Architecture

```typescript
interface AnalysisRunner<TConfig, TResult> {
  readonly id: string;
  readonly label: string;
  readonly configSchema: Record<string, unknown>;
  run(adapter: DatabaseAdapter, config: TConfig): Promise<TResult>;
  validate?(config: TConfig): string[];
}
```

This is **almost exactly what an AI agent tool-use interface needs**:
- Typed config with JSON schema for validation
- Self-describing (id, label, configSchema)
- Promise-based execution
- Validation before execution

Currently registered runners: `crosstab`, `variableStats`, `mixedEffects`, `surveyWeighting`.

### 2.3 Session File Format — State Serialization

The `VelocitySessionFile` type captures the complete analysis state:

```typescript
interface VelocitySessionFile {
  formatVersion: number;
  dataset: SessionDatasetDescriptor;
  variables: Variable[];
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: TableConfig;
  activeFilters: Filter[];
  analysisSettings: AnalysisSettings;
  slides: Slide[];
  sections: SlideSection[];
  workspace?: SessionWorkspaceSnapshot;
}
```

This is a **complete checkpoint of analysis state** that could serve as:
- Agent working memory (save/restore between invocations)
- Handoff format (agent prepares analysis, human reviews in browser)
- Audit trail (every agent action produces a new session snapshot)

### 2.4 Headless Core Functions — Pure and Testable

Key pure functions an agent could consume:
- `runCrosstab(adapter, options, context)` — crosstab analysis
- `getVariableStats(adapter, column, type, missingValues, bins)` — variable statistics
- `processMetadata(parsedSav)` — SAV metadata extraction
- `buildCrosstabQuery(options)` — SQL generation
- `processAnalysisData(data)` — raw rows → structured cells
- `exportPptx(config)` / `exportXlsx(config)` — report generation
- `exportSession(input)` / `importSession(json)` — state serialization

### 2.5 Rich Type System

The type system in `src/types/index.ts` provides:
- `Variable` with `id`, `name`, `label`, `type`, `valueLabels`, `missingValues`
- `VariableSet` with grouping semantics (grid, multipleResponse, explicitSet)
- `Filter` with SQL-based predicate model
- `RecodeConfig` for variable transformations
- `Slide` for saved analysis views

These types are **already the vocabulary an AI agent would need** to express analysis intent.

---

## 3. What's Missing: The Agent Gap

### 3.1 No Persistent Session in CLI

**The biggest gap.** Every CLI invocation is stateless. An agent doing iterative analysis (load → explore → filter → analyze → refine → export) pays the full file-parsing cost on every command. For a 200MB SAV file, this is prohibitive.

**What's needed:** A long-running server or REPL mode where the adapter stays alive across commands.

### 3.2 No Variable Metadata in CLI Output

The CLI's `schema` command returns DuckDB column types (`VARCHAR`, `DOUBLE`), not Velocity's semantic metadata. An agent can't discover:
- Human-readable variable labels ("What is your household income?")
- Value label mappings (1 = "Male", 2 = "Female")
- Variable types (nominal vs. ordinal vs. scale)
- Variable set groupings (grid questions, multi-response sets)
- Missing value definitions

**What's needed:** A `describe` command that returns the full `Variable[]` and `VariableSet[]` arrays.

### 3.3 No Structured Error Protocol

Current errors are console.error strings. An agent needs:
```json
{ "error": true, "code": "INVALID_VARIABLE", "message": "Variable 'Q99' not found", "available": ["Q1", "Q2", ...] }
```

### 3.4 No Introspection / Discovery API

An agent can't ask:
- "What analyses are available?" (partially: `analysisRegistry.list()` exists but isn't exposed via CLI)
- "What configuration does this analysis need?" (configSchema exists on runners but isn't surfaced)
- "What filters are valid for this variable?"
- "What's the current state of the analysis?"

### 3.5 No Intent-Level Commands

Current CLI commands are low-level ("run this SQL", "run this crosstab with these exact variable IDs"). An agent working at a higher level would want:
- "Find all demographic variables"
- "Compare income across gender"
- "Show me outliers in variable X"
- "What's driving the difference between groups A and B?"

These are the kinds of commands that make an AI agent genuinely useful, rather than just a shell-script wrapper.

### 3.6 No Streaming / Progress Protocol

Long-running operations (large file loads, complex crosstabs) produce no intermediate output. The browser worker has a `loadProgress` message type, but the CLI has nothing equivalent.

### 3.7 No Multi-Dataset Orchestration

The workspace/longitudinal features (multi-file projects, wave linking, harmonization) are entirely browser-side. An agent can't work across multiple datasets.

---

## 4. Proposed Architecture: Agent-First Velocity

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   CONSUMERS                              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Browser  │  │   CLI    │  │MCP Server│  │HTTP API│  │
│  │  (React) │  │(terminal)│  │(tool-use)│  │  (REST)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │              │             │       │
│  ┌────▼──────────────▼──────────────▼─────────────▼────┐ │
│  │              VelocityEngine (new)                    │ │
│  │  ┌──────────────────────────────────────────────┐   │ │
│  │  │  Session Manager (stateful, multi-dataset)   │   │ │
│  │  │  - load/unload datasets                      │   │ │
│  │  │  - manage analysis state                     │   │ │
│  │  │  - save/restore sessions                     │   │ │
│  │  │  - apply transforms                          │   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  │  ┌──────────────────────────────────────────────┐   │ │
│  │  │  Analysis Registry (plugin system)           │   │ │
│  │  │  - crosstab, variableStats, regression, ...  │   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  │  ┌──────────────────────────────────────────────┐   │ │
│  │  │  Export Pipeline                             │   │ │
│  │  │  - PPTX, XLSX, session files, Arrow          │   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  └─────────────────────┬───────────────────────────────┘ │
│                        │                                  │
│  ┌─────────────────────▼───────────────────────────────┐ │
│  │              DatabaseAdapter                         │ │
│  │  (DuckDBWasmAdapter | DuckDBNodeAdapter)             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              src/core/ (pure functions)              │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 4.2 The VelocityEngine Class

The key missing piece is a **stateful orchestration layer** that sits between consumers and the headless core:

```typescript
class VelocityEngine {
  private adapter: DatabaseAdapter;
  private session: VelocitySession; // variables, sets, filters, transforms, slides

  // Lifecycle
  static async create(options?: { runtime: 'node' | 'wasm' }): Promise<VelocityEngine>;
  async loadFile(path: string): Promise<DatasetSummary>;
  async loadBuffer(name: string, buffer: ArrayBuffer, format: 'sav' | 'csv'): Promise<DatasetSummary>;
  async close(): Promise<void>;

  // Introspection
  describe(): DatasetDescription;           // Full variable metadata, sets, folders
  describeVariable(id: string): VariableDetail;  // Deep dive on one variable
  listAnalyses(): AnalysisDescriptor[];     // Available analysis types + config schemas
  getSession(): VelocitySessionFile;        // Full state snapshot

  // Analysis
  async runAnalysis(id: string, config: unknown): Promise<AnalysisResult>;
  async query(sql: string): Promise<QueryResult>;

  // Transforms
  async recode(sourceVar: string, config: RecodeConfig): Promise<Variable>;
  async filter(predicate: FilterSpec): void;
  async clearFilters(): void;
  async setWeight(variableId: string | null): void;

  // Export
  async exportPptx(config: ExportConfig): Promise<Uint8Array>;
  async exportXlsx(config: ExportConfig): Promise<Uint8Array>;
  async exportSession(): Promise<VelocitySessionFile>;
  async importSession(session: VelocitySessionFile): Promise<void>;
}
```

### 4.3 MCP Server (Model Context Protocol)

The highest-leverage integration for AI agents. An MCP server would expose Velocity as a set of tools that any MCP-compatible AI (Claude, GPT, etc.) can call directly:

```typescript
// Tool definitions (MCP format)
tools: [
  {
    name: "velocity_load_dataset",
    description: "Load a SAV or CSV file into the analysis engine",
    inputSchema: { type: "object", properties: { path: { type: "string" } } }
  },
  {
    name: "velocity_describe",
    description: "Get full variable metadata for the loaded dataset",
    inputSchema: { /* optional variable filter */ }
  },
  {
    name: "velocity_crosstab",
    description: "Run a crosstab analysis with row/column variables",
    inputSchema: {
      type: "object",
      properties: {
        rowVars: { type: "array", items: { type: "string" } },
        colVar: { type: "string" },
        weightVar: { type: "string" },
        filters: { type: "array" }
      }
    }
  },
  {
    name: "velocity_variable_stats",
    description: "Get frequency distribution and numeric statistics for a variable",
    inputSchema: { /* column, type, bins */ }
  },
  {
    name: "velocity_sql",
    description: "Run arbitrary SQL against the dataset",
    inputSchema: { type: "object", properties: { sql: { type: "string" } } }
  },
  {
    name: "velocity_recode",
    description: "Create a new variable by recoding values of an existing one",
    inputSchema: { /* RecodeConfig schema */ }
  },
  {
    name: "velocity_export",
    description: "Export current analysis to PowerPoint or Excel",
    inputSchema: { /* format, title, config */ }
  }
]
```

**Why MCP is the right abstraction:**
- Tool-use is the native interaction pattern for AI agents
- MCP is becoming the standard protocol (Claude, OpenAI, open-source agents all support it)
- Each tool maps 1:1 to a VelocityEngine method
- The engine's statefulness maps naturally to MCP's session model
- configSchema on AnalysisRunner can be directly exposed as tool inputSchema

### 4.4 HTTP/REST API (Optional, for Remote Agents)

For agents that can't run local processes (web-based agents, cloud orchestrators):

```
POST   /api/sessions                    → Create session, load file
GET    /api/sessions/:id/describe       → Variable metadata
POST   /api/sessions/:id/analyze        → Run analysis
POST   /api/sessions/:id/query          → SQL query
POST   /api/sessions/:id/recode         → Variable transform
POST   /api/sessions/:id/export         → Generate report
GET    /api/sessions/:id                → Session state snapshot
DELETE /api/sessions/:id                → Close session
```

This would be a thin wrapper over VelocityEngine, adding session management and file upload handling. Given the local-first philosophy, this would be optional and explicitly opt-in.

---

## 5. What This Enables

### 5.1 AI-Driven Exploratory Analysis

An agent could autonomously:
1. Load a dataset
2. Examine variable metadata to understand the survey structure
3. Identify interesting crosstab combinations based on variable types and labels
4. Run analyses, interpret significance markers
5. Generate a slide deck of key findings
6. Export to PowerPoint

This is the "analyst copilot" use case — the agent does the repetitive exploration, the human reviews and refines.

### 5.2 Natural Language → Analysis

With the MCP server, a user could say:
> "Compare satisfaction ratings across age groups, controlling for gender"

The AI agent would:
1. Call `velocity_describe` to find relevant variables
2. Map "satisfaction ratings" → scale variable(s), "age groups" → demographic nominal, "gender" → demographic nominal
3. Call `velocity_crosstab` with appropriate rowVars/colVar
4. Interpret significance markers in the result
5. Summarize findings in natural language

### 5.3 Batch Processing / Report Automation

An agent or script could process dozens of files:
```bash
for file in surveys/*.sav; do
  velocity analyze "$file" crosstab --config '...' --format json >> results.jsonl
done
```

With the persistent engine, this becomes efficient (load once, analyze many ways).

### 5.4 Quality Assurance / Data Validation

An agent could scan a dataset for:
- Variables with >50% missing values
- Value labels that don't match actual data
- Suspicious distributions (all same value, extreme outliers)
- Grid questions with inconsistent response patterns

### 5.5 Longitudinal Analysis Orchestration

The workspace/harmonization features become powerful when an agent can:
1. Load multiple waves of a survey
2. Detect common variables across waves
3. Build a harmonized table
4. Run trend analyses
5. Flag significant changes between waves

### 5.6 Human-Agent Collaboration Loop

The session file format enables a powerful workflow:
1. **Agent** loads data, runs exploratory analysis, saves session with slides
2. **Human** opens session in browser, reviews findings, adjusts filters/recodes
3. **Agent** picks up modified session, runs deeper analysis on areas human flagged
4. **Human** reviews final deck, exports to stakeholders

The `.velocity` session file becomes the shared working document.

---

## 6. Negative Consequences and Risks

### 6.1 Complexity Explosion

Adding four consumer interfaces (Browser, CLI, MCP, HTTP) to one engine means:
- Every core change must be validated across all four
- Error handling must work for visual (toast), terminal (stderr), structured (JSON), and streaming (SSE) contexts
- Testing surface area multiplies

**Mitigation:** VelocityEngine as the single orchestration point. All consumers are thin adapters over the same engine. The engine's test suite covers all business logic; consumer tests only verify serialization/transport.

### 6.2 Security Surface

Current Velocity has zero attack surface — everything is local, no network, no server. Adding API/MCP endpoints introduces:
- **Arbitrary SQL execution** via the `sql` command — SQL injection isn't a concern (agent controls both sides), but resource exhaustion is (unbounded queries on large datasets)
- **File system access** — agent could load any file the process can read
- **Denial of service** — complex analyses on huge datasets could exhaust memory

**Mitigation:**
- Resource limits (query timeout, result size caps)
- Sandboxed file access (only read from specified directories)
- Memory budgets per session

### 6.3 State Management Complexity

The browser app uses Zustand with localStorage persistence. The engine needs its own state management that doesn't depend on React or browser APIs. This means:
- Duplicating some state management logic
- Keeping browser and engine session formats in sync
- Risk of divergence between browser behavior and engine behavior

**Mitigation:** The browser should eventually consume VelocityEngine too, replacing direct worker communication with engine method calls. This is a major refactor but eliminates the divergence risk entirely.

### 6.4 Loss of "Local-First" Purity

If Velocity becomes an API server, data leaves the browser. This contradicts the core privacy promise.

**Mitigation:**
- MCP server runs locally (same machine as the agent)
- HTTP API is explicitly opt-in, documented as "for advanced/trusted use"
- Browser mode remains the default, with no server dependency
- Clear messaging: "Your data stays on your machine. The API runs on your machine."

### 6.5 Agent Reliability / Hallucination Risk

AI agents can:
- Misinterpret variable labels and run meaningless analyses
- Confuse correlation with causation in their interpretations
- Generate misleading slide titles/summaries
- Apply inappropriate statistical tests

**Mitigation:**
- Velocity provides the computation; interpretation guardrails live in the agent's system prompt
- Analysis results include significance markers, confidence intervals, and test statistics — the raw numbers are always available for human review
- Session files preserve the complete audit trail

### 6.6 Maintenance Burden

The CLI + MCP server + HTTP API represent significant new code to maintain. For a single-developer project, this is a real concern.

**Mitigation:** Prioritize ruthlessly:
1. **VelocityEngine** (required foundation, benefits all consumers)
2. **MCP server** (highest leverage — one implementation serves all MCP-compatible AIs)
3. **CLI improvements** (incremental, already exists)
4. **HTTP API** (only if there's demand from web-based agents)

### 6.7 User Experience Dilution

If agent workflows become primary, the browser UI risks becoming a "viewer" rather than a creative tool. The drag-and-drop, visual exploration aspects — which are Velocity's UX differentiators — could atrophy.

**Mitigation:** Frame the relationship correctly:
- Browser = creative exploration, visual storytelling, presentation
- Agent = automation, batch processing, initial exploration
- Session file = bridge between the two

The browser is where you *refine* analysis. The agent is where you *start* it.

---

## 7. Implementation Roadmap

### Phase A: Foundation (VelocityEngine)

**Effort: Medium | Impact: Critical**

1. Extract `VelocityEngine` class wrapping `DatabaseAdapter` + `AnalysisRegistry` + session state
2. Implement `describe()` returning full variable metadata
3. Implement `runAnalysis()` delegating to registry
4. Implement session save/restore using existing `sessionExporter`/`sessionImporter`
5. Refactor CLI to use VelocityEngine (validates the API surface)
6. Add persistent REPL mode to CLI (`velocity repl`)

### Phase B: MCP Server

**Effort: Medium | Impact: Highest**

1. Create `mcp-server/` package using `@modelcontextprotocol/sdk`
2. Map VelocityEngine methods → MCP tools
3. Expose `configSchema` from AnalysisRunners as tool input schemas
4. Add MCP resources for session state introspection
5. Test with Claude Desktop / Claude Code

### Phase C: Enhanced Agent Experience

**Effort: Low-Medium | Impact: High**

1. Add `velocity_suggest_analyses` tool — given a dataset, suggest meaningful crosstabs
2. Add `velocity_interpret` tool — given analysis results, provide statistical interpretation scaffolding
3. Add structured error responses with remediation hints
4. Add progress streaming for long operations
5. Add multi-dataset session support

### Phase D: Browser Convergence

**Effort: High | Impact: Long-term**

1. Refactor browser to use VelocityEngine instead of direct worker communication
2. Replace 27 worker.postMessage calls in store slices with engine method calls
3. Eliminate state divergence between browser and CLI/MCP
4. Enable "agent mode" in browser — agent commands reflected in real-time UI

---

## 8. Key Metrics

### Current Agent-Readiness Score

| Dimension | Score | Notes |
|:----------|:------|:------|
| Headless core exists | 9/10 | DatabaseAdapter + runners are clean |
| CLI exists | 7/10 | Works but stateless, missing metadata |
| Structured output | 5/10 | JSON output but no schema, no error codes |
| Introspection | 3/10 | Can't discover variables/analyses programmatically |
| State management | 4/10 | Session format exists but not usable from CLI |
| Multi-dataset | 1/10 | Workspace features are browser-only |
| Plugin extensibility | 8/10 | AnalysisRunner + Registry is nearly ideal |
| Documentation for agents | 2/10 | Docs are human-focused, no API reference |
| **Overall** | **4.9/10** | **Primitives are strong, orchestration is missing** |

### Target Score After Phase B

| Dimension | Score | Notes |
|:----------|:------|:------|
| Headless core | 9/10 | Unchanged |
| CLI | 9/10 | Persistent sessions, full metadata |
| Structured output | 9/10 | JSON schemas, error codes, streaming |
| Introspection | 9/10 | Full describe/discovery via MCP |
| State management | 8/10 | Session save/restore, multi-step workflows |
| Multi-dataset | 5/10 | Basic support via engine |
| Plugin extensibility | 9/10 | configSchema exposed via MCP |
| Documentation for agents | 7/10 | Auto-generated from schemas |
| **Overall** | **8.1/10** | |

---

## 9. Conclusion

The pivot to AI-agent-first is not a rewrite — it's an **extraction and exposure** of capabilities that already exist in the headless core. The DatabaseAdapter/AnalysisRunner architecture was designed for exactly this kind of multi-consumer scenario, even if the original motivation was CLI support rather than AI agents.

The critical insight is that **VelocityEngine is the missing keystone**. Without it, every consumer (browser, CLI, MCP, HTTP) must independently manage sessions, coordinate with the database adapter, and handle the analysis lifecycle. With it, each consumer becomes a thin transport adapter, and the engine handles all orchestration.

The MCP server is the highest-leverage deliverable. One implementation makes Velocity a tool in any MCP-compatible AI agent's toolkit — Claude, GPT, open-source agents, custom pipelines. Combined with the session file format (for human-agent handoff) and the analysis registry (for extensibility), this positions Velocity as the **statistical engine that AI agents use to do quantitative research**.

The risk is real but manageable: complexity growth, security surface, maintenance burden. The mitigation strategy — VelocityEngine as single source of truth, phased rollout, browser convergence as the long-term goal — keeps the project tractable for a single developer while unlocking transformative capability.
