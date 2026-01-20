# Evaluation: UX Patterns for Surveys vs. Velocity Current State

**Date:** 2026-01-20
**Reference Document:** `docs/research_08_UX_patterns_for_surveys.md`

## Executive Summary

The research document `research_08_UX_patterns_for_surveys.md` provides a critical strategic pivot for Velocity. It argues that the current "Single Screen" prototype (Sidebar + Canvas) will fail as data complexity scales (500+ variables). The proposed **"Hybrid Hub-and-Spoke"** architecture—separating "Data Gardening" (Variable Manager) from "Data Analysis" (Canvas) while maintaining instant switching via WASM—is not only appropriate but essential for the product's vision.

The existing application is currently in **Phase 1 (Foundation)**, which implements the "Single Screen" model. Proceeding to **Phase 2 (The Strategic Workbench)** to implement these patterns is the correct strategic move.

---

## 1. Key Patterns & Ideas Identified

The research highlights several key UX patterns required for high-dimensional survey data:

1.  **Strict Mode Separation ("Soft Modal"):** Decoupling "Gardening" (cleaning, recoding) from "Harvesting" (analysis) into distinct, full-screen environments.
2.  **The "Variable Manager" Hub:** A dedicated environment for data engineering, distinct from the analysis canvas.
3.  **Variable Set Abstraction:** Grouping related columns (e.g., Q1_1 to Q1_20) into a single logical "Question" or "Set" to reduce list density by ~90%.
4.  **Miller Columns (Finder View):** Hierarchical navigation (Wave > Section > Question) to replace long scrolling lists.
5.  **Visual ETL (Direct Manipulation):** "Drag-and-Merge" for recoding and "Sankey Diagrams" for harmonization, moving away from code/formulas.
6.  **Faceted Search:** Using metadata (Type, Completeness, Tag) to filter the variable list, treating it like a database.
7.  **Zero-Latency Switching:** Leveraging the local-first WASM architecture to make switching between Data and Analysis modes instantaneous (<100ms), preserving "Flow."

---

## 2. Evaluation of Relevance to Existing App

These patterns are **highly relevant**.

*   **Current State:** `App.tsx` shows a classic "Single Screen" dashboard: a `Sidebar` with a `VirtualizedVariableList` and a `SmartCanvas` for analysis.
*   **The Problem:** The current `VirtualizedVariableList` (lines 487-493 in `App.tsx`) is a flat list. As the user noted in the research, with 500+ variables, this becomes unmanageable.
*   **The Fit:** Velocity's core differentiator is its **DuckDB-Wasm** engine (`services/analysisWorker.ts`). This architectural choice uniquely enables the "Soft Modal" pattern because the entire dataset is in memory. Unlike server-side competitors (Crunch, Displayr) that might have loading times between views, Velocity can switch distinct DOM trees instantly while keeping the database hot.

**Conclusion:** The recommended patterns fully leverage Velocity's architectural advantage. Adopting them turns a technical choice (WASM) into a tangible UX benefit (Speed/Flow).

---

## 3. Areas of Divergence

The current application diverges significantly from the proposed patterns, as it is currently essentially a "Phase 1" prototype.

| Feature | Recommended Pattern | Current Implementation (`src/App.tsx`) | Divergence Level |
| :--- | :--- | :--- | :--- |
| **Architecture** | **Hub-and-Spoke** (Analysis Canvas + Variable Manager) | **Single Screen** (Sidebar + Canvas) | **Critical** |
| **Navigation** | **Miller Columns** (Hierarchy) | **Flat List** (`VirtualizedVariableList`) | High |
| **Recoding** | **Drag-and-Drop on Canvas** (Visual) | **Modal Dialog** (`RecodeModal`) | High |
| **Data Cleaning** | **Faceted Search / Bulk Actions** | **Single Search Bar** (Line 472) | Medium |
| **Structure** | **Variable Sets** (First-Class Citizens) | **Partial Support** (Store has `VariableSet`, but UI is list-based) | Medium |

**Key Insight:** The `RecodeModal` (Line 359) represents the "Legacy" approach (modal dialogs) that the research argues against. The research proposes moving this logic into a full-screen "Variable Manager" or doing it via direct manipulation on the canvas.

---

## 4. Appropriateness Evaluation

**Are these pathways appropriate for Velocity?**

**YES.**

1.  **Vision Alignment:** Velocity aims to be a "Zero-Latency" tool. The "Single Screen" model is fast but cognitively overwhelming. The "Hard Separation" (Tableau style) reduces overload but adds latency/friction. The "Hub-and-Spoke" with WASM is the *only* model that delivers both **Cognitive Clarity** (via separation) and **Zero Latency** (via WASM).
2.  **Architecture Alignment:** The React `DndContext` (Lines 450-460) is already set up for complex drag-and-drop. Extending this to a "Card Sorting" interface for the Variable Manager is a natural evolution of the current tech stack. The `useVelocityStore` (Zustand) is already centralized, making state sharing between two full-screen views trivial.
3.  **Vibe Alignment:** The user wants a "Premium," "State of the Art," and "Dynamic" feel. A "Soft Modal" transition (e.g., the Analysis Canvas blurring and sliding back while the Variable Manager slides in) is a high-end interaction pattern that matches the desired aesthetic better than standard modal dialogs.

## Recommendations for Next Steps

1.  **Route Separation:** Refactor `App.tsx` to support a router or state-based View Manager that switches between `<AnalysisDashboard />` and `<VariableManager />`.
2.  **Implement Variable Manager:** Build the "Card Sorting" view as priority #1 for Phase 2.
3.  **Refactor Sidebar:** Move away from the flat list in the sidebar towards a "Curated List" that only shows "Active" or "pinned" Variable Sets, leaving the full library browsing to the Variable Manager.
4.  **Adopt Variable Sets:** Ensure the entire UI (Droppables, Tables) operates on `VariableSets` rather than raw variables.

**Verdict:** The `research_08` document should be treated as the **Product Requirement Document (PRD)** for the immediate next phase of development.
