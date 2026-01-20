# System Architecture

## 1. Overview

Velocity is a **local-first, browser-based** survey data analysis tool. All computation happens client-side using WebAssembly. No data is ever uploaded to a server.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER TAB                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   React UI  │◄──►│ State Store │◄──►│   Analysis Engine   │  │
│  │  (Main Thrd)│    │  (Zustand)  │    │    (Web Worker)     │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                    │             │
│                                        ┌───────────▼──────────┐ │
│                                        │     DuckDB-Wasm      │ │
│                                        │  (Columnar Storage)  │ │
│                                        └───────────▲──────────┘ │
│                                                    │             │
│  ┌─────────────────────────────────────────────────┴───────────┐│
│  │                    Ingestion Layer                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  ││
│  │  │ ReadStat-Wasm│  │ CSV Parser  │  │   Arrow IPC        │  ││
│  │  │   (.sav)    │  │             │  │                     │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               Advanced Stats Plugins (Lazy Load)          │  │
│  │  ┌─────────────┐              ┌─────────────┐             │  │
│  │  │   WebR      │              │  Pyodide    │             │  │
│  │  │ (Phase 3)   │              │  (Phase 4)  │             │  │
│  │  └─────────────┘              └─────────────┘             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1 The Ingestion Layer
*   **Purpose:** Parse proprietary file formats into a universal columnar format.
*   **Tech:** `readstat-wasm` (C compiled to Wasm) for `.sav` files.
*   **Output:** Apache Arrow IPC buffers + JSON metadata sidecar.

### 2.2 The Storage Layer (DuckDB-Wasm)
*   **Purpose:** High-speed analytical queries (GROUP BY, PIVOT).
*   **Interaction:** The UI never queries DuckDB directly. All queries go through the `AnalysisEngine` worker.
*   **Persistence:** Data is stored in `IndexedDB` (via OPFS) for session recovery.

### 2.3 The State Store (Zustand)
*   **Purpose:** Manage UI state (selected variables, active filters, undo history).
*   **Pattern:** Optimistic updates. UI updates instantly; worker confirms.

### 2.4 The Analysis Engine (Web Worker)
*   **Purpose:** Execute DuckDB queries off the main thread to prevent UI freezing.
*   **API:** Message-passing (postMessage/onmessage).

### 2.5 Advanced Stats Plugins (Phase 3+)
*   **WebR:** For `lme4`, `survey` package.
*   **Pyodide:** For NLP (spaCy, scikit-learn).
*   **Loading:** These are **not** bundled. They are fetched on-demand when the user activates "Analyst Mode."

### 2.6 The UX Architecture (Soft Modal)
*   **Concept:** "Hub-and-Spoke".
    *   **Hub:** The **Analysis Canvas** (Low density, Drag-and-Drop, Reading mode).
    *   **Spoke:** The **Variable Manager** (High density, Miller Columns, Writing/Cleaning mode).
*   **Interaction:** 
    *   The Manager overlays the Canvas (Z-index layer) rather than replacing the router view.
    *   **State Persistence:** Because it's a "Soft Modal," the Canvas state (scroll position, active selection) is preserved in DOM/Memory when the Manager is open.
    *   **Context Awareness:** Selecting a variable in the Canvas prompts the Manager to open with that variable pre-selected in the Miller Column.

## 3. Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Store as Zustand Store
    participant Worker as Analysis Worker
    participant DB as DuckDB-Wasm

    User->>UI: Drops .sav file
    UI->>Worker: parse(file)
    Worker->>DB: INSERT INTO dataset
    Worker-->>Store: { variables: [...], rowCount: N }
    Store-->>UI: Re-render Variable List

    User->>UI: Drags "Gender" to Rows
    UI->>Store: setRowVar("Gender")
    Store->>Worker: runCrosstab({ row: "Gender", col: null })
    Worker->>DB: SELECT Gender, COUNT(*) GROUP BY Gender
    DB-->>Worker: Result
    Worker-->>Store: { crosstab: [...] }
    Store-->>UI: Render Table
```

## 4. Key Constraints

| Constraint | Limit | Mitigation |
| :--- | :--- | :--- |
| Browser Memory | ~4GB | Stream large files via OPFS; warn user if file > 500MB. |
| Main Thread Blocking | Any >16ms task | All DuckDB queries run in Web Worker. |
| Bundle Size | <1MB initial | Lazy-load WebR/Pyodide plugins. |
