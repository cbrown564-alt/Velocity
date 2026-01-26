# Component Review & Assessment
**Date:** 2026-01-26
**Scope:** `src/components` (Shared Components, Charts, Overlays)

## 1. Executive Summary
The shared component library demonstrates high ambition with a sophisticated "Mission Control" aesthetic and complex interactive features like "Visual ETL" (drag-to-merge). However, the implementation suffers from **leaky abstractions** and **styling inconsistency**.

*   **Strengths**: High interactivity (drag-and-drop, brushing), robust D3 integration, and a clear vision for the "Local-First" architecture.
*   **Weaknesses**: Business logic (data transformation) is tightly coupled with presentation logic. Styling strategies are fragmented (CSS Modules + Tailwind + Inline Styles).

## 2. Detailed Findings

### 2.1 Styling Fragmentation
There is no single source of truth for styling, leading to maintenance overlap and visual drift.

| Pattern | Where Found | Issue |
| :--- | :--- | :--- |
| **Tailwind Utilities** | `DropZone.tsx`, `AppShell.tsx` | Standard, but often hardcoded colors like `border-indigo-200` instead of semantic tokens. |
| **CSS Modules** | `AnalysisChart.module.css` | Used for layout in charts. Creates dual-maintenance tracking styles in both CSS and TSX classes. |
| **Inline Styles** | `FilterModal.tsx`, `DivergingBarRenderer.tsx` | **Critical**: Extensive use of `style={{ color: ... }}` prevents global theming and overrides. |
| **Hardcoded Colors** | `DropZone.tsx` | uses `bg-indigo-500` instead of `var(--color-primary)`. Violates the "Mission Control" theme system. |

**Recommendation**: Standardize on **Tailwind with Semantic Classes** (e.g., `text-ink` mapping to `var(--color-ink)`). Remove all inline style color definitions.

### 2.2 Separation of Concerns (Logic Leaks)
Several "dumb" components are performing complex "smart" logic that belongs in the Worker or a Store selector.

*   **AnalysisChart.tsx**:
    *   **Issue**: Contains ~300 lines (Lines 102-410) of data transformation logic (e.g., transposing Grid data, calculating Diverging Bar splits).
    *   **Impact**: This code runs on the Main Thread during render. Large datasets will freeze the UI.
    *   **Fix**: Move this transformation to `analysisWorker.ts` or a memoized selector in `useProcessedAnalysisData`.

*   **DivergingBarRenderer.tsx**:
    *   **Issue**: Hardcodes the list of "Special Values" (`"don't know"`, `"n/a"`) inside the component.
    *   **Impact**: Changing these keywords requires a code deploy. This is configuration/business logic, not view logic.

### 2.3 Performance & React Best Practices
*   **Main Thread Computation**: The `useMemo` hooks in Chart Renderers are doing heavy lifting (sorting, d3 scaling) every render. While React is fast, doing this for 1000s of data points will frame-drop.
*   **Event Listeners**: `HorizontalBarRenderer.tsx` adds `document` level listeners for drag interactions. While cleaned up correctly, this imperative style is brittle. Consider a library like `@dnd-kit/core` (used in `DropZone.tsx`) for consistency.

### 2.4 Aesthetics & "Mission Control" Feel
*   **Successes**: The D3 charts generally respect the theme variables (`var(--viz-fill-secondary)`), meaning they adapt well to Dark Mode.
*   **Misses**: `DropZone` and `FilterModal` look distinct from the charts. `DropZone` feels like a standard SaaS component (Indigo/White), whereas `AnalysisChart` feels like a Sci-Fi interface.

## 3. Component-Specific Audits

### `src/components/overlays/FilterModal.tsx`
*   **Rating**: ⚠️ Needs Refactor
*   **Issues**:
    *   Heavy use of inline styles (`style={{ ... }}`).
    *   State logic for fetching values (`getUniqueValues`) is mixed with UI code.
    *   No accessibility attributes (`aria-label`, `role="dialog"`).

### `src/components/charts/AnalysisChart.tsx`
*   **Rating**: ⚠️ Architectural Risk
*   **Issues**:
    *   Acting as a "God Component" for charts.
    *   Handles data transformation, routing to renderers, context menus, and toolbars.
    *   Should be broken down: `ChartContainer`, `ChartToolbar`, `ChartLegend`, `DataTransformer`.

### `src/components/common/DropZone.tsx`
*   **Rating**: 🟡 Inconsistent
*   **Issues**:
    *   Uses hardcoded `indigo` colors.
    *   Good use of `@dnd-kit`, but visual style doesn't match the "Dark Mode" aesthetic of the charts.

## 4. Action Plan

1.  **Refactor Styling**: created a global `tailwind.config.js` extension that maps semantic names (`color-ink`, `viz-fill-primary`) to the CSS variables. Bulk replace inline styles.
2.  **Extract Logic**: Move the `AnalysisChart` data transformation logic into `src/workers/analysisWorker.ts`. The Chart component should receive `readyToRender` data.
3.  **Config Driven**: Move "Special Keywords" (N/A, Don't Know) to a generic config file or store slice.
