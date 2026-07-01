/**
 * Analysis configuration types shared across session, store, and engine.
 * Kept separate from Redux slices so core/session stays decoupled from store.
 */

export interface TableConfig {
  rowVars: string[];
  colVar: string | null;
  /** Human-readable row labels persisted for welcome-back when variable catalog is absent */
  rowVarLabels?: string[];
  /** Human-readable column label persisted for welcome-back when variable catalog is absent */
  colVarLabel?: string | null;
}

export type ComparisonMethod = 'cell_vs_rest' | 'pairwise';
export type CorrectionType = 'none' | 'bonferroni' | 'fdr';
export type AnalysisEngine = 'auto' | 'duckdb' | 'webr';

export interface AnalysisSettings {
  comparisonMethod: ComparisonMethod;
  correctionType: CorrectionType;
  showConfidenceIntervals: boolean;
  significanceLevel: 0.95 | 0.9 | 0.8;
  /** Analysis engine selection: auto selects WebR for design effects/mixed models */
  engine: AnalysisEngine;
  /** Enable design effect calculation (requires WebR) */
  enableDesignEffects: boolean;
}

export interface Filter {
  id: string;
  variableId: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
  value: number | string | (number | string)[];
}
