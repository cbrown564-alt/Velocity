/**
 * Velocity Type Definitions
 * 
 * Core data model types from arch_02_data_model.md.
 * These are re-exported from store.ts for consistency.
 * Legacy types are provided for backward compatibility with existing components.
 */

// ============================================================================
// Core Data Model (from arch_02_data_model.md)
// ============================================================================

// Core types from arch_02_data_model.md
// Survey-centric type system:
// - nominal: Unordered categories (e.g. Gender, City)
// - ordinal: Ordered categories (e.g. Education, Frequency)
// - scale: Likert items / Ratings (e.g. 1-10 Satisfaction, Agree-Disagree)
// - numeric: Continuous variables (e.g. Age, Income)
// - text: Open-ended string
// - date: Temporal
export type VariableType = 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date';

export interface ValueLabel {
  value: number;
  label: string;
}

export interface MissingValueDef {
  discrete?: number[];
  range?: { low: number; high: number };
}

export interface Variable {
  id: string;
  name: string;
  label: string;
  type: VariableType;
  semanticType?: 'text' | 'entity' | 'sentiment' | 'location' | 'temporal';
  valueLabels: ValueLabel[];
  missingValues: MissingValueDef;
  /** True if this variable was generated automatically (e.g. for grid rows/cols) */
  synthetic?: boolean;
  /** ID of the VariableSet that generated this synthetic variable */
  sourceGridId?: string;
}

export interface Dataset {
  id: string;
  name: string;
  rowCount: number;
  variables: Variable[];
  weightVariable?: string;
  source: 'sav' | 'csv' | 'arrow';
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface CrosstabCell {
  count: number;
  weightedCount?: number;
  percentage: number;
  sigMarker?: string;
}

export interface Crosstab {
  rowVariable: string;
  colVariable?: string;
  cells: CrosstabCell[][];
  rowTotals: CrosstabCell[];
  colTotals: CrosstabCell[];
  grandTotal: CrosstabCell;
  isWeighted: boolean;
}

export interface Filter {
  id: string;
  variableId: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
  value: number | string | (number | string)[];
}

export interface Recode {
  id: string;
  sourceVariableId: string;
  targetVariableName: string;
  mappings: RecodeMapping[];
}

export interface RecodeMapping {
  sourceValues: number[];
  targetValue: number;
  targetLabel: string;
}

export type RecodeMode = 'categorical' | 'binning';

export interface RecodeRule {
  min?: number;
  max?: number;
  label: string;
}

export interface RecodeConfig {
  mode: RecodeMode;
  mappings?: Record<string, string>;
  rules?: RecodeRule[];
}

export interface VariableSet {
  id: string;
  /** Display name for the set (e.g., "Brand Awareness") */
  name: string;
  /** IDs of variables in this set */
  variableIds: string[];
  /**
   * Structure type determines how the set is used in analysis:
   * - 'single': Standard single variable (1:1 mapping, default)
   * - 'multiple': Multiple response set (e.g., "Select all that apply")
   * - 'grid': Grid/matrix structure (rows x columns)
   */
  structure: 'single' | 'multiple' | 'grid';
  /** Inferred or explicit variable type for the set */
  type?: VariableType;
  /** Optional description */
  description?: string;
  /** Whether to hide from Analysis Canvas (Data Gardening only) */
  hidden?: boolean;
  /** Folder this set belongs to (null = ungrouped) */
  folderId?: string;
  /** True if created via recode/compute operation */
  derived?: boolean;
  /** For multiple-response sets, which value counts as "selected" */
  countedValue?: number;

  /** 
   * Metadata for grid/matrix variable sets.
   * Enables explicit row x column handling instead of monolithic processing.
   */
  gridMetadata?: {
    /** The shared scale used by all items in the grid (rows) */
    sharedScale: {
      valueLabels: Record<number, string>;
      type: 'ordinal' | 'nominal';
    };
    /** Labels for the items being rated (columns) */
    itemLabels: string[];
    /** Maps variableId to its index in itemLabels */
    itemMapping: Record<string, number>;
  };
}

/**
 * Folder for organizing variable sets.
 * Flat structure (no nesting) per implementation decision.
 */
export interface Folder {
  id: string;
  name: string;
  /** Order for display (lower = higher) */
  order: number;
}

// ============================================================================
// UI Types
// ============================================================================

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export interface AggregatedRow {
  rowKeys: string[];
  colKey: string;
  count: number;
  /** Weighted count when a weight variable is applied */
  weightedCount?: number;
  /** Sum of squared weights (for Effective Sample Size calculation) */
  sumSqWeights?: number;
  // Scale variable stats
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  q1?: number; // 25th percentile
  q3?: number; // 75th percentile
  validCount?: number;
  /** Histogram bins for Violin/Ridgeline charts */
  histogramBins?: HistogramBin[];
  /** Significance marker: 95% (strong) or 80% (weak) confidence */
  sig?: 'high_95' | 'high_80' | 'low_95' | 'low_80';
  /** Detailed statistics for tooltip explanation */
  stats?: {
    tScore: number;
    pValue: number;
    effN: number;
  };
}

export interface TableConfig {
  rowVars: string[];
  colVar: string | null;
}

export type DragItem = {
  id: string;
  label: string;
};

export type DropZoneType = 'row' | 'column';

// ============================================================================
// Collaboration Types (Future)
// ============================================================================

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  activeAction?: string;
}

// ============================================================================
// Legacy Compatibility Types
// ============================================================================

// Old Respondent type - kept for mock data compatibility
export interface Respondent {
  id: string;
  [key: string]: string | number;
}

// Old DataSet type - kept for mock data compatibility
export interface DataSet {
  variables: Variable[];
  data: Respondent[];
}
