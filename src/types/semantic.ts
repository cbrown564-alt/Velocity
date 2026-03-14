/**
 * Semantic Layer Types — Phase 4
 *
 * Enriches variables with semantic annotations, enables concept entities for
 * cross-dataset linking, and powers semantic search and domain-aware suggestions.
 *
 * Ref: docs/design_phase4_semantic_layer.md
 */

// ============================================================================
// Measurement Intent
// ============================================================================

export type MeasurementIntent =
  | 'attitude'       // Likert scales, satisfaction, NPS
  | 'behavior'       // Frequency, purchase, usage
  | 'awareness'      // Aided/unaided awareness, recall
  | 'demographic'    // Age, gender, income, region
  | 'classification' // Brand, product, category
  | 'outcome'        // Dependent variables, KPIs
  | 'weight'         // Sampling weights
  | 'identifier'     // Respondent ID, case number
  | 'open_end'       // Free-text responses
  | 'other';         // Uncategorized

// ============================================================================
// Semantic Annotation
// ============================================================================

export interface SemanticAnnotation {
  /** Domain topic, e.g. "brand_perception", "demographics", "media_consumption" */
  topic: string;
  /** Measurement intent classification */
  measurementIntent: MeasurementIntent;
  /** Links to a Concept entity by name, e.g. "satisfaction" */
  conceptFamily?: string;

  // Provenance
  /** How this annotation was created */
  source: 'auto' | 'manual' | 'agent';
  /** Confidence score 0–1 for auto-detected annotations */
  confidence: number;

  // Relationships
  /** IDs of semantically related variables */
  relatedVariables?: string[];
  /** Role in time/wave structure */
  temporalRole?: 'wave_id' | 'timestamp' | 'period' | null;
}

// ============================================================================
// Concept Entity
// ============================================================================

export interface ConceptVariableRef {
  datasetId: string;
  variableId: string;
  /** For longitudinal linking */
  waveId?: string;
  matchConfidence: number;
}

export interface Concept {
  id: string;
  name: string;
  /** Alternative names across datasets (enables synonym expansion in search) */
  aliases: string[];
  /** Expected measurement properties for this concept */
  canonicalScale?: {
    points: number;
    direction: 'ascending' | 'descending';
    anchors?: { low: string; high: string };
  };
  variableRefs: ConceptVariableRef[];
}

// ============================================================================
// Semantic Search
// ============================================================================

export interface SemanticSearchResult {
  variable: import('./index').Variable;
  datasetId: string;
  /** 0–1 match score */
  relevance: number;
  /** What matched: "topic", "label", "concept", "name", "alias", "valueLabel" */
  matchedOn: string[];
}

// ============================================================================
// Analysis Suggestions
// ============================================================================

export interface AnalysisSuggestion {
  analysisType: string;
  config: Record<string, unknown>;
  /** Human-readable rationale for the suggestion */
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HarmonizationSuggestion {
  concept: Concept;
  variables: ConceptVariableRef[];
  confidence: number;
  rationale: string;
}

export interface BreakSuggestion {
  variable: import('./index').Variable;
  score: number;       // 0–1 suitability
  rationale: string;
}

// ============================================================================
// Session Format v2
// ============================================================================

export interface SemanticSessionBlock {
  /** variableId → annotation */
  annotations: Record<string, SemanticAnnotation>;
  concepts: Concept[];
}
