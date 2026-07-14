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
| **Undo/Redo / Recoverable Sessions** | MVP | **KEEP** | **Partial** | Workspace dataset reopen/switch without re-upload shipped (`STAB-WS-1`, May 2026). Session export/import and transform replay remain; full undo/redo stack not complete. |
| **Searchable Variable List** | MVP | **KEEP** | **Done** | Standard requirement for finding data. |
| **DuckDB-Wasm Engine** | Strategic | **KEEP** | **Done** | The only viable architecture for speed. |

### Phase 2: Strategic Workbench (The Commercial Layer)
*Goal: Displayr Parity for Market Research*

| Feature | Source Doc | Decision | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Weighting (Apply Existing)** | Strategic | **KEEP** | **Done** | Existing weights are supported through the crosstab pipeline and should be protected by parity/golden coverage. |
| **Weighting (Create/Rake)** | Strategic | **DELAY** | N/A | **Reasoning:** Creating weights is complex UI work. Applying existing weights covers 80% of use cases. Delay to Phase 3. |
| **Variable Sets (Grids)** | Strategic | **KEEP** | **Done** | **Reasoning:** Essential for "Grid" questions (Brand Ratings). Without this, the UI is cluttered with 50 separate columns. |
| **Recoding (Bucketing)** | Strategic | **KEEP** | **Done** | Users cannot analyze "Age" without grouping "18-24" etc. (Context Menus implemented) |
| **Significance Testing (Auto)** | MVP | **KEEP** | **Done** | Standard MR requirement. A/B notations. |
| **Confidence Level Toggle** | Strategic | **DELAY** | N/A | **Reasoning:** Defaults (95%) work for now. Add advanced settings later to avoid clutter. |
| **Editable PPTX Export** | N/A (New) | **KEEP** | **Done / Review Lane Open** | `PptxGenJS` export is implemented and tested. The approved frontend review-before-download experience and final visual verification remain redesign-convergence work. |
| **Global Filter Bar** | Strategic | **KEEP** | **Done** | Standard UX pattern ("Show me this dashboard for Females"). |
| **Mission Control Theme** | N/A (New) | **KEEP** | **Done** | **Visual Overhaul:** High-contrast "Electric Cyan" theme for professional "Analyst" feel. |

### Deferred Advanced Layer
*Goal: longitudinal and deep statistics after pilot validation*

| Feature | Source Doc | Decision | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **WebR Integration** | Aletheia | **Removed (gated re-entry)** | N/A | Excised Plan 06 Phase 1. Re-enters as lazy plugin at `arch_01` §2.5 seam when `PILOT-7` validates demand. Weighted crosstabs run through DuckDB SQL today. |
| **Mixed Effects Models (MLM)** | Aletheia | **Removed (gated re-entry)** | N/A | `MixedEffectsRunner` removed with WebR cluster. Same PILOT-7 plugin seam. |
| **Visual Harmonization (Sankey)**| Aletheia | **Removed (gated re-entry)** | N/A | Harmonization workspace excised Plan 06 Phase 1 (`~2,915` lines). Wave refresh uses in-wave recodes + deck recipe, not cross-wave harmonization. Eval artifacts frozen under `evals/eval-05/`. |
| **Time Machine Animation** | Aletheia | **DELAY** | N/A | **Reasoning:** "Wow" factor but not daily utility. Prioritize core stats first. |
| **GPU Scatterplots (Regl)** | Aletheia | **DELAY** | N/A | **Reasoning:** Only needed for N > 500k. Most survey files are N < 50k. DuckDB handles them fine without bespoke WebGL. |
| **Syntax Drawer (R Code)** | Aletheia | **Removed (gated re-entry)** | N/A | Monaco R editor removed Plan 06 Phase 1. Trust-pack methodology snapshots preserved in docs; live R execution re-enters via WebR plugin seam only. |
| **Pyodide Plugin (NLP/AI)** | N/A (New) | **DELAY** | N/A | **Reasoning:** Build the survey/deck trust first, then add AI only where bounded agent outcomes prove time savings without trust failures. |

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
*   **Implication:** Velocity cannot *replace* data processing software (like weighted tables tools) immediately. It is an *Analysis* tool, not a full *Processing* tool in the pilot. Users may need to bring weighted data unless `PILOT-4a` shows that minimum viable weighting/processing is a repeated adoption blocker.

---

## 3. Revised Roadmap Summary

1.  **Phase 1:** Core Viewer (DuckDB). *Status: complete.*
2.  **Phase 2:** Strategic Workbench (grids, existing weights, recoding, editable PPTX). *Status: engine/export foundation complete; frontend review and saved-analysis fidelity are active design-convergence work.*
3.  **Phase 3:** Engine/MCP/Semantic foundation. *Status: complete.*
4.  **Phase 4:** Agent capability validation and follow-through. *Status: complete; completed details live in `completed_foundations_summary.md`.*
5.  **Current design convergence:** reconcile approved redesign candidates, complete the export review and saved-analysis loop, close interaction/accessibility/visual gaps, and pass representative validation.
6.  **Market-reset pilot:** after the redesign gate passes, prioritize SAV-to-deck trust/performance evidence, minimum viable processing only where pilots block, bounded agent outcomes, and paid-pilot validation before WebR/AI/cloud expansion.
