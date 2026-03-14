/**
 * Domain-Aware Analysis Suggestions — Phase 4
 *
 * Rule-based analysis and harmonization suggestions derived from
 * semantic annotations. No ML dependency; pure heuristics.
 *
 * Ref: docs/design_phase4_semantic_layer.md §1.6
 */

import type { Variable } from '../../types';
import type {
  AnalysisSuggestion,
  BreakSuggestion,
  Concept,
  HarmonizationSuggestion,
  SemanticAnnotation,
} from '../../types/semantic';

// ============================================================================
// Analysis Suggestions
// ============================================================================

export interface AnnotatedVar {
  variable: Variable;
  annotation?: SemanticAnnotation;
}

/**
 * Suggest analyses given a set of variable IDs and their annotations.
 * Returns suggestions ranked by priority.
 */
/**
 * Return true if a variable's type suggests it is categorical/demographic
 * even when semantic annotation is absent. Used as a fallback for unannotated
 * datasets so the suggestion engine can still produce crosstab recommendations.
 */
function isCategoricalByType(v: AnnotatedVar): boolean {
  const t = v.variable.type;
  // nominal/categorical types with value labels are almost always cross-break candidates
  return (
    (t === 'nominal' || t === 'categorical' || t === 'ordinal') &&
    v.variable.valueLabels.length > 0 &&
    v.variable.valueLabels.length <= 12  // avoid high-cardinality open-codes
  );
}

export function suggestAnalyses(annotatedVars: AnnotatedVar[]): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];

  const attitudes = annotatedVars.filter(
    (v) => v.annotation?.measurementIntent === 'attitude'
  );
  const demographics = annotatedVars.filter(
    (v) => v.annotation?.measurementIntent === 'demographic'
  );
  const behaviors = annotatedVars.filter(
    (v) => v.annotation?.measurementIntent === 'behavior'
  );
  const temporal = annotatedVars.filter(
    (v) => v.annotation?.temporalRole != null && v.annotation.temporalRole !== null
  );
  const weights = annotatedVars.filter(
    (v) => v.annotation?.measurementIntent === 'weight'
  );
  const identifiers = annotatedVars.filter(
    (v) => v.annotation?.measurementIntent === 'identifier'
  );

  // ── Crosstab-first fallback for unannotated or sparsely-annotated datasets ──
  // When annotation coverage is low, use variable type to detect a potential
  // cross-break variable and generate a crosstab suggestion regardless of annotation.
  // This ensures agents get actionable output even before semantic enrichment.
  const unannotated = annotatedVars.filter((v) => !v.annotation);
  if (unannotated.length > 0 && (attitudes.length === 0 || demographics.length === 0)) {
    const categoricals = annotatedVars.filter(isCategoricalByType);
    const nonCategoricals = annotatedVars.filter(
      (v) => !isCategoricalByType(v) && v.annotation?.measurementIntent !== 'identifier' && v.annotation?.measurementIntent !== 'weight'
    );

    if (categoricals.length > 0 && nonCategoricals.length > 0) {
      const breakVar = categoricals[0].variable;
      const outcomeVars = nonCategoricals.slice(0, 3).map((v) => v.variable.id);
      suggestions.push({
        analysisType: 'crosstab',
        config: { rowVars: outcomeVars, colVar: breakVar.id },
        rationale: `Crosstab: outcomes by "${breakVar.label || breakVar.name}" (type-based fallback — annotate variables for richer suggestions).`,
        priority: 'high',
      });
    }
  }

  // Attitude × Demographic → crosstab
  if (attitudes.length > 0 && demographics.length > 0) {
    for (const att of attitudes) {
      const demVar = demographics[0].variable;
      suggestions.push({
        analysisType: 'crosstab',
        config: { rowVars: [att.variable.id], colVar: demVar.id },
        rationale: `Compare attitude scale "${att.variable.label || att.variable.name}" across demographic "${demVar.label || demVar.name}".`,
        priority: 'high',
      });
    }
  }

  // Two attitudes → correlation / top-2-box comparison
  if (attitudes.length >= 2) {
    suggestions.push({
      analysisType: 'crosstab',
      config: {
        rowVars: attitudes.slice(0, 3).map((a) => a.variable.id),
        colVar: null,
      },
      rationale: `Compare ${attitudes.length} attitude scales side-by-side.`,
      priority: 'high',
    });
  }

  // NPS-specific
  const nps = attitudes.filter((a) => a.annotation?.topic === 'nps');
  if (nps.length > 0 && demographics.length > 0) {
    suggestions.push({
      analysisType: 'crosstab',
      config: { rowVars: [nps[0].variable.id], colVar: demographics[0].variable.id },
      rationale: `NPS breakdown by ${demographics[0].variable.label || demographics[0].variable.name}.`,
      priority: 'high',
    });
  }

  // Behavior × Demographic → frequency analysis
  if (behaviors.length > 0 && demographics.length > 0) {
    suggestions.push({
      analysisType: 'crosstab',
      config: {
        rowVars: [behaviors[0].variable.id],
        colVar: demographics[0].variable.id,
      },
      rationale: `Behavior frequency "${behaviors[0].variable.label || behaviors[0].variable.name}" by ${demographics[0].variable.label || demographics[0].variable.name}.`,
      priority: 'medium',
    });
  }

  // Temporal variable → trend / wave comparison
  if (temporal.length > 0 && attitudes.length > 0) {
    suggestions.push({
      analysisType: 'crosstab',
      config: {
        rowVars: [attitudes[0].variable.id],
        colVar: temporal[0].variable.id,
      },
      rationale: `Trend analysis: "${attitudes[0].variable.label || attitudes[0].variable.name}" over time/wave.`,
      priority: 'medium',
    });
  }

  // Weighted analysis recommendation
  if (weights.length > 0 && attitudes.length > 0) {
    suggestions.push({
      analysisType: 'crosstab',
      config: {
        rowVars: attitudes.map((a) => a.variable.id),
        colVar: null,
        weightVar: weights[0].variable.id,
      },
      rationale: `Apply sampling weight "${weights[0].variable.label || weights[0].variable.name}" to attitude analysis.`,
      priority: 'medium',
    });
  }

  // Single variable distributions
  for (const v of annotatedVars) {
    if (identifiers.some((i) => i.variable.id === v.variable.id)) continue;
    if (weights.some((w) => w.variable.id === v.variable.id)) continue;
    suggestions.push({
      analysisType: 'variableStats',
      config: { column: v.variable.id },
      rationale: `Frequency distribution for "${v.variable.label || v.variable.name}".`,
      priority: 'low',
    });
  }

  return deduplicate(suggestions);
}

