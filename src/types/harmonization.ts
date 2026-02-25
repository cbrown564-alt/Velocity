/**
 * Harmonization Type Definitions
 *
 * Types for the cross-wave variable harmonization workspace.
 * Enables mapping variables across survey waves where question
 * wording, scales, and coding may drift over time.
 */

import type { VariableType } from './index';

// ============================================================================
// Scoring Types
// ============================================================================

/** Composite similarity score for a source→target variable pair */
export interface VariableMatchScore {
  /** Overall composite score (0–1) */
  total: number;
  /** Name/column similarity component */
  nameSimilarity: number;
  /** Label/question wording similarity component */
  labelSimilarity: number;
  /** Type compatibility component */
  typeMatch: number;
  /** Value label text overlap component */
  valueLabelOverlap: number;
}

/** Configurable weights for the matching algorithm */
export interface MatchingWeights {
  name: number;
  label: number;
  type: number;
  valueLabels: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  name: 0.2,
  label: 0.3,
  type: 0.2,
  valueLabels: 0.3,
};

// ============================================================================
// Warning Types
// ============================================================================

export type HarmonizationWarning =
  | { kind: 'scale_inversion'; sourceMin: number; sourceMax: number; targetMin: number; targetMax: number }
  | { kind: 'data_loss'; orphanValues: number[] }
  | { kind: 'type_mismatch'; sourceType: VariableType; targetType: VariableType }
  | { kind: 'missing_values_differ'; sourceHasMissing: boolean; targetHasMissing: boolean };

// ============================================================================
// Mapping Types
// ============================================================================

/** A single value-level mapping between source and target */
export interface ValueMapping {
  sourceValue: number | null;
  sourceLabel: string;
  targetValue: number | null;
  targetLabel: string;
}

/** Status of a variable-level mapping */
export type MappingStatus = 'auto_matched' | 'manual' | 'unmapped' | 'excluded';

/** One source→target variable pair mapping */
export interface VariableMapping {
  id: string;
  sourceVariableId: string;
  targetVariableId: string | null;
  status: MappingStatus;
  score: VariableMatchScore | null;
  valueMappings: ValueMapping[];
  warnings: HarmonizationWarning[];
  /** Whether the user has confirmed this mapping as correct */
  confirmed: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

/** A complete harmonization session linking two datasets */
export interface HarmonizationSession {
  id: string;
  sourceDatasetId: string;
  targetDatasetId: string;
  mappings: VariableMapping[];
  createdAt: number;
  updatedAt: number;
  /** Name of the output harmonized table in DuckDB */
  outputTableName: string | null;
}

// ============================================================================
// Sankey Visualization Types
// ============================================================================

/** A node in the Sankey diagram */
export interface SankeyNode {
  id: string;
  label: string;
  /** Number of respondents / frequency count */
  value: number;
  column: 'source' | 'target';
  isOrphan: boolean;
}

/** A flow link in the Sankey diagram */
export interface SankeyLink {
  sourceId: string;
  targetId: string;
  /** Flow width (typically overlap count) */
  value: number;
  /** True if the scales are inverted between source and target */
  isInverted: boolean;
}

/** Complete data structure for rendering the Sankey diagram */
export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ============================================================================
// Wave Detection Types
// ============================================================================

export interface WaveDetectionResult {
  isLikelyWave: boolean;
  confidence: number;
  matchedDatasetId: string | null;
  reason: string;
}
