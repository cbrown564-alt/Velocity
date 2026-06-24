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

export type { CanonicalVariableType, LegacyVariableType, OrderedScoring, OrderedStyle, VariableType } from './variableType';
export { allowsNumericStats, isCategoricalType, isOrderedType, normalizeVariableType } from './variableType';
export type { RecodeMode, RecodeRule, RecodeConfig } from './recode';
export type {
  ValueLabel,
  MissingValueDef,
  Variable,
  Dataset,
  VariableSet,
  Folder,
  DataTransform,
} from './dataset';
export type {
  AnalysisSettings,
  AnalysisEngine,
  ComparisonMethod,
  CorrectionType,
  Filter,
  TableConfig,
} from './analysis';

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
  /** Weighted sum of values: SUM(x * weight) - for exact variance decomposition */
  sumXW?: number;
  /** Weighted sum of squared values: SUM(x^2 * weight) - for exact variance decomposition */
  sumX2W?: number;
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
    adjustedPValue?: number;
    correctionMethod?: 'none' | 'bonferroni' | 'fdr';
    isOverlapCorrected?: boolean;
    effN: number;
  };
  /** 95% Confidence interval for mean or proportion */
  ci95?: { lower: number; upper: number };
  /** 80% Confidence interval for mean or proportion */
  ci80?: { lower: number; upper: number };
  /** Pairwise comparison letters (e.g., "BC" means significantly higher than columns B and C) */
  sigLetters?: string;
  /** Column letter for this cell's column (A, B, C, etc.) */
  columnLetter?: string;
}

/** Chi-square test result for categorical independence */
export interface ChiSquareResult {
  chiSquare: number;
  df: number;
  pValue: number;
  cramersV: number;
}

/** Table-level statistics (chi-square, etc.) */
export interface TableStats {
  chiSquare?: ChiSquareResult;
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
  variables: import('./dataset').Variable[];
  data: Respondent[];
}