function deduplicate(suggestions: AnalysisSuggestion[]): AnalysisSuggestion[] {
  const seen = new Set<string>();
  const result: AnalysisSuggestion[] = [];
  for (const s of suggestions) {
    const key = JSON.stringify({ type: s.analysisType, config: s.config });
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  // Sort: high > medium > low
  const order = { high: 0, medium: 1, low: 2 };
  return result.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ============================================================================
// Harmonization Suggestions
// ============================================================================

/**
 * Suggest cross-dataset harmonizations based on shared concepts.
 * Variables linked to the same concept across different datasets
 * are strong harmonization candidates.
 */
export function suggestHarmonizations(concepts: Concept[]): HarmonizationSuggestion[] {
  const suggestions: HarmonizationSuggestion[] = [];

  for (const concept of concepts) {
    // Only suggest if variables span multiple datasets
    const datasetIds = new Set(concept.variableRefs.map((r) => r.datasetId));
    if (datasetIds.size < 2) continue;

    const avgConfidence =
      concept.variableRefs.reduce((sum, r) => sum + r.matchConfidence, 0) /
      concept.variableRefs.length;

    // Build rationale
    const byDataset = new Map<string, string[]>();
    for (const ref of concept.variableRefs) {
      const existing = byDataset.get(ref.datasetId) ?? [];
      byDataset.set(ref.datasetId, [...existing, ref.variableId]);
    }
    const parts = Array.from(byDataset.entries()).map(
      ([ds, vars]) => `${vars.join(', ')} in ${ds}`
    );

    const scaleDesc = concept.canonicalScale
      ? ` on ${concept.canonicalScale.points}-point scale`
      : '';

    suggestions.push({
      concept,
      variables: concept.variableRefs,
      confidence: Math.round(avgConfidence * 100) / 100,
      rationale: `${parts.join(' and ')} both measure "${concept.name}"${scaleDesc}.`,
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// Break Variable Suggestions
// ============================================================================

const BREAK_NAME_PATTERNS =
  /\b(age|sex|gender|region|income|education|educ|marital|ethni|race|occupation|employ|hhinc|socio|class)\b/i;

const EXCLUDED_INTENTS = new Set<string>(['weight', 'identifier', 'open_end']);

/**
 * Given a topic variable, recommends good cross-break variables.
 * Uses annotation-based heuristics (no ML).
 */
export function suggestBreaks(
  topicVariable: AnnotatedVar,
  allVars: AnnotatedVar[],
  options?: { limit?: number }
): BreakSuggestion[] {
  const limit = options?.limit ?? 5;
  const results: BreakSuggestion[] = [];

  for (const candidate of allVars) {
    // Exclude: same variable as topic
    if (candidate.variable.id === topicVariable.variable.id) continue;

    // Exclude: weight, identifier, open_end intents
    const intent = candidate.annotation?.measurementIntent;
    if (intent && EXCLUDED_INTENTS.has(intent)) continue;

    let score = 0;
    const reasons: string[] = [];

    // demographic intent → +0.5
    if (intent === 'demographic') {
      score += 0.5;
      reasons.push('demographic variable');
    }

    // classification intent → +0.3
    if (intent === 'classification') {
      score += 0.3;
      reasons.push('classification variable');
    }

    // Cardinality scoring
    const cardinality = candidate.variable.valueLabels.length;
    if (cardinality >= 2 && cardinality <= 8) {
      score += 0.2;
      reasons.push(`good cardinality (${cardinality} values)`);
    } else if (cardinality >= 9 && cardinality <= 12) {
      score += 0.1;
      reasons.push(`acceptable cardinality (${cardinality} values)`);
    }

    // Name matches common break patterns → +0.15
    const nameLabel = `${candidate.variable.name} ${candidate.variable.label ?? ''}`;
    if (BREAK_NAME_PATTERNS.test(nameLabel)) {
      score += 0.15;
      reasons.push('name matches common break pattern');
    }

    if (score > 0) {
      results.push({
        variable: candidate.variable,
        score: Math.round(Math.min(1, score) * 1000) / 1000,
        rationale: reasons.join('; '),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
