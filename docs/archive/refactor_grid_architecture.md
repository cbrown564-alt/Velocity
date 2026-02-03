# Grid Variable Architecture Refactoring

**Date:** 2026-01-25
**Status:** Design Proposal

## Problem Statement

Grid variables (Likert matrices, rating grids) currently work as a **monolithic special case** that gets "unpivoted" at query time using SQL UNION ALL. While this renders beautifully, it has architectural issues:

### Current Issues:

1. **Opaque UX**: Grid appears as single pill in row shelf, hiding its true row × column nature
2. **No Decomposition**: Users can't see or manipulate the individual row/column components
3. **No Pivot Capability**: Can't swap rows ↔ columns for different visualizations
4. **Not Composable**: Can't mix grid items with other column variables in the same analysis
5. **Backend Complexity**: Special `isGrid` flag, `gridColumns` options, and UNION ALL SQL queries create parallel code paths

### What Grids Really Are:

A grid question like "Rate these products on satisfaction" is fundamentally:
- **Rows**: A shared scale (1-5, or Strongly Disagree → Strongly Agree)
- **Columns**: Individual items (Product A, Product B, Product C)

Currently, we store the **columns** (individual rating variables) and **infer** the rows (shared scale) at query time. This is backwards.

## Proposed Architecture

### 1. Data Model Changes

**Current:**
```typescript
interface VariableSet {
  id: string;
  variableIds: string[];  // ["q1_product_a", "q1_product_b", "q1_product_c"]
  structure: 'grid';
  // No explicit representation of the shared scale
}
```

**Proposed:**
```typescript
interface VariableSet {
  id: string;
  variableIds: string[];
  structure: 'grid';

  // NEW: Explicit grid metadata
  gridMetadata?: {
    sharedScale: {
      valueLabels: Record<number, string>;  // {1: "Poor", 2: "Fair", ...}
      type: 'ordinal' | 'nominal';
    };
    itemLabels: string[];  // ["Product A", "Product B", "Product C"]
    // Maps each variableId to its position in itemLabels
    itemMapping: Record<string, number>;  // {"q1_product_a": 0, ...}
  };
}
```

**Benefits:**
- Makes the row × column structure **explicit** in the data model
- Enables creating synthetic variables for both dimensions
- Allows validation (e.g., all variables must share the same scale)

### 2. Synthetic Variable Creation

When a grid VariableSet is created, generate two synthetic variables:

**A. Grid Scale Variable** (represents the shared ratings)
```typescript
{
  id: `${gridSetId}_scale`,
  name: `${gridSetName}_scale`,
  label: `${gridSetName} (Scale)`,
  type: 'ordinal',
  valueLabels: gridMetadata.sharedScale.valueLabels,
  synthetic: true,
  sourceGridId: gridSetId
}
```

**B. Grid Items Variable** (represents which item is being rated)
```typescript
{
  id: `${gridSetId}_items`,
  name: `${gridSetId}_items`,
  label: `${gridSetName} (Items)`,
  type: 'nominal',
  valueLabels: {
    0: "Product A",
    1: "Product B",
    2: "Product C"
  },
  synthetic: true,
  sourceGridId: gridSetId
}
```

### 3. Canvas Interaction Changes

**Current Behavior:**
- User drags grid VariableSet → Single pill appears in row shelf
- Behind the scenes, special `isGrid` flag triggers UNION ALL query

**Proposed Behavior:**

#### Option A: Auto-Expand on Drop
When user drops grid VariableSet:
1. Show confirmation dialog: "This is a grid question. Expand into rows and columns?"
2. If yes:
   - Add `${gridSetId}_scale` to **rows**
   - Add `${gridSetId}_items` to **columns**
   - Display as two separate pills with visual connection (e.g., same color border)

#### Option B: Split Button UI
Show grid pill with split button:
- **Left side**: Click to expand (adds both synthetic variables)
- **Right side**: Dropdown menu:
  - "Items as rows, scale as columns" (default)
  - "Scale as rows, items as columns" (pivoted)
  - "Treat as single variable" (current behavior)

#### Option C: Grid Inspector Panel
When grid is on canvas, show mini-panel:
```
┌─────────────────────────────────────┐
│ Grid: Product Satisfaction          │
├─────────────────────────────────────┤
│ Rows:    [Scale: 1-5]         [↕ swap] │
│ Columns: [Items: A, B, C]            │
│                                      │
│ [Edit Items] [Pivot] [Ungroup]      │
└─────────────────────────────────────┘
```

**Recommendation:** Start with **Option A** (auto-expand) for simplicity. Add pivot button later.

### 4. SQL Query Generation Changes

**Current Approach (UNION ALL unpivoting):**
```sql
SELECT 'Product A' as colKey, "q1_product_a" as rowKey_0, COUNT(*) as count
FROM main WHERE "q1_product_a" IS NOT NULL GROUP BY "q1_product_a"
UNION ALL
SELECT 'Product B' as colKey, "q1_product_b" as rowKey_0, COUNT(*) as count
FROM main WHERE "q1_product_b" IS NOT NULL GROUP BY "q1_product_b"
-- ... (one SELECT per item)
```

**Problems:**
- Query size grows linearly with number of items (100 items = 100 UNIONs)
- Doesn't use standard crosstab logic
- Requires special `gridColumns` parameter

**Proposed Approach (Synthetic unpivot with CASE WHEN):**

