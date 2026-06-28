import type { HistogramBin } from '../../../types';
import type { CrosstabQueryOptions } from '../../sql/queryBuilder';
import type { ChiSquareResult } from '../../stats/statistics';
import type { Variable, VariableSet } from '../../../types';

/** Dynamic rowKey_N columns emitted by queryBuilder GROUP BY selectors. */
export type CrosstabRowKeyFields = Record<string, unknown>;

/**
 * Raw SQL row shape from crosstab queries before mapCrosstabRows normalization.
 * rowKey_0 … rowKey_N are populated by queryBuilder; additional fields vary by query mode.
 */
export interface CrosstabSqlRow extends CrosstabRowKeyFields {
  colKey?: unknown;
  count?: number;
  validCount?: number;
  weightedCount?: number;
  sumSqWeights?: number;
  sumXW?: number;
  sumX2W?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  histogramBins?: HistogramBin[];
  sig?: 'high_95' | 'high_80' | 'low_95' | 'low_80' | boolean;
  stats?: {
    tScore: number;
    pValue: number;
    adjustedPValue?: number;
    correctionMethod?: 'none' | 'bonferroni' | 'fdr';
    isOverlapCorrected?: boolean;
    effN: number;
  };
  ci95?: { lower: number; upper: number };
  ci80?: { lower: number; upper: number };
  sigLetters?: string;
  columnLetter?: string;
}

/** Overlap query rows (buildOverlapQuery). */
export interface CrosstabOverlapSqlRow extends CrosstabRowKeyFields {
  colKeyA?: unknown;
  colKeyB?: unknown;
  overlapCount?: number;
}

/** Histogram bin query rows (buildGridHistogramQuery / inline histogram SQL). */
export interface CrosstabHistogramBinSqlRow extends CrosstabRowKeyFields {
  colKey?: unknown;
  bucket?: number;
  cnt?: number;
}

export interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

export interface SignificanceOptions {
  comparisonMethod?: 'cell_vs_rest' | 'pairwise';
  correctionType?: 'none' | 'bonferroni' | 'fdr';
  significanceLevel?: 0.95 | 0.9 | 0.8;
}

export type CrosstabConfig = CrosstabQueryOptions & {
  includeDistributions?: boolean;
  significanceOptions?: SignificanceOptions;
  context: CrosstabContext;
};

export interface CrosstabResultData {
  rows: CrosstabSqlRow[];
  tableStats?: {
    chiSquare?: ChiSquareResult;
  };
}

export type CrosstabResult = CrosstabResultData;
