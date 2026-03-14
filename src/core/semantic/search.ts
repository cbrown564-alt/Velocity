/**
 * Semantic Search — Phase 4
 *
 * Finds variables by meaning, not just name. Uses token matching against
 * variable names, labels, topic annotations, concept names/aliases, and
 * value labels.
 *
 * Scoring: concept match (0.4) > topic match (0.3) > label keyword match (0.2) > name match (0.1)
 *
 * Ref: docs/design_phase4_semantic_layer.md §1.5
 */

import type { Variable } from '../../types';
import type { Concept, MeasurementIntent, SemanticAnnotation, SemanticSearchResult } from '../../types/semantic';

// ============================================================================
// Tokenizer
// ============================================================================

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function tokensOverlap(queryTokens: string[], targetText: string): boolean {
  const targetTokens = tokenize(targetText);
  return queryTokens.some((q) => targetTokens.some((t) => t.includes(q) || q.includes(t)));
}

function overlapScore(queryTokens: string[], targetText: string): number {
  const targetTokens = tokenize(targetText);
  if (targetTokens.length === 0) return 0;
  const matches = queryTokens.filter((q) => targetTokens.some((t) => t.includes(q) || q.includes(t)));
  return matches.length / queryTokens.length;
}

// ============================================================================
// Search Index Entry
// ============================================================================

export interface SearchEntry {
  variable: Variable;
  datasetId: string;
  annotation?: SemanticAnnotation;
  linkedConcepts: Concept[];
}

// ============================================================================
// Scorer
// ============================================================================

interface MatchDetail {
  score: number;
  matchedOn: string[];
}

function scoreEntry(entry: SearchEntry, queryTokens: string[]): MatchDetail {
  const matchedOn: string[] = [];
  let score = 0;

  // 1. Concept match (weight: 0.4) — highest signal
  for (const concept of entry.linkedConcepts) {
    const nameScore = overlapScore(queryTokens, concept.name);
    const aliasScore = Math.max(
      0,
      ...concept.aliases.map((a) => overlapScore(queryTokens, a))
    );
    const conceptScore = Math.max(nameScore, aliasScore);
    if (conceptScore > 0) {
      score = Math.max(score, 0.4 * conceptScore);
      if (!matchedOn.includes('concept')) matchedOn.push('concept');
    }
  }

  // 2. Topic annotation match (weight: 0.3)
  if (entry.annotation) {
    const topicScore = overlapScore(queryTokens, entry.annotation.topic.replace(/_/g, ' '));
    if (topicScore > 0) {
      score = Math.max(score, 0.3 * topicScore);
      if (!matchedOn.includes('topic')) matchedOn.push('topic');
    }

    // conceptFamily also contributes at topic weight
    if (entry.annotation.conceptFamily) {
      const familyScore = overlapScore(queryTokens, entry.annotation.conceptFamily);
      if (familyScore > 0) {
        score = Math.max(score, 0.3 * familyScore);
        if (!matchedOn.includes('topic')) matchedOn.push('topic');
      }
    }
  }

  // 3. Label keyword match (weight: 0.2)
  const labelScore = overlapScore(queryTokens, entry.variable.label || entry.variable.name);
  if (labelScore > 0) {
    score = Math.max(score, 0.2 * labelScore);
    if (!matchedOn.includes('label')) matchedOn.push('label');
  }

  // 4. Name match (weight: 0.1)
  const nameScore = overlapScore(queryTokens, entry.variable.name.replace(/_/g, ' '));
  if (nameScore > 0) {
    score = Math.max(score, 0.1 * nameScore);
    if (!matchedOn.includes('name')) matchedOn.push('name');
  }

  // 5. Value label match (bonus: +0.05 if any match)
  const vlText = entry.variable.valueLabels.map((vl) => vl.label).join(' ');
  if (vlText && tokensOverlap(queryTokens, vlText)) {
    score = Math.min(1, score + 0.05);
    if (!matchedOn.includes('valueLabel')) matchedOn.push('valueLabel');
  }

  // Boost for high-confidence annotations
  if (entry.annotation && entry.annotation.confidence >= 0.85 && matchedOn.length > 0) {
    score = Math.min(1, score * 1.1);
  }

  return { score, matchedOn };
}

// ============================================================================
// Public API
// ============================================================================

export interface SearchIndex {
  entries: SearchEntry[];
}

/**
 * Build a search index from variables, annotations, and concepts.
 * The index is cheap to build (in-memory, no persistence needed).
 */
