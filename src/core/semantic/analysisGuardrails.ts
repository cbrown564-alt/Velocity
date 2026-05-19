/**
 * Product-default guardrails for agent analysis (S4-DEF-1).
 *
 * Surfaces false-positive weight detection and high-cardinality crosstab warnings.
 * Pure logic — no engine or transport dependencies.
 */

import type { Variable } from '../../types';
import type { SemanticAnnotation } from '../../types/semantic';
import { hasWeightLikeName } from './weightPatterns';

/** Warn when row variables exceed this many value labels. */
export const HIGH_CARDINALITY_ROW_THRESHOLD = 20;

/** Warn when column variables exceed this many value labels. */
export const HIGH_CARDINALITY_COL_THRESHOLD = 12;

const MEASUREMENT_WEIGHT_LABEL_PATTERNS = [
  /\bbody\s*weight\b/i,
  /\bcurrent\s+weight\b/i,
  /\bweight\s*\(kg\)/i,
  /\bweight\s*\(lb/i,
  /\bpounds?\b/i,
  /\bkilograms?\b/i,
];

const SURVEY_WEIGHT_NAME_PATTERNS = [
  /^wt$/i,
  /^wt_/i,
  /^fw\d*$/i,
  /^finalwt/i,
  /^sampleweight/i,
  /factor/i,
  /weightvar/i,
];

function labelText(variable: Variable): string {
  return `${variable.name} ${variable.label ?? ''}`.trim();
}

/**
 * True when a weight-like name likely refers to a respondent measurement
 * (e.g. body weight in sleep.sav) rather than a sampling weight.
 */
export function isLikelyMeasurementWeight(
  variable: Variable,
  annotation?: SemanticAnnotation
): boolean {
  if (!hasWeightLikeName(variable.name)) {
    return false;
  }

  const label = labelText(variable);

  if (MEASUREMENT_WEIGHT_LABEL_PATTERNS.some((pattern) => pattern.test(label))) {
    return true;
  }

  // EVAL-01 pitfall: bare "weight", numeric, no value labels — anthropometric, not WtFactor-style weight.
  if (
    /^weight$/i.test(variable.name) &&
    variable.type === 'numeric' &&
    variable.valueLabels.length === 0 &&
    !SURVEY_WEIGHT_NAME_PATTERNS.some((pattern) => pattern.test(variable.name))
  ) {
    return true;
  }

  // Auto-annotated as sampling weight but naming/typing look like a measurement field.
  if (
    annotation?.measurementIntent === 'weight' &&
    annotation.topic === 'sampling_weight' &&
    variable.type === 'numeric' &&
    variable.valueLabels.length === 0 &&
    /^weight$/i.test(variable.name)
  ) {
    return true;
  }

  return false;
}

export function warnMisclassifiedWeight(
  variable: Variable,
  annotation?: SemanticAnnotation,
  context?: 'weight_selection' | 'annotation'
): string | null {
  if (!isLikelyMeasurementWeight(variable, annotation)) {
    return null;
  }

  const display = variable.label || variable.name;
  if (context === 'weight_selection') {
    return `"${display}" has a weight-like name but appears to be a respondent measurement (e.g. body weight), not a sampling weight. Do not use it as weightVar — search for variables named wt, WtFactor, or sampleweight instead.`;
  }

  return `"${display}" has a weight-like name but appears to be a respondent measurement (e.g. body weight), not a sampling weight. It was auto-annotated as a weight variable; verify before using as weightVar.`;
}

export function warnHighCardinality(
  variable: Variable,
  role: 'row' | 'col'
): string | null {
  const categoryCount = variable.valueLabels.length;
  const threshold =
    role === 'row' ? HIGH_CARDINALITY_ROW_THRESHOLD : HIGH_CARDINALITY_COL_THRESHOLD;

  if (categoryCount > threshold) {
    const display = variable.label || variable.name;
    return `High cardinality (${categoryCount} categories): "${display}" as a ${role} variable may produce sparse or unreadable cross-tabs. Look for a condensed version with fewer categories.`;
  }

  if (categoryCount === 0 && (variable.type === 'numeric' || variable.type === 'scale')) {
    const display = variable.label || variable.name;
    if (role === 'row') {
      return `"${display}" is continuous numeric with no value labels — crosstab rows may be sparse or unreadable. Consider recoding into bands or using velocity_describe_variable first.`;
    }
    return `"${display}" is continuous numeric with no value labels — using it as a column break may produce an unusable table. Prefer a categorical break variable.`;
  }

  return null;
}

export interface CrosstabGuardrailInput {
  rowVars: Variable[];
  colVar: Variable | null;
  weightVar: Variable | null;
  getAnnotation: (variableId: string) => SemanticAnnotation | undefined;
}

/**
 * Collect non-fatal warnings for a planned crosstab configuration.
 */
export function collectCrosstabWarnings(input: CrosstabGuardrailInput): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  const push = (message: string | null) => {
    if (message && !seen.has(message)) {
      seen.add(message);
      warnings.push(message);
    }
  };

  if (input.weightVar) {
    push(
      warnMisclassifiedWeight(
        input.weightVar,
        input.getAnnotation(input.weightVar.id),
        'weight_selection'
      )
    );
  }

  for (const rowVar of input.rowVars) {
    push(warnHighCardinality(rowVar, 'row'));
    push(
      warnMisclassifiedWeight(rowVar, input.getAnnotation(rowVar.id), 'annotation')
    );
  }

  if (input.colVar) {
    push(warnHighCardinality(input.colVar, 'col'));
  }

  return warnings;
}

/**
 * Warnings to surface when suggesting breaks for a topic (row) variable.
 */
export function collectTopicGuidanceWarnings(
  topicVariable: Variable,
  annotation?: SemanticAnnotation
): string[] {
  const warnings: string[] = [];
  const cardinality = warnHighCardinality(topicVariable, 'row');
  if (cardinality) {
    warnings.push(cardinality);
  }
  const weight = warnMisclassifiedWeight(topicVariable, annotation, 'annotation');
  if (weight) {
    warnings.push(weight);
  }
  return warnings;
}