First, create a virtual unpivoted table using a CROSS JOIN:
```sql
WITH unpivoted AS (
  SELECT
    -- The item being rated (0, 1, 2 for Products A, B, C)
    item_index,
    -- The rating value (1-5)
    CASE item_index
      WHEN 0 THEN "q1_product_a"
      WHEN 1 THEN "q1_product_b"
      WHEN 2 THEN "q1_product_c"
    END as rating_value
  FROM main
  CROSS JOIN (SELECT 0 AS item_index UNION ALL SELECT 1 UNION ALL SELECT 2) items
  WHERE CASE item_index
    WHEN 0 THEN "q1_product_a" IS NOT NULL
    WHEN 1 THEN "q1_product_b" IS NOT NULL
    WHEN 2 THEN "q1_product_c" IS NOT NULL
  END
)
SELECT
  rating_value as rowKey_0,  -- The scale (1-5)
  item_index as colKey_0,    -- The item (0, 1, 2)
  COUNT(*) as count
FROM unpivoted
GROUP BY rating_value, item_index
```

This produces the **same result** as the current UNION ALL approach, but:
- Uses standard crosstab structure (rowKey_0 × colKey_0)
- Works with existing data processing pipeline
- Query size is constant regardless of number of items

**Alternative: Use DuckDB's UNPIVOT (if supported)**
```sql
SELECT rating_value as rowKey_0, item_name as colKey_0, COUNT(*) as count
FROM (
  SELECT * FROM main
  UNPIVOT (
    rating_value FOR item_name IN (q1_product_a, q1_product_b, q1_product_c)
  )
)
GROUP BY rating_value, item_name
```

### 5. Remove Special Cases in Processing Pipeline

**Current Code:**
- `isGrid` flag passed through multiple layers
- Special `gridColumns` option in query builder
- Special handling in `useProcessedAnalysisData`
- Special chart recommendation logic

**After Refactor:**
- Grid analysis is just **scale variable (rows) × items variable (columns)**
- No `isGrid` flag needed
- Standard crosstab query generation
- Standard data processing
- Chart recommendation based on variable types, not special flag

**Exception:** May still need special handling for:
- **Diverging bar default**: When both variables are synthetic from same grid
- **Item filtering**: UI to show/hide specific items without re-querying

### 6. Benefits of New Architecture

#### Composability
Users can now:
- Add additional column variables alongside grid items (e.g., compare products × gender)
- Remove individual items from the column shelf
- Reorder items
- Mix grid items from multiple grids

#### Pivoting
Simple button to swap:
- **Items as rows, scale as columns**: See each product's distribution
- **Scale as rows, items as columns**: See distribution across products (current default)

#### Coherence
- Backend uses **one crosstab algorithm** for all analyses
- No special `isGrid` flags polluting the codebase
- SQL queries follow standard pattern
- Data processing follows standard pattern

#### User Understanding
- Users see the **true structure** of their data
- Grids are demystified as simple row × column combinations
- Encourages exploration (users can manipulate components)

## Implementation Plan

### Phase 1: Backend Foundation (No UI Changes Yet)
1. Add `gridMetadata` to `VariableSet` type
2. Update grid detection in `analysisWorker.ts` to populate metadata
3. Create synthetic variable generation function
4. Update `dataSlice` to store synthetic variables alongside real ones

### Phase 2: SQL Query Refactor
1. Update `queryBuilder.ts` to detect synthetic grid variables
2. Implement CASE WHEN unpivoting query generation
3. Add tests to verify output matches current UNION ALL approach
4. Switch `analysisSlice` to use new query builder path

### Phase 3: Remove Special Cases
1. Remove `isGrid` flag from `useProcessedAnalysisData`
2. Remove `gridColumns` from query options
3. Update chart recommender to detect grids via synthetic variable metadata
4. Remove special cases from `AnalysisChart.tsx`

### Phase 4: UI Decomposition
1. Update drag handler to auto-expand grids into row + column pills
2. Add visual connection (border color, icon) to show pills are related
3. Add pivot button to swap rows ↔ columns
4. Update `DraggableVariable` to show grid structure preview

### Phase 5: Polish & Advanced Features
1. Add "Grid Inspector" panel for item management
2. Support filtering individual items
3. Support reordering items
4. Support mixing items from multiple grids

## Migration Strategy

**Backward Compatibility:**
- Existing datasets with grid VariableSets continue to work
- On next analysis, synthetic variables are generated automatically
- Old `isGrid` code paths remain but are deprecated
- Remove old code paths after 2 versions

## Open Questions

1. **Should we persist synthetic variables in localStorage?**
   - Pro: Faster subsequent loads, explicit in state
   - Con: Duplicates data, complicates persistence
   - **Recommendation:** Generate on-demand, cache in memory only

2. **How to handle grids with heterogeneous scales?**
   - Current heuristic assumes all items share exact same scale
   - What if one item has different value labels?
   - **Recommendation:** Reject as invalid grid, treat as separate variables

3. **Should pivot state be persisted per analysis?**
   - User pivots grid, saves analysis, reopens later
   - Should pivot state be remembered?
   - **Recommendation:** Yes, store in `TableConfig` as `gridPivots: Record<gridId, boolean>`

4. **How to handle multiple grids in same analysis?**
   - Grid A (Products) and Grid B (Services) both in column shelf
   - Should they share the same column space?
   - **Recommendation:** Stack separately, or support nested columns (future work)

## Success Metrics

- [ ] Grid VariableSets auto-expand into row + column pills on canvas
- [ ] Pivot button swaps rows ↔ columns without re-query
- [ ] No `isGrid` flags in processing pipeline
- [ ] Query generation uses standard crosstab logic
- [ ] Users can mix grid items with other column variables
- [ ] Performance is equal or better (fewer UNION ALLs)
- [ ] All existing grid analyses render identically

## References

- Current implementation exploration: Agent a52eb86
- Data model: `src/types/index.ts`
- Grid detection: `src/services/analysisWorker.ts:456-741`
- Query generation: `src/services/queryBuilder.ts`
- Data processing: `src/hooks/useProcessedAnalysisData.ts`
