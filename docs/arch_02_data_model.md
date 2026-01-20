# Data Model

This document defines the core data structures used throughout Velocity. All components (UI, Worker, Plugins) must adhere to these schemas.

## 1. The Dataset

A `Dataset` represents a single loaded file. The architecture supports multiple datasets for future "Merge" functionality (Aletheia Phase).

```typescript
interface Dataset {
  id: string;                     // UUID
  name: string;                   // Filename (e.g., "wave_7.sav")
  rowCount: number;
  variables: Variable[];
  weightVariable?: string;        // ID of the currently applied weight
  source: "sav" | "csv" | "arrow";
}
```

## 2. The Variable (The Core Entity)

A `Variable` is the atomic unit of survey data. It stores both the raw data reference and the rich metadata required for survey analysis.

```typescript
```typescript
interface Variable {
  id: string;                     // Internal ID (e.g., "var_001")
  name: string;                   // Short name from file (e.g., "Q1_a")
  label: string;                  // Human-readable label (e.g., "Satisfaction with Product")
  type: VariableType;
  semanticType?: SemanticType;    // AI-ready semantic classification
  valueLabels: ValueLabel[];      // Mapping of codes to labels
  missingValues: MissingValueDef; // Definition of "User Missing" codes
}

type VariableType = "nominal" | "ordinal" | "scale";
type SemanticType = "text" | "entity" | "sentiment" | "location" | "temporal";
```

interface ValueLabel {
  value: number;                  // The raw integer code (e.g., 1)
  label: string;                  // The display label (e.g., "Male")
}

interface MissingValueDef {
  // SPSS supports discrete values or a range
  discrete?: number[];            // e.g., [-1, -2, -99]
  range?: { low: number; high: number }; // e.g., { low: -99, high: -1 }
}
```

### 2.1 The "Dual-State" Principle

Every variable exists in two states simultaneously:
1.  **Raw:** The integer codes stored in DuckDB (for fast computation).
2.  **Labeled:** The human-readable labels (for display in UI).

The UI must always display *Labels*. The Engine must always compute on *Raw* values.

## 3. The VariableSet (Grids)

A `VariableSet` groups related variables (e.g., Q5_1, Q5_2, Q5_3 for a brand rating grid).

```typescript
interface VariableSet {
  id: string;
  name: string;                   // e.g., "Brand Ratings"
  variableIds: string[];          // List of Variable IDs in this set
  setType: "grid" | "multi";      // "grid" = rating matrix, "multi" = multi-select
}
```

## 4. The Crosstab (Analysis Output)

A `Crosstab` is the result of a pivot query.

```typescript
interface Crosstab {
  rowVariable: string;            // Variable ID
  colVariable?: string;           // Variable ID (optional for frequency tables)
  cells: CrosstabCell[][];
  rowTotals: CrosstabCell[];
  colTotals: CrosstabCell[];
  grandTotal: CrosstabCell;
  isWeighted: boolean;
}

interface CrosstabCell {
  count: number;                  // Unweighted N
  weightedCount?: number;         // Weighted N (if weight applied)
  percentage: number;             // Column % (default)
  sigMarker?: string;             // e.g., "A" if significantly higher than col A
}
```

## 5. The Filter

A `Filter` restricts the dataset scope.

```typescript
interface Filter {
  id: string;
  variableId: string;
  operator: "eq" | "neq" | "in" | "gt" | "lt";
  value: number | number[];
}
```

## 6. The Recode (Transformation)

A `Recode` defines a non-destructive transformation (bucketing).

```typescript
interface Recode {
  id: string;
  sourceVariableId: string;
  targetVariableName: string;     // New variable name for the recoded version
  mappings: RecodeMapping[];
}

interface RecodeMapping {
  sourceValues: number[];         // e.g., [1, 2]
  targetValue: number;            // e.g., 1
  targetLabel: string;            // e.g., "Low"
}
```
