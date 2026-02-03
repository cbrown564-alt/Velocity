# Assessment: Breaking Changes & Architectural Impact

**Date:** 2026-01-20
**Scope:** Review of `docs/assessment_research_06_...`, `07_...`, `evaluation_ux_patterns.md`, `blue_01_unified_roadmap.md`, and `tracker_00_...`

## Executive Summary

A comprehensive review of the proposed research-driven changes against the current implementation (`Phase 1`) confirms:
1.  **NO Breaking Changes:** The current architecture (DuckDB-Wasm, Arrow, React/Zustand) requires no destructive refactoring.
2.  **Significant Additive Work:** The "Hub-and-Spoke" model (Variable Manager) is a major new component but fits essentially "on top" of the existing engine.

---

## 1. Breaking Change Assessment

| Proposed Change | Status | Breaking? | Notes |
| :--- | :--- | :--- | :--- |
| **Hub-and-Spoke UI** | 🟢 **Safe** | ❌ No | Additive. Requires new Router/Layout, but existing `Dashboard` components stayvalid. |
| **C++ Wasm Raking** | 🟢 **Safe** | ❌ No | New Worker/Wasm module. Does not conflict with existing `analysisWorker.ts`. |
| **Variable Sets** | 🟢 **Safe** | ❌ No | `VariableSet` type already exists. UI needs to adopt it, but data model is ready. |
| **Vector Embeddings** | 🟢 **Safe** | ❌ No | Future extension. Current `Variable` model can be extended non-destructively. |

**Verdict:** The `Phase 1` foundation is solid. We can proceed to `Phase 2` without rewriting core logic.

---

## 2. Significant Architectural Additions (Non-Destructive)

While not breaking, these items represent **New Architecture** that must be designed carefully.

### A. The "Hub-and-Spoke" View Layer (Phase 2)
*   **Source:** `docs/evaluation_ux_patterns.md`
*   **Requirement:** A new top-level "View Manager" to switch between:
    1.  `AnalysisCanvas` (Current Dashboard)
    2.  `VariableManager` (New "Card Sorting" View)
*   **Tech Strategy:**
    *   Use a lightweight router or State-based switching.
    *   Ensure DuckDB stays "Hot" (in-memory) during switches.
    *   **Action:** Refactor `App.tsx` from being the "Dashboard" to being the "Shell" that renders one of these two views.

### B. The Weighting Engine (Phase 3)
*   **Source:** `docs/assessment_research_07_vs_implementation.md`
*   **Requirement:** Port C++ Raking library to Wasm.
*   **Tech Strategy:**
    *   Create a new directory `src/services/weighting/`.
    *   This will be a *separate* Wasm blob from DuckDB.
    *   **Action:** No immediate action in Phase 2, but ensure `Variable` objects can be passed easily to a future worker.

### C. Semantic Metadata (AI Prep)
*   **Source:** `docs/assessment_research_06_data_model_relevance.md`
*   **Requirement:** Prepare for "AI-First" features.
*   **Recommendation:**
    *   Add `semanticType?: 'text' | 'entity' | 'sentiment'` to the `Variable` interface in `src/types/index.ts` now, to separate it from the statistical `type` (`nominal`/`scale`).

---

## 3. Implementation Plan Adjustments

Based on this assessment, the immediate next steps for the codebase are:

1.  **Refactor `App.tsx`:** Prepare the "Shell" for the Hub-and-Spoke model.
2.  **Create `VariableManager` Placeholder:** Scaffold the new mode.
3.  **Update `Variable` Type:** Add the `semanticType` field (low effort, high leverage).

This confirms the path forward is **Evolutionary**, not **Revolutionary**.
