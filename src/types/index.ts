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

// Core types from arch_02_data_model.md with legacy compatibility
export type VariableType = 'nominal' | 'ordinal' | 'scale' | 'categorical' | 'numeric';

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
  value: number | number[];
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

export interface VariableSet {
  id: string;
  name: string;
  variableIds: string[];
  setType: 'grid' | 'multi';
}

// ============================================================================
// UI Types
// ============================================================================

export interface AggregatedRow {
  rowKeys: string[];
  colKey: string;
  count: number;
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
