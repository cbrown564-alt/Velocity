# Unified Product Roadmap: Velocity & Aletheia

This document consolidates the visions of **Velocity MVP**, **Velocity Strategic**, and **Project Aletheia** into a single, phased executon plan. It first identifies critical architectural and UX conflicts that must be resolved to ensure the foundation supports all three phases.

## 1. Competing Sub-Goals & Architectural Conflicts

Before sequencing, we must address where the "Simple" (MVP) and "Complex" (Aletheia) visions collide.

### A. Architecture: The "Heavy" vs. "Light" Engine
*   **Conflict:**
    *   **MVP/Strategic** relies primarily on **DuckDB-Wasm** for sub-second aggregations (Crosstabs). It prioritizes instant visual feedback.
    *   **Aletheia** requires **WebR** (full R runtime in browser) for advanced statistics (MLM, Factor Analysis) and **Regl (WebGL)** for rendering millions of points.
*   **Consequence:**
    *   Loading *everything* upfront (DuckDB + WebR + Regl) creates a massive initial bundle size (>30MB+), violating the "instant load" promise of the MVP.
*   **Resolution:**
    *   **Lazy Loading:** The core foundation must be **DuckDB-Wasm only**. The advanced stats engine (WebR or Pyodide) must be implemented as an on-demand "plugin" that only loads when the user enters "Analyst Mode".
    *   **Schema First:** The database schema (Arrow/Parquet) *must* be designed for Aletheia's complexity (handling User Missing values, Weights, and Metadata) from Day 1.

### B. UX: "Notion" vs. "IDE"
*   **Conflict:**
    *   **MVP:** "Don't say Variable, say Question." Hides technical details.
    *   **Aletheia:** "Constructs," "Harmonization," "Syntax Drawer." Effectively an IDE.
*   **Resolution:**
    *   **Progressive Disclosure:** The UI must have "Depth Layers."
        *   *Layer 1 (The View):* Simple drag-and-drop.
        *   *Layer 2 (The Workbench):* Reveal Weights and Grid management.
        *   *Layer 3 (The Lab):* Full IDE view.

### C. UX: Single Screen vs. Modal "Hub-and-Spoke"
*   **Conflict:**
    *   **MVP:** Single-screen immediacy (Sidebar + Canvas).
    *   **Reality:** 500+ variables cause cognitive overload and list management fatigue.
*   **Resolution (driven by `research_08_UX_patterns_for_surveys.md`):**
    *   **Hybrid Hub-and-Spoke Model:** A dedicated **"Variable Manager"** (Gardening Mode) that overlays the **"Analysis Canvas"** (Harvesting Mode).
    *   **Zero-Latency Switching:** Leveraging DuckDB-Wasm to switch modes instantly, preserving flow without the "loading..." penalties of server-side tools.

---

## 2. Shared Goals (The Foundation)

These elements exist in ALL three visions and can be built immediately.

1.  **Local-First Ingestion:** Parsing `.SAV` files in the browser.
    *   *Tech:* ReadStat (WASM) -> Apache Arrow.
2.  **Columnar Storage:** Efficient in-memory database.
    *   *Tech:* DuckDB-Wasm.
3.  **The "Dual-State" Variable:** Handling Value (1) vs. Label ("Male") and Metadata.

---

## 3. Technology Decision Record

### Decision A: The Statistical Engine (Hybrid Plugin Model)
*   **Context:** The user prefers Python (growth/AI), but the domain (Survey Stats) relies heavily on R.
*   **Research Findings:**
    *   **Weighting:** R's `survey` package is the gold standard for complex designs. Python's tools (`quantipy`, `samplics`) are fragmented.
    *   **MLM:** `lme4` (R) outperforms `statsmodels` (Python) for reliability.
    *   **NLP:** Python is superior for future "AI Analyst" features.
*   **Decision:** We will adopt a **Plugin Architecture**.
    *   **Phase 1 & 2:** **DuckDB-Only** (No heavy runtime).
    *   **Phase 3:** **WebR Plugin** for the "Academic" features (Weighting/MLM).
    *   **Phase 4:** **Pyodide Plugin** for "Data Science" features (NLP/AI).
    *   *Rationale:* This prevents overfitting to R while ensuring we don't ship a product that fails on basic market research math.

### Decision B: Microsoft Office Integration
*   **Context:** Can we replicate Displayr's "Editable Chart Export" client-side?
*   **Research Findings:**
    *   **Feasibility:** Yes. The library **PptxGenJS** allows creating `.pptx` files with *native, editable charts* directly in the browser (client-side).
    *   **Method:** It generates compliant OOXML.
*   **Decision:** We will use **PptxGenJS** in Phase 2 to deliver the "Smart Export" feature without needing a server.

---

## 4. Phased Execution Plan

