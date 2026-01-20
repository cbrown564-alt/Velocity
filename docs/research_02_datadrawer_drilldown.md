# Research Report: Drill-Down & Pagination for Large Datasets in Velocity

## Executive Summary
This report explores implementation strategies for connecting the `DataDrawer` component to the `analysisWorker` to enable "drill-down" analysis (viewing raw data for specific crosstab cells) and efficient pagination for large datasets in a browser-based environment. The goal is to match the "X-Ray" capabilities of tools like Displayr and SPSS while maintaining the high performance of DuckDB-WASM.

## 1. Drill-Down UI Patterns in Survey Analysis
Research into similar tools (Displayr, Tableau, SPSS) highlights several key patterns for "drill-down" interactions:

### A. The "X-Ray" or "Data Editor" View
*   **Pattern:** Clicking a data point (e.g., a table cell or bar chart segment) opens a dedicated view showing the raw records responsible for that specific aggregation.
*   **Displayr Approach:** Uses a bottom-docked "Data Editor" that slides up, showing raw spreadsheet-like data. It allows sorting and column reordering.
*   **Velocity Application:** The existing `DataDrawer` component is perfectly positioned to serve this role. It slides in from the right (standard side-drawer pattern), which is less intrusive than a full modal but offers more space than a tooltip.

### B. Contextual Preservation
*   **Pattern:** The drilled-down view must clearly indicate *what* slice of data is being shown.
*   **Requirement:** The drawer header should dynamically display the filter context (e.g., "Gender: Male AND Age: 18-24").
*   **Velocity Application:** We need to pass the row/column labels and any active global filters to the drawer's title/subtitle.

## 2. Pagination Strategies for Large Datasets
Since Velocity runs entirely in the browser using DuckDB-WASM, we have unique constraints and advantages compared to server-based tools. We cannot load 100k+ rows into the DOM (React will crash), but we *can* query them instantly from the worker.

### A. Recommended Strategy: "Worker-Side Pagination"
Instead of "Server-Side," we use "Worker-Side" pagination.
1.  **Frontend:** Requests Page `N` with Limit `L` (e.g., 50 rows).
2.  **Worker:** Executes `SELECT * FROM main WHERE [filters] LIMIT L OFFSET (N-1)*L`.
3.  **Transport:** Only 50 rows are serialized and sent to the main thread.
4.  **Display:** React renders only these 50 rows.

**Pros:**
*   Zero DOM bloat.
*   Minimal memory usage on the main thread.
*   Fast serialization/deserialization.

### B. The "Total Count" Challenge
To render a pagination bar ("Page 1 of 500"), we need the total count of records matching the filter *without* the Limit/Offset.
*   **Solution:** The worker must perform two queries (or one query with a window function/count) when the drill-down first opens or filters change.
    *   Query 1: `SELECT * ... LIMIT 50 OFFSET 0`
    *   Query 2: `SELECT COUNT(*) ...`

## 3. Proposed Implementation for Velocity

### A. Worker Protocol Updates (`analysisWorker.ts`)
We need to extend the worker message protocol to support a specific `drillDown` request.

```typescript
// Proposed New Request Type
type DrillDownRequest = {
  type: 'drillDown';
  filters: FilterCondition[]; // Global filters + Cell-specific filters
  limit: number;
  offset: number;
  returnTotalCount: boolean; // Optimize to only ask for count on init
}

// Proposed New Response Type
type DrillDownResponse = {
  type: 'drillDownResult';
  data: RowData[]; // The 50 rows
  totalCount?: number; // Total matching rows (if requested)
  durationMs: number;
}
```

### B. UI Updates (`DataDrawer.tsx`)
1.  **Pagination Controls:** Add a footer with "Page [current] of [total]" and "Prev/Next" buttons.
2.  **Loading State:** The existing loading spinner is good, but needs to be triggered on every page change.
3.  **Columns:** Dynamically generate table headers based on the keys returned in the first row (or a separate schema request if the first row is empty, though unlikely in a drill-down context).

### C. The SQL Generation Logic (`DrillDownEngine`)
We need a robust way to convert UI state (Row: "Male", Col: "18-24") into SQL `WHERE` clauses.
*   **Logic:** `WHERE "Gender" = 'Male' AND "Age" = '18-24'`
*   **Integration:** precise matching of values is critical. We must ensure the `clicked value` matches the `database value` (handling string normalization if necessary, though strict matching is better).

## 4. Conclusion
The "Worker-Side Pagination" approach is the only viable path for keeping Velocity fast with large datasets. The `DataDrawer` UI is already structurally sound but needs to become "active" by managing its own pagination state and communicating directly with the `analysisWorker`.
