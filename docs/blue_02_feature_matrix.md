# Comprehensive Feature Matrix & Decision Record

This document catalogs every feature proposed across the three source documents (MVP, Strategic, Aletheia), assigns a decision (**Keep / Reject / Delay**) for the Unified Roadmap, and outlines the strategic implications.

## 1. Feature Analysis by Phase

### Phase 1: Velocity Core (The Foundation)
*Goal: Instant, Local-First .SAV Viewer*

| Feature | Source Doc | Decision | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Local-First Ingestion (.SAV)** | MVP | **KEEP** | **Done** | Non-negotiable core capability. |
| **Drag-and-Drop Interface** | MVP | **KEEP** | **Done** | Essential for UX ("Notion logic"). |
| **Instant Crosstabs** | MVP | **KEEP** | **Done** | The primary value prop vs. Displayr/SPSS. |
| **Top 2 Box Toggle (Global)** | MVP | **REJECT** | N/A | **Reasoning:** Too simplistic. Replaced by "Variable Sets/Nets" in Phase 2. A global toggle confuses users when variables have different scales (1-5 vs 1-10). |
| **Export to Image** | MVP | **REJECT** | N/A | **Reasoning:** "Sarah" needs editable charts. Images are dead ends. We focus on HTML/PPTX export. |
| **Undo/Redo (Infinite)** | MVP | **KEEP** | **In Progress** | Critical for trust in a web app. (Partially handled by Zustand) |
| **Searchable Variable List** | MVP | **KEEP** | **Done** | Standard requirement for finding data. |
| **DuckDB-Wasm Engine** | Strategic | **KEEP** | **Done** | The only viable architecture for speed. |

### Phase 2: Strategic Workbench (The Commercial Layer)
*Goal: Displayr Parity for Market Research*

| Feature | Source Doc | Decision | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Weighting (Apply Existing)** | Strategic | **KEEP** | **In Progress** | MVP failure point if missing. Must support reading `S001` weight from file. (Engine Done, UI Pending) |
| **Weighting (Create/Rake)** | Strategic | **DELAY** | N/A | **Reasoning:** Creating weights is complex UI work. Applying existing weights covers 80% of use cases. Delay to Phase 3. |
| **Variable Sets (Grids)** | Strategic | **KEEP** | **Done** | **Reasoning:** Essential for "Grid" questions (Brand Ratings). Without this, the UI is cluttered with 50 separate columns. |
| **Recoding (Bucketing)** | Strategic | **KEEP** | **Done** | Users cannot analyze "Age" without grouping "18-24" etc. (Context Menus implemented) |
| **Significance Testing (Auto)** | MVP | **KEEP** | **Done** | Standard MR requirement. A/B notations. |
| **Confidence Level Toggle** | Strategic | **DELAY** | N/A | **Reasoning:** Defaults (95%) work for now. Add advanced settings later to avoid clutter. |
| **Editable PPTX Export** | N/A (New) | **KEEP** | **Pending** | **Strategic Win:** Using `PptxGenJS` allows us to kill the "Export to Image" feature and match Displayr's killer feature client-side. |
| **Global Filter Bar** | Strategic | **KEEP** | **Done** | Standard UX pattern ("Show me this dashboard for Females"). |
| **Mission Control Theme** | N/A (New) | **KEEP** | **Done** | **Visual Overhaul:** High-contrast "Electric Cyan" theme for professional "Analyst" feel. |

### Phase 3: Project Aletheia (The Academic/Advanced Layer)
*Goal: Longitudinal & Deep Statistics*

| Feature | Source Doc | Decision | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **WebR Integration** | Aletheia | **KEEP** | **Pending** | Required for "Mixed Effects Models" and trusted weighting algorithms. |
| **Mixed Effects Models (MLM)** | Aletheia | **KEEP** | **Pending** | The differentiator for "Correct" WVS analysis. |
| **Visual Harmonization (Sankey)**| Aletheia | **DELAY** | N/A | **Reasoning:** High engineering cost. Useful only for Multi-Wave merging users. Niche. |
| **Time Machine Animation** | Aletheia | **DELAY** | N/A | **Reasoning:** "Wow" factor but not daily utility. Prioritize core stats first. |
| **GPU Scatterplots (Regl)** | Aletheia | **DELAY** | N/A | **Reasoning:** Only needed for N > 500k. Most survey files are N < 50k. DuckDB handles them fine without bespoke WebGL. |
| **Syntax Drawer (R Code)** | Aletheia | **KEEP** | **Pending** | **Reasoning:** Critical for "Trust" and Reproducibility. Even if users don't write code, they trust tools that *can* show it. |
| **Pyodide Plugin (NLP/AI)** | N/A (New) | **DELAY** | N/A | **Reasoning:** Phase 4 goal. Build the "Survey" trust first, then add "AI" innovation. |

---

## 2. Strategic Implications & Risks

### A. The "Simple vs. Correct" Tension
*   **Conflict:** We rejected the "Top 2 Box Toggle" (MVP) because it's statistically dangerous (blindly collapsing 4+5 on every variable).
*   **Implication:** Phase 1 UI will be slightly *less* magical than the MVP PRD promised, but *safer*. Users will have to manually say "Combine 4 and 5" once, then reuse it. This aligns with the "Variable Sets" decision.

### B. The "Export" Pivot
*   **Conflict:** We rejected "Image Export."
*   **Implication:** We are betting heavily on `PptxGenJS`. If this library fails to render complex charts perfectly, "Sarah" will be unhappy.
*   *Mitigation:* We must prototype the PPTX export early in Phase 2 to verify quality.

### C. The "Weighting" Compromise
*   **Conflict:** We Delayed "Creating Weights."
*   **Implication:** Velocity cannot *replace* data processing software (like weighted tables tools) immediately. It is an *Analysis* tool, not a *Processing* tool in Phase 2. Users must bring weighted data. This is an acceptable constraint for the "Strategist" persona.

---

## 3. Revised Roadmap Summary

1.  **Phase 1:** Core Viewer (DuckDB). *Output: HTML Tables.*
2.  **Phase 2:** The Workbench (Grids, Existing Weights, Recoding). *Output: Editable PPTX.*
3.  **Phase 3:** The Lab (WebR, MLM, Syntax). *Output: R Code / Reproducible Science.*