### Phase 1: The "Velocity Core" (Foundational) - COMPLETED
*Goal: A working local-first .SAV viewer that feels faster than anything else.*
*   **Architecture:** ReadStat (Wasm) -> Arrow -> DuckDB-Wasm.
*   **Features:**
    *   Drag-and-drop `.SAV` file.
    *   **"Card" List:** Virtualized list of variables.
    *   **The Canvas:** Drag X and Y to generate a Crosstab.
    *   **Engine:** Supports Metadata (Labels), User Missing Values.
    *   **Reference:** `docs/arch_01_system_architecture.md` (Core Components).

### Phase 2: The "Strategic Workbench" (Commercial Viability) - IN PROGRESS
*Goal: Feature parity with minimal Displayr/SPSS needs via a Hybrid Hub-and-Spoke Architecture.*
*   **Features:**
    *   **The Hub-and-Spoke UI:** **COMPLETED.** (Miller Columns implemented). a distinct high-density mode.
    *   **Navigation Pattern:** **COMPLETED.** **Miller Columns** (Finder-style) for navigating Data Sources > Folders > Sets > Variables.
    *   **Visual ETL:** **COMPLETED.** **Card Sorting** for organization and **Drag-and-Merge** for recoding on the canvas.
    *   **Faceted Search:** **COMPLETED.** Filter variables by type, status, and data quality (missingness).
    *   **Mission Control Design System:** **COMPLETED.** A high-performance, sci-fi inspired UI theme (Electric Cyan/Dark Mode) to differentiate from corporate tools.
    *   **Rich Cards:** **COMPLETED.** Variable lists include sparklines and quality indicators.
    *   **Variable Sets (Grids):** **COMPLETED.** Semantic detection and visual handling of grid questions.
    *   **Significance Testing:** **MVP COMPLETED.** Auto-testing and gap-filling logic implemented.
    *   **Weighting:** **IN PROGRESS.** Engine support added (Milestone 2.2), UI pending.
    *   **Smart Export:** Use **PptxGenJS** to export editable slides.
    *   **Reference:** `docs/research_08_UX_patterns_for_surveys.md` (Detailed UX Specs).

### Phase 3: Engine Convergence & Semantic Layer - COMPLETED
*Goal: Unify all consumers (UI, CLI, MCP) under a single Engine and structure domain data semantics.*
*   **Architecture:** `VelocityEngine` introduced as the unified headless orchestrator. MCP server introduced.
*   **Features:**
    *   **Browser Convergence:** Transition React UI to consume `VelocityEngine` directly.
    *   **Semantic Layer:** Heuristic auto-annotators, concept stores, and token-based search for discovery.
    *   **Deck Builder:** Declarative slide specification and generation via `pptxgenjs` in the Engine layer.
    *   **MCP Server Tools:** Enabling AI language models to interact with the system via standard interface.

### Phase 4: Agent Capability Validation - IN PROGRESS
*Goal: Prove Velocity operates as a highly robust, fully autonomous analytical environment for AI agents.*
*   **Features:**
    *   **Intended-Path Readiness:** Frictionless MCP setup and session round-tripping for Human-AI handoff.
    *   **Eval Portfolios:** Formalized task execution over discovery, narrative deck composition, harmonization, and edge cases.
    *   **Capability Gap Analysis:** Categorization of evaluation failures into rough edges, architectural gaps, and scope issues.
    *   **Reference:** `docs/plan_phase4_agent_capability_validation.md`

### Phase 5: "Project Aletheia" (Advanced/Long Term)
*Goal: The Academic/Longitudinal Environment.*
*   **Features:**
    *   **Harmonization Workspace:** Lasso, Sankey mapping, and wave detection.
    *   **WebR/Runtime Bridge:** Lazy-load R natively for scale features.
    *   **Advanced Models:** `lme4` integration and complex survey weighting raking logic.
    *   **Data Prep Recipes:** Non-destructive "Time Travel" for data cleaning steps.

### Phase 6: The Cognitive Engine (AI-Native)
*Goal: Transform Velocity from an analysis API into an agentic research partner.*
*   **Features:**
    *   **Semantic Reasoning ("The Glass Box"):** Local LLM (WebGPU) or API to intelligently auto-code open-ended text.
    *   **Natural Language Querying:** "Ask your data" interface powered by text-to-state and text-to-SQL workflows.
    *   **The Action Hub:** Secure integration with Linear/Jira to export insights directly to product trackers.

### Phase 7: Realtime Cloud (Backend Extensions)
*Goal: Scale out to multi-user, multi-platform collaborative environments.*
*   **Features:**
    *   **Realtime Collaboration:** Synchronized browser state and shared session storage layers.
    *   **Direct Platform Imports:** Qualtrics/Decipher API integrations.

---

## Immediate Next Steps (Phase 2 Focus)
1.  **Verify Smart Export:** Prototype `PptxGenJS` integration to ensure chart fidelity.
2.  **Polish Chart Interactions:** Finalize "Violin" and "Ridgeline" chart configurations.
3.  **App-wide Polish:** Ensure "Mission Control" theme is consistently applied to all new components.
4.  **Weighting UI:** Build the front-end controls for the implemented Weighting Engine.
