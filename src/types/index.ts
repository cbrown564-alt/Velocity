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
// Survey-centric type system: nominal (categorical unordered), ordinal (categorical ordered),
// scale (continuous numeric), text (open-ended string), date (temporal)
export type VariableType = 'nominal' | 'ordinal' | 'scale' | 'text' | 'date';

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

export interface AggregatedRow {
  rowKeys: string[];
  colKey: string;
  count: number;
  /** Weighted count when a weight variable is applied */
  weightedCount?: number;
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
