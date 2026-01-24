# Implications Mapping: Visualization Engine Refactor

This document outlines the technical and architectural implications of transitioning from a single-table view to the **Hybrid Slide + Focus** architecture (Path C).

## 1. State Model Transition
> [!IMPORTANT]
> The most significant change is the shift from **Global Analysis State** to **Normalized Slide/Cell State**.

- **Current**: `analysisSlice` holds one `tableConfig` and one `queryResult`.
- **New**: `slidesSlice` will store an array of `Slide` objects. Each slide contains `cells`.
- **Implication**: `analysisSlice` should effectively become a "View Window". When a slide/cell is activated, its config is loaded into `analysisSlice` (or `analysisSlice` is modified to accept a `cellId` and fetch the relevant data).
- **Risk**: Synchronization issues between the "Active" view state and the "Persisted" slide state.

## 2. Decoupling Data Transformation
- **Current**: `DataTable.tsx` contains `buildTree()` which transforms the flat DuckDB results into a hierarchy for rendering.
- **New**: Chart renderers (Stacked, Grouped, etc.) will need similar hierarchical data.
- **Action**: Extract `buildTree` and related logic into `src/features/dashboard/utils/dataTransformers.ts`.
- **Benefit**: Consistent data shapes for both tables and charts, ensuring that "Total" counts match across views.

## 3. Visual ETL Integration
- **Concept**: Dragging a bar to merge (Recode) or right-clicking to filter.
- **Implication**: `AnalysisChart` needs to be "Store Aware". It must trigger `analysisSlice` actions (`addFilter`, `openRecodeModal`).
- **Interaction Loop**:
    1. User drags Bar A to Bar B in `AnalysisChart`.
    2. `AnalysisChart` triggers `openRecodeModal` with a proposed merge.
    3. User confirms.
    4. Store updates -> DuckDB re-runs -> `queryResult` updates -> Chart re-renders.

## 4. UI/UX: The "Slide Deck" Metaphor
- **Mode Switching**: The transition between `table` and `chart` views becomes a per-cell setting rather than a global toggle.
- **Shelves (Drag & Drop)**: The "Row/Column/Filter" shelves in the Analysis Canvas must now target the **active cell** of the **active slide**.
- **Layout Management**: Phase 2.5 introduces `SlideContainer` in "Focus Mode". This means the UI should feel largely the same but with one level of wrapping that allows future "Grid Mode" (dashboarding).

## 5. Performance & Responsiveness
- **D3 vs DOM**: Moving from Tailwind-based bars to D3 SVG means we lose some "free" CSS-based responsiveness.
- **Resize Handling**: `AnalysisChart` must implement an `IntersectionObserver` or resize hook to re-render D3 scales when the container size changes (e.g., when the sidebar is toggled).

## 8. Decision: Table Redesign Strategy
**Q: Should we refactor DataTable to use D3?**
**A: No.**

*   **Rationale**:
    *   **Text Handling**: HTML is superior for text wrapping, selection, and accessibility. D3/SVG text handling is brittle.
    *   **Complexity**: Re-implementing a scrolling, virtualization, and sticky-header table in D3 is a massive engineering effort with low ROI.
    *   **Coherence**: We will achieve coherence by using **Shared Data Transformers** (see point 2) and embedding D3 "Micro-charts" (sparklines) *inside* HTML table cells, rather than making the whole table SVG.

**Q: How much refactoring is needed?**
**A: Moderate (Architecture-only).**
*   We do not need to rewrite the *rendering* logic (HTML tags).
*   We MUST refactor the *data interface*:
    *   **Current**: `DataTable` reads directly from global store/props.
    *   **New**: `DataTable` (renamed `AnalysisTable`?) should be a "dumb" component receiving `AggregatedRow[]` and `TableConfig` from the `SlideContainer`. This allows it to be reused in any slide cell.
- **Implication**: D3 charts should visually represent the significance markers (the green/red arrows or dots currently in the table).
- **Design Decision**: For Phase 2, we will prioritize rendering the primary metrics (Counts/Means). Significance markers in charts will be implemented as subtle glyphs on bars or via Tooltips.

## 7. Path C Readiness (Phase 2.5)
- **File Renaming**: `DataTable.tsx` should eventually be part of a larger `AnalysisView` component that handles the Table/Chart branch.
- **Routing/URL State**: If we have multiple slides, the active `slideId` should ideally be reflected in the URL for shareability. (Deferred to Phase 4).
