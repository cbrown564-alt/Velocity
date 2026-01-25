# Architecture Documentation: Grid Variable Refactoring

## Overview
This refactor transitions Velocity's handling of Grid Variables (Likert matrices) from a monolithic special case to a composable, explicit "Scale × Items" architecture. This aligns the codebase with the "Analysis is just Scale × Items" philosophy, simplifying the backend and enabling advanced features like pivoting.

## Key Decisions

### 1. Backend: Composable SQL via Synthetic Variables
**Previous Approach:**
- Used a loop of `UNION ALL` statements to stack data for each column in a grid.
- required special `gridColumns` option in the query builder.
- Hard to pivot or group by other variables.

**New Approach:**
- **Synthetic Variables:** The `analysisWorker` detects grids and generates two synthetic variables for each grid:
  - `*_items`: A nominal variable representing the columns (e.g., Brand A, Brand B).
  - `*_scale`: An ordinal variable representing the rating scale (e.g., 1-5 Stars).
- **SQL Unpivoting:** The `queryBuilder` uses a `CASE WHEN` strategy inside a CTE to unpivot the data when synthetic variables are detected.
  ```sql
  WITH grid_cte AS (
      SELECT 
        row_key,
        CASE 
          WHEN item_id = 0 THEN q1_1 
          WHEN item_id = 1 THEN q1_2
        END as value_col
      FROM main
      CROSS JOIN (VALUES (0), (1)) AS items(item_id)
  )
  ```
- **Benefit:** Resulting data looks exactly like a standard crosstab (Nominal × Ordinal), removing special handling from downstream components.

### 2. Frontend: Auto-Expansion
- When a Grid Variable is dropped onto the canvas, the UI (App.tsx) detects the `grid` structure and automatically expands it into its synthetic components (`*_items` and `*_scale`).
- To the user, it appears as if they have full control over the rows and columns independently.
- To the system, it is just a standard request for two variables.

### 3. Context-Aware Worker
- `analysisSlice` now passes a `context` object containing full variable definitions to the worker.
- This allows the worker to resolve synthetic IDs (like `Q1_items`) back to the source grid metadata needed for SQL generation, keeping the frontend "dumb" about query details.

## Issues Encountered & Resolution

### 1. Missing Pills
**Issue:** Synthetic variables appeared in the variable list but disappeared when dropped because there was no corresponding `VariableSet`.
**Fix:** Updated `analysisWorker` to generate synthetic `VariableSet`s for `_items` and `_scale`, enabling them to be rendered by the `DraggableVariable` and `DropZone` components.

### 2. Duplicate Parameter Binding caused by merging
**Issue:** Build error in `useProcessedAnalysisData.ts` due to duplicate parameters in function signature.
**Fix:** Removed redundant lines in the destructuring assignment.

## Future Work
- **Pivot UI:** Add a dedicated "Swap Rows/Cols" button to leverage the new composable nature.
- **Visual Connectors:** Add visual lines or grouping to indicate that `Items` and `Scale` pills belong to the same parent grid, even though they are separate.
