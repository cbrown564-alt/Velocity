# System Architecture

## 1. Overview

Velocity is a **local-first** survey data analysis platform. While it began as a browser-first application, its architecture has evolved into an **API-first engine** capable of supporting human users (via the React UI) and autonomous AI agents (via the MCP Server and CLI) simultaneously.

All computation happens locally using WebAssembly or native Node extensions. No data is ever uploaded to a server.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONSUMER LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ BROWSER (UI)│    │ CLI (Term)  │    │ MCP SERVER (Agents) │  │
│  │   React     │    │   Node.js   │    │      Tool Use       │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                      │             │
│         │        ┌─────────▼─────────────┐        │             │
│         └───────►│    VelocityEngine     │◄───────┘             │
│                  │ (Stateful Orchestrator)│                     │
│                  └─────────┬─────────────┘                      │
│                            │                                    │
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │                     DatabaseAdapter                       │  │
│  │      DuckDBWasmAdapter     |     DuckDBNodeAdapter        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               Headless Core (Pure Functions)              │  │
│  │   Ingestion (ReadStat) | Analysis Runners | Export (PPTX) │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                          │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │               Advanced Stats Plugins (Lazy Load)          │  │
│  │  ┌─────────────┐              ┌─────────────┐             │  │
│  │  │   WebR      │              │  Pyodide    │             │  │
│  │  │ (Phase 3)   │              │  (Phase 4)  │             │  │
│  │  └─────────────┘              └─────────────┘             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1 VelocityEngine (The Orchestrator)
*   **Purpose:** The single, stateful orchestration layer that unifies all capability access. It owns the database adapter, current session state (metadata, variables), and analysis lifecycle.
*   **Consumers:** The React app (via `src/services/analysisWorker.ts`), the CLI, and the MCP Server.
*   **Reference:** See `docs/arch_07_agent_architecture.md` for strict Agent engine boundaries.

### 2.2 The Ingestion Layer
*   **Purpose:** Parse proprietary file formats into a universal columnar format.
*   **Tech:** `readstat-wasm` (C compiled to Wasm) for `.sav` files.
*   **Output:** Apache Arrow IPC buffers + JSON metadata sidecar.

### 2.3 The Storage Layer (DuckDB / DatabaseAdapter)
*   **Purpose:** High-speed analytical queries (GROUP BY, PIVOT).
*   **Interface:** `DatabaseAdapter` abstracts DuckDB execution, enabling both browser (`DuckDBWasmAdapter`) and Node (`DuckDBNodeAdapter`) environments to query identically.
*   **Retrieval:** The UI *never* queries DuckDB directly. All queries pass through the `VelocityEngine`.

### 2.4 The State Store (Zustand - Browser Only)
*   **Purpose:** Manage UI view state (active tabs, modal visibility, current component states).
*   **Future Convergence:** With the shift to `VelocityEngine`, the Zustand store is migrating away from holding domain/analysis state towards purely holding UI presentation state.

### 2.5 Advanced Stats Plugins (Phase 3+)
*   **WebR:** For `lme4`, `survey` package.
*   **Pyodide:** For NLP (spaCy, scikit-learn).
*   **Loading:** These are **not** bundled. They are fetched on-demand when the user executes operations requiring advanced mathematical modeling.

### 2.6 The UX Architecture (Soft Modal)
*   **Concept:** "Hub-and-Spoke".
    *   **Hub:** The **Analysis Canvas** (Low density, Drag-and-Drop, Reading mode, Slide creation).
    *   **Spoke:** The **Variable Manager** (High density, Miller Columns, Writing/Cleaning/Semantic tagging).
*   **Interaction:** 
    *   The Manager overlays the Canvas (Z-index layer) rather than replacing the router view, providing zero-latency switching.

## 3. Data Flow (Browser Example)

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Engine as VelocityEngine (Worker)
    participant Core as src/core (Pure Logic)
    participant DB as DuckDB (WASM)

    User->>UI: Drops .sav file
    UI->>Engine: loadFile(file)
    Engine->>Core: processMetadata()
    Engine->>DB: INSERT INTO dataset
    Engine-->>UI: ResultEnvelope { data: DatasetSummary }

    User->>UI: Create Crosstab (Gender x Age)
    UI->>Engine: runAnalysis('crosstab', { rowVars: ['Gender'], colVar: 'Age' })
    Engine->>Core: buildCrosstabQuery()
    Engine->>DB: execute()
    DB-->>Engine: QueryResult
    Engine->>Core: formatAnalysisResult()
    Engine-->>UI: ResultEnvelope { data: AnalysisResult }
```

## 4. Key Constraints

| Constraint | Limit | Mitigation |
| :--- | :--- | :--- |
| Browser Memory | ~4GB | Stream large files via OPFS; warn user if file > 500MB. |
| Main Thread Blocking | Any >16ms task | All DuckDB queries run in Web Worker. |
| Bundle Size | <1MB initial | Lazy-load WebR/Pyodide plugins. |
