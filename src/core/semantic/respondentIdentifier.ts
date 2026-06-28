/**
 * Respondent identifier classification — keys for longitudinal linking,
 * excluded from auto crosstab / suggestion surfaces.
 *
 * Ref: design_06_semantic_layer.md (measurementIntent: identifier)
 */

import type { Variable, VariableSet } from '../../types';
import type { MeasurementIntent, SemanticAnnotation } from '../../types/semantic';
import { autoAnnotate, annotateVariable } from './annotator';
import { hasRespondentIdentifierName } from './identifierPatterns';

/** Intents never used for auto-populated crosstabs or empty-state suggestions */
export const AUTO_ANALYSIS_EXCLUDED_INTENTS: ReadonlySet<MeasurementIntent> = new Set([
  'weight',
  'identifier',
  'open_end',
]);

/** Near-unique codes relative to row count → likely respondent key */
export const RESPONDENT_ID_CARDINALITY_RATIO = 0.9;

export function resolveSemanticAnnotation(variable: Variable): SemanticAnnotation | null {
  return variable.semantic ?? annotateVariable(variable) ?? null;
}

/**
 * Respondent / case ID (not wave, date, or other temporal keys).
 */
export function isRespondentIdentifierVariable(variable: Variable): boolean {
  const annotation = resolveSemanticAnnotation(variable);
  if (annotation?.measurementIntent === 'identifier') {
    return annotation.temporalRole == null;
  }

  return hasRespondentIdentifierName(variable.name);
}

/**
 * Attach auto-annotated semantic metadata after ingest (CSV and similar).
 */
export function enrichVariablesWithSemantic(variables: Variable[], variableSets: VariableSet[]): Variable[] {
  const annotations = autoAnnotate(variables, variableSets);
  return variables.map((variable) => {
    const semantic = annotations.get(variable.id);
    return semantic ? { ...variable, semantic } : variable;
  });
}

/**
 * High-cardinality row keys (e.g. one category per respondent) — unsuitable for crosstab rows/cols.
 */
export function isHighCardinalityRowKey(variable: Variable, rowCount: number, distinctValueCount?: number): boolean {
  if (rowCount <= 0) return false;
  if (isRespondentIdentifierVariable(variable)) return true;

  const categoryCount = distinctValueCount ?? variable.valueLabels.length;
  if (categoryCount === 0) return false;

  return categoryCount >= rowCount * RESPONDENT_ID_CARDINALITY_RATIO;
}

/**
 * Exclude from auto crosstab, suggestion chips, and similar product defaults.
 */
export function isExcludedFromAutoAnalysis(
  variable: Variable,
  options?: { rowCount?: number; distinctValueCount?: number },
): boolean {
  if (variable.synthetic) return true;

  const annotation = resolveSemanticAnnotation(variable);
  if (annotation && AUTO_ANALYSIS_EXCLUDED_INTENTS.has(annotation.measurementIntent)) {
    return true;
  }

  if (hasRespondentIdentifierName(variable.name)) {
    return true;
  }

  if (options?.rowCount != null && isHighCardinalityRowKey(variable, options.rowCount, options.distinctValueCount)) {
    return true;
  }

  return false;
}
