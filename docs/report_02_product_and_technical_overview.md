# Velocity: The Comprehensive Product & Technical Overview

## 1. Product Vision: The "No-Wait" Research Partner

### 1.1 The "Friday 4 PM" Reality
In the high-stakes world of market research, insights typically move at the speed of a "Data Processing Queue." A researcher (our persona, "Sarah") needs a simple crosstab to answer a client's question ("Did Gen Z like the new ad?"). In the current landscape, she faces two bad choices:
1.  **The Legacy Path (SPSS):** Powerful but hostile. She opens a tool built in the 1990s, navigates "grey menus," and battles proprietary syntax just to merge two columns.
2.  **The Modern Cloud Path (Displayr):** Modern but sluggish. She uploads her sensitive data to the cloud, waits for processing, and then watches a "spinning wheel" every time she applies a filter because the server is calculating the result remotely.

### 1.2 The Velocity Promise
**Velocity** is the "Notion" of statistical analysis—a tool that removes the friction between data and insight. It is built on a single, uncompromising philosophy: **Local-First Speed.**

By moving the entire analytical engine into the user's browser (via WebAssembly), Velocity eliminates network latency. When Sarah drags "Gender" to a table, it updates in <100ms. It feels like a video game, not a database query. Data never leaves her machine, bypassing corporate security reviews and enabling instant "Drop and Play" utility.

### 1.3 Strategic Positioning
Velocity is not a "Data Warehouse" for billions of rows. It is an **Agile Exploration Workbench** for the typical survey dataset (1,000 - 50,000 respondents). It fits seamlessly into the "Gap" between heavy statistics tools and final presentation decks, offering:
*   **Zero-Latency Interactions:** Sub-second feedback implementation.
*   **Security by Design:** No servers, no data leaks.
*   **Smart Exports:** Charts that paste into PowerPoint as *native, editable objects*, not static images.

---

## 2. Technical Codebase Review

To deliver this vision, the Velocity codebase (`/src`) implements a sophisticated, multi-threaded architecture that pushes the boundaries of modern browser capabilities.

### 2.1 Architecture: The "Hybrid" Engine
Velocity solves the problem of parsing complex, binary proprietary files (`.SAV`) in a browser environment through a unique hybrid pipeline:

1.  **The Ingestion Layer (C++ -> WASM)**
    *   **Challenge:** JavaScript is too slow to parse 100MB+ binary SPSS files.
    *   **Solution:** A custom compilation of the **ReadStat** C library to WebAssembly. This component sits in the worker, ingesting `.SAV` files and converting them directly into **Apache Arrow** buffers. This ensures "native-speed" loading while capturing critical metadata like Variable Labels and User Missing Values.

2.  **The Storage Layer (DuckDB-Wasm)**
    *   **Challenge:** We need SQL-power analytics (GROUP BY, Pivot) without server round-trips.
    *   **Solution:** **DuckDB-Wasm** acts as the in-memory analytical engine. It ingests the Arrow buffers "zero-copy," minimizing memory overhead.
    *   **Status:** ✅ Fully integrated. The `analysisWorker.ts` handles the orchestration beautifully, keeping the main thread free for UI rendering.

3.  **The State Layer (Zustand)**
    *   **Challenge:** Managing complex UI state (filters, weights, drag operations) alongside asynchronous worker responses.
    *   **Solution:** A centralized **Zustand** store acts as the "Single Source of Truth." It decouples the React UI from the async complexity of the worker.
    *   **Status:** ✅ Implemented. The `store/index.ts` is robust, though growing large (recommended refactor: slice the store).

### 2.2 Feature Implementation Status

| Feature Category | Vision | Current Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Ingestion** | "Drop any file, instant load" | Supports `.SAV` (via ReadStat) and `.CSV`. Performance is excellent. | 🟢 Ready |
| **Analysis** | "Instant Crosstabs" | `queryBuilder.ts` generates dynamic SQL for counts and percentages. Supports nested rows. | 🟢 Ready |
| **Interaction** | "Tactile Drag & Drop" | `@dnd-kit` implementation for Row/Col shelves is smooth and responsive. | 🟢 Ready |
| **Filtering** | "Global Context" | Global filter bar injects `WHERE` clauses into SQL queries effectively. | 🟢 Ready |
| **Weighting** | "Statistical Validity" | **Gap Identified.** Logic exists in `queryBuilder` but UI controls are missing. Validity is compromised without this. | 🟡 Partial |
| **Significance** | "Auto-Testing" | Placeholders in data structures, but statistical engine (Z-tests) is not yet active. | 🟡 Partial |

### 2.3 Component Audit
The codebase reflects a high standard of modern React development:
*   **`DataTable.tsx`**: A standout component. It handles complex recursive rendering for nested headers and drill-downs without performance hitches.
*   **`VirtualizedVariableList.tsx`**: Critical for performance. It uses `react-window` to ensure that lists of 500+ variables scroll at 60fps.
*   **Theme System**: A polished integration of Tailwind CSS with semantic tokens (colors, typography) ensures the "Research Desk" aesthetic is consistent.

---

## 3. Gap Analysis & Recommendations

### 3.1 The "Validity" Gap
*   **Issue:** The Product Profile emphasizes "Sarah's Trust" in the numbers. Currently, the codebase lacks the UI to apply **Weights** and display **Significance Tests**. Without these, Velocity is a "Data Viewer," not a "Research Tool."
*   **Recommendation:** Prioritize the "Weighting Engine" (Phase 2 of Roadmap) immediately. The backend `queryBuilder` support is there; the UI needs to expose it.

### 3.2 The "Visual" Gap
*   **Issue:** The "Chart View" is currently a placeholder. The vision promises "Editable PowerPoint Exports."
*   **Recommendation:** Integrate **PptxGenJS** to bridge this gap. This is a high-value, low-effort win that drastically improves the "Friday 4 PM" workflow.

### 3.3 Conclusion
Velocity's foundation is rock solid. The architectural gamble—using WASM to process data locally—has paid off, delivering the promised speed. The next sprint must pivot from "Infrastructure" (Ingestion/Table rendering) to "Domain Validity" (Weighting/Sig Testing) to unlock true commercial viability.
