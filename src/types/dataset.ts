/**
 * Dataset domain types — shared across engine, session, and UI.
 *
 * Canonical home for Variable/Dataset/VariableSet/Folder/DataTransform.
 * Store slices and features import from here instead of dataSlice.
 */

import type { OrderedScoring, OrderedStyle, VariableType } from './variableType';
import type { RecodeConfig } from './recode';

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
  orderedStyle?: OrderedStyle;
  orderedScoring?: OrderedScoring;
  /** @deprecated Use `semantic.measurementIntent` instead */
  semanticType?: 'text' | 'entity' | 'sentiment' | 'location' | 'temporal';
  /** Phase 4: Rich semantic annotation (optional, populated incrementally) */
  semantic?: import('./semantic').SemanticAnnotation;
  valueLabels: ValueLabel[];
  missingValues: MissingValueDef;
  /** True if this variable was generated automatically (e.g. grid helpers). */
  synthetic?: boolean;
  /** ID of the grid VariableSet that generated this synthetic variable. */
  sourceGridId?: string;
}

export interface Dataset {
  id: string;
  name: string;
  rowCount: number;
  variables: Variable[];
  weightVariable?: string;
  source: 'sav' | 'csv' | 'arrow';
  /** OPFS key for the original uploaded file (used for local-first restore). */
  opfsFileKey?: string;
  /** True if only metadata was loaded (no rows in DuckDB) */
  metadataOnly?: boolean;
  /** Number of rows loaded in sample mode (if applicable) */
  sampleRowCount?: number;
  /** Sampling strategy used: 'sequential' (first N rows) or 'spread' (evenly distributed) */
  sampleStrategy?: 'sequential' | 'spread';
  /** Non-fatal ingestion/degradation diagnostics surfaced to the UI. */
  loadDiagnostics?: {
    isPartial: boolean;
    reason: 'storage_quota' | 'sampling' | 'metadata_only' | 'unknown';
    message: string;
    valueLabelsDropped?: number;
    valueLabelsRetained?: number;
    createdAt: number;
  };
}

export interface VariableSet {
  id: string;
  name: string;
  variableIds: string[];
  structure: 'single' | 'multiple' | 'grid';
  type?: VariableType;
  orderedStyle?: OrderedStyle;
  orderedScoring?: OrderedScoring;
  /** Hidden from Analysis Canvas (Data Gardening only) */
  hidden?: boolean;
  /** Folder this set belongs to (null = ungrouped) */
  folderId?: string;
  /** Display order within folder */
  order?: number;
  /** True if created via recode/compute operation */
  derived?: boolean;
  /** For multiple-response sets, which value counts as "selected" */
  countedValue?: number;
  /** Optional description */
  description?: string;
  /**
   * Metadata for grid/matrix variable sets.
   * Enables explicit row x column handling instead of monolithic processing.
   */
  gridMetadata?: {
    /** The shared scale used by all items in the grid (rows) */
    sharedScale: {
      valueLabels: Record<number, string>;
      type: VariableType;
      orderedStyle?: OrderedStyle;
      orderedScoring?: OrderedScoring;
    };
    /** Labels for the items being rated (columns) */
    itemLabels: string[];
    /** Maps variableId to its index in itemLabels */
    itemMapping: Record<string, number>;
  };
}

/** Folder for organizing variable sets. Flat structure (no nesting). */
export interface Folder {
  id: string;
  name: string;
  order: number;
}

export type DataTransform =
  | {
      type: 'recode';
      sourceColId: string;
      newColId: string;
      label: string;
      config: RecodeConfig;
      createdAt: number;
    };
