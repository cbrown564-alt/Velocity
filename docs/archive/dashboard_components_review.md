# Dashboard Components Review

## Executive Summary
The `src/features/dashboard/components` directory contains the core visualization and interaction logic for the Velocity dashboard. While functional, the codebase exhibits significant debt in **styling consistency** (mixing hardcoded values with CSS variables) and **component architecture** (logic coupling in `DataTable`). There is a clear need to align these components with the "Mission Control" design system and extract complex data logic into testable hooks or utilities.

## detailed Component Analysis

### 1. `DataTable.tsx` (Critical)
The centerpiece of the dashboard, handling data aggregation, tree-building for grouping, and rendering.
*   **Functionality**: Robust features (grouping, drill-down, metric support). However, the `buildTree` logic (Lines 162-403) is extremely dense and complex to maintain within the component. The "HACK" at line 321 regarding mean calculation indicates unresolved logic issues.
*   **Design**: 
    *   **Inconsistent Theming**: Uses a mix of CSS variables (`var(--text-primary)`) and hardcoded hex codes (`bg-[#2C2C2C]`, `text-[#525252]`, `bg-[#1A1F24]/50`). This will break or look jarring in different themes (e.g., light mode).
    *   **Direct Styling**: Many styles are applied via utility classes that should be abstracted into a semantic design system or use standard CSS variables.
*   **Coherence**: 
    *   **Logic Coupling**: Data transformation logic (`buildTree`, sort logic) is tightly coupled to the view. This makes it hard to unit test the data processing independently of the rendering.
    *   **Performance**: The heavy aggregation logic runs inside a `useMemo` in the render body. While memoized, it runs on the main thread and could cause jank for large datasets.
*   **Recommendation**: Extract `buildTree` and sorting logic into a dedicated hook (e.g., `useAggregatedTableData`) or utility. Replace all hardcoded hex values with semantic CSS variables.

### 2. `ContextMenu.tsx`
A utility component for right-click interactions.
*   **Functionality**: Functional MVP. Uses standard event listeners for click-outside.
*   **Design**: 
    *   **Light Mode Hardcoding**: The component is hardcoded for a light theme (`bg-white`, `text-gray-700`, `shadow-lg`). This is likely inconsistent with the rest of the dark-themed "Mission Control" app.
    *   **Positioning**: Basic clamping logic (`Math.min`) might fail on edge cases or multi-monitor setups.
*   **Coherence**: Simple and isolated, but visually disconnected from the app's aesthetic.
*   **Recommendation**: Update to use `var(--bg-surface)`, `var(--border-subtle)` etc. Consider using a library like Radix UI Context Menu for better accessibility and positioning if complexity grows.

### 3. `SlideContainer.tsx`
The layout container connecting the store to the view.
*   **Functionality**: Correctly connects `useVelocityStore` to `DataTable` and `AnalysisChart`.
*   **Design**: Minimal impact, largely a layout wrapper.
*   **Coherence**: 
    *   **Logic Duplication**: The variable resolution logic (Lines 38-71) manually resolves `VariableSet` IDs to `Variable` objects. This pattern likely exists elsewhere.
*   **Recommendation**: Move the variable resolution logic into a selector or custom hook (`useResolvedVariables`) to DRY up the codebase.

### 4. `DraggableVariable.tsx` & `VirtualizedVariableList.tsx`
Handles the list of variables available for analysis.
*   **Functionality**: Uses `dnd-kit` and `react-window` effectively. The custom `useContainerSize` hook in the list component is a good solution for size observation.
*   **Design**: distinctively cleaner than `DataTable`. Uses CSS variables consistently (`var(--bg-surface)`, `var(--text-secondary)`). Good use of Lucide icons.
*   **Coherence**: well-structured. `VariableCard` is purely presentational, while `DraggableVariable` handles the drag behavior.
*   **Recommendation**: Keep as the gold standard for other components to match in terms of variable usage.

## Cross-Cutting Issues

### 1. Theming & Color System
The biggest issue is the lack of a unified color system in the `DataTable`.
*   **Problem**: `th` headers use `bg-[#2C2C2C]`, totals use `bg-[#1A1F24]/50`.
*   **Fix**: These *must* be replaced with semantic tokens like `var(--bg-header)`, `var(--bg-highlight)`, or similar to ensure the "Mission Control" theme works globally.

### 2. Testing
*   **Observation**: I found `DraggableVariable.test.tsx` but no tests for `DataTable.tsx`.
*   **Risk**: `DataTable` contains critical logic for data aggregation. Without tests, refactoring or bug fixing is high-risk.
*   **Fix**: Create a unit test for the `buildTree` logic (once extracted) to verify aggregation, sorting, and gap-filling logic.

## Action Plan
1.  **Refactor Styles**: Sweep through `DataTable.tsx` and `ContextMenu.tsx` to replace hex codes with CSS variables. (Partial - DataTable verified)
2.  [x] **Extract Logic**: Move `buildTree` from `DataTable` to `src/features/dashboard/hooks/useAggregatedTableData.ts`.
3.  [x] **Add Tests**: Add unit tests for the extracted `useAggregatedTableData` logic.
4.  **Standardize**: Ensure `ContextMenu` uses the same visual language (dark mode/glassmorphism) as the rest of the app.