export function buildSearchIndex(
  variables: Variable[],
  datasetId: string,
  annotations: Map<string, SemanticAnnotation>,
  concepts: Concept[]
): SearchIndex {
  const conceptsByVarId = new Map<string, Concept[]>();
  for (const concept of concepts) {
    for (const ref of concept.variableRefs) {
      if (ref.datasetId === datasetId) {
        const existing = conceptsByVarId.get(ref.variableId) ?? [];
        conceptsByVarId.set(ref.variableId, [...existing, concept]);
      }
    }
  }

  const entries: SearchEntry[] = variables.map((variable) => ({
    variable,
    datasetId,
    annotation: annotations.get(variable.id),
    linkedConcepts: conceptsByVarId.get(variable.id) ?? [],
  }));

  return { entries };
}

/**
 * Search variables by semantic meaning.
 *
 * @param query - Natural language query (e.g. "satisfaction variables")
 * @param index - Pre-built search index
 * @param limit - Maximum results to return (default: 20)
 * @returns Ranked list of matching variables with relevance scores
 */
export function searchVariables(
  query: string,
  index: SearchIndex,
  limit = 20
): SemanticSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) return [];

  const results: SemanticSearchResult[] = [];

  for (const entry of index.entries) {
    const { score, matchedOn } = scoreEntry(entry, queryTokens);
    if (score > 0) {
      results.push({
        variable: entry.variable,
        datasetId: entry.datasetId,
        relevance: Math.round(score * 1000) / 1000,
        matchedOn,
      });
    }
  }

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Multi-dataset search: accepts multiple indexes and merges results.
 */
export function searchVariablesAcrossDatasets(
  query: string,
  indexes: SearchIndex[],
  limit = 20
): SemanticSearchResult[] {
  const allResults: SemanticSearchResult[] = [];
  for (const index of indexes) {
    allResults.push(...searchVariables(query, index, limit));
  }
  return allResults
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

// ============================================================================
// Demographic name patterns for fallback classification
// ============================================================================

const DEMOGRAPHIC_NAME_PATTERNS =
  /\b(age|sex|gender|income|region|educ|marital|ethni|race|occupation|employ|hhinc|socio|class)\b/i;

/**
 * Filter variables by MeasurementIntent category.
 *
 * Primary path: returns variables whose annotation.measurementIntent matches.
 * Fallback path: when annotation coverage is below 50% or `includeUnannotated`
 * is true, uses type-based heuristics for demographic/classification categories.
 */
export function listVariablesByCategory(
  entries: SearchEntry[],
  category: MeasurementIntent,
  options?: { includeUnannotated?: boolean; limit?: number }
): SemanticSearchResult[] {
  const limit = options?.limit ?? 50;
  const results: SemanticSearchResult[] = [];

  // Count annotation coverage
  const annotatedCount = entries.filter((e) => e.annotation).length;
  const coverage = entries.length > 0 ? annotatedCount / entries.length : 0;
  const useFallback =
    options?.includeUnannotated === true ||
    coverage < 0.5;

  // Primary: annotated variables matching intent
  for (const entry of entries) {
    if (entry.annotation?.measurementIntent === category) {
      results.push({
        variable: entry.variable,
        datasetId: entry.datasetId,
        relevance: entry.annotation.confidence,
        matchedOn: ['category'],
      });
    }
  }

  // Fallback: type-based heuristic for demographic/classification
  if (useFallback && (category === 'demographic' || category === 'classification')) {
    const alreadyIncluded = new Set(results.map((r) => r.variable.id));
    for (const entry of entries) {
      if (alreadyIncluded.has(entry.variable.id)) continue;
      if (entry.annotation?.measurementIntent) continue; // already classified differently

      const v = entry.variable;
      const isCategorical =
        (v.type === 'nominal' || v.type === 'categorical' || v.type === 'ordinal') &&
        v.valueLabels.length >= 2 &&
        v.valueLabels.length <= 12;

      if (!isCategorical) continue;

      const nameLabel = `${v.name} ${v.label ?? ''}`;
      if (DEMOGRAPHIC_NAME_PATTERNS.test(nameLabel)) {
        results.push({
          variable: v,
          datasetId: entry.datasetId,
          relevance: 0.4, // low confidence fallback
          matchedOn: ['category:fallback'],
        });
      }
    }
  }

  // Sort by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, limit);
}
