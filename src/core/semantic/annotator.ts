/**
 * Heuristic Semantic Annotator — Phase 4
 *
 * Classifies variables using pattern-matching rules (no ML).
 * Runs O(n) after dataset load. Each rule assigns a confidence (0.5–0.95).
 * Multi-signal matches boost confidence.
 *
 * Ref: docs/design_phase4_semantic_layer.md §1.2
 */

import type { Variable, VariableSet } from '../../types';
import { normalizeVariableType } from '../../types';
import type { MeasurementIntent, SemanticAnnotation } from '../../types/semantic';

// ============================================================================
// Rule Helpers
// ============================================================================

function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normLabel(label: string): string {
  return label.toLowerCase();
}

/** Check if any value label text matches one of the given patterns (case-insensitive) */
function valueLabelsMatch(variable: Variable, patterns: RegExp[]): boolean {
  return variable.valueLabels.some((vl) =>
    patterns.some((p) => p.test(vl.label))
  );
}

/** Check if all value labels (with at least minCount labels) match a pattern set */
function allValueLabelsMatch(
  variable: Variable,
  patterns: RegExp[],
  minCount = 2
): boolean {
  if (variable.valueLabels.length < minCount) return false;
  return variable.valueLabels.every((vl) => patterns.some((p) => p.test(vl.label)));
}

function hasLikertLabels(variable: Variable): boolean {
  const likertPatterns = [
    /strongly\s+agree/i,
    /strongly\s+disagree/i,
    /agree/i,
    /disagree/i,
    /neither/i,
    /neutral/i,
    /strongly/i,
  ];
  return variable.valueLabels.some((vl) =>
    likertPatterns.some((p) => p.test(vl.label))
  );
}

function hasSatisfactionLabels(variable: Variable): boolean {
  return variable.valueLabels.some((vl) =>
    /satisf|dissatisf|happy|unhappy|pleased|displeas/i.test(vl.label)
  );
}

function hasAwarenessLabels(variable: Variable): boolean {
  const patterns = [/aware/i, /not\s+aware/i, /heard\s+of/i, /recall/i, /recogni/i];
  return variable.valueLabels.some((vl) => patterns.some((p) => p.test(vl.label)));
}

function hasBehaviorLabels(variable: Variable): boolean {
  const freqPatterns = [
    /never/i,
    /rarely/i,
    /sometimes/i,
    /often/i,
    /always/i,
    /daily/i,
    /weekly/i,
    /monthly/i,
    /every\s+day/i,
    /few\s+times/i,
  ];
  return variable.valueLabels.some((vl) => freqPatterns.some((p) => p.test(vl.label)));
}

function hasGenderLabels(variable: Variable): boolean {
  const genderPatterns = [/^male$/i, /^female$/i, /^m$/i, /^f$/i, /\bman\b/i, /\bwoman\b/i];
  return variable.valueLabels.some((vl) => genderPatterns.some((p) => p.test(vl.label.trim())));
}

function isLikertScale(variable: Variable): boolean {
  if (variable.valueLabels.length < 3) return false;
  return hasLikertLabels(variable);
}

function isNpsScale(variable: Variable): boolean {
  if (variable.valueLabels.length < 5) return false;
  const labels = variable.valueLabels.map((vl) => vl.label.toLowerCase());
  return (
    labels.some((l) => l.includes('recommend')) ||
    labels.some((l) => l.includes('likely'))
  );
}

// ============================================================================
// Name-Pattern Rules
// ============================================================================

const WEIGHT_NAME_PATTERNS = [
  /^wt$/i,
  /^wt_/i,
  /^weight$/i,
  /^weight_/i,
  /^w\d+$/i,
  /^fw\d*$/i,
  /^finalwt/i,
  /^sampleweight/i,
];

const IDENTIFIER_NAME_PATTERNS = [
  /^resp_?id$/i,
  /^respondent_?id$/i,
  /^caseid$/i,
  /^case_?no$/i,
  /^r_?no$/i,
  /^id$/i,
  /^respondentno$/i,
  /^sampleno$/i,
  /^serialno$/i,
  /^serial$/i,
];

const TEMPORAL_NAME_PATTERNS = [
  /^wave$/i,
  /^wave_?no$/i,
  /^wave_?id$/i,
  /^period$/i,
  /^month$/i,
  /^year$/i,
  /^quarter$/i,
  /^date$/i,
  /^timestamp$/i,
  /^survey_?date$/i,
  /^fielddate$/i,
  /^interview_?date$/i,
];

const DEMOGRAPHIC_LABEL_KEYWORDS = [
  /\bage\b/i,
  /\bgender\b/i,
  /\bsex\b/i,
  /\bincome\b/i,
  /\beducation\b/i,
  /\bregion\b/i,
  /\bcountry\b/i,
  /\bstate\b/i,
  /\bethni/i,
  /\brace\b/i,
  /\boccu/i,
  /\bemploy/i,
  /\bhousehold\b/i,
  /\bmarital\b/i,
];

/**
 * Health/clinical domain label keyword patterns.
 * Matches common survey instrument prefixes, scale names, and symptom labels.
 * Covers: ESS, HADS, PHQ, GAD, SF-36, WHOQOL, and generic clinical outcomes.
 */
const HEALTH_LABEL_KEYWORDS: RegExp[] = [
  // Named instruments — matched by variable name prefix or label
  /\bess\b/i,           // Epworth Sleepiness Scale
  /\bhads\b/i,          // Hospital Anxiety and Depression Scale
  /\bphq\b/i,           // Patient Health Questionnaire
  /\bgad\b/i,           // Generalised Anxiety Disorder scale
  /\bsf.?36\b/i,        // SF-36 health survey
  /\bwhoqol\b/i,        // WHO Quality of Life
  /\bsas\b/i,           // Zung Self-Rating Anxiety Scale

  // Symptom/outcome domains
  /\banxiet/i,
  /\bdepress/i,
  /\bfatigue\b/i,
  /\bstress/i,
  /\bpain\b/i,
  /\binsomni/i,
  /\bsleepless/i,

  // Sleep-specific
  /\bsleep\b/i,
  /\bsleepy/i,
  /\bdrowsy/i,
  /\bsomnolen/i,
  /\bslumber\b/i,

  // Quality of life / wellbeing
  /\bwellbeing\b/i,
  /\bquality\s+of\s+life\b/i,
  /\bqol\b/i,
  /\bhealth\s+status\b/i,

  // Functional status
  /\bfunction/i,
  /\bdisabilit/i,
  /\bimpairment\b/i,
];

const HEALTH_NAME_PATTERNS: RegExp[] = [
  /^ess\d*/i,
  /^hads/i,
  /^phq\d*/i,
  /^gad\d*/i,
  /^sf\d+/i,
  /^qol/i,
  /^sleep/i,
  /^anxiet/i,
  /^depress/i,
  /^fatigue/i,
  /^stress/i,
  /^niteshft$/i,          // night-shift (common in sleep studies)
  /^quals?leep/i,         // quality sleep
  /^satissleep/i,         // satisfied with sleep
  /^trouble.*(sleep|fall|stay)/i,
  /^hours.*(sleep|bed|night)/i,
];

const CLASSIFICATION_NAME_PATTERNS = [
  /^brand/i,
  /^product/i,
  /^category/i,
  /^segment/i,
  /^type/i,
  /^cat_/i,
  /^seg_/i,
];

// ============================================================================
// Single-variable Annotation
// ============================================================================

interface RuleMatch {
  intent: MeasurementIntent;
  topic: string;
  conceptFamily?: string;
  confidence: number;
  temporalRole?: SemanticAnnotation['temporalRole'];
}

function detectAnnotation(variable: Variable, inGridSet: boolean): RuleMatch | null {
  const name = normName(variable.name);
  const label = normLabel(variable.label || variable.name);

  // Rule 1 — Weight
  if (WEIGHT_NAME_PATTERNS.some((p) => p.test(variable.name))) {
    return { intent: 'weight', topic: 'sampling_weight', confidence: 0.95 };
  }

  // Rule 2 — Identifier
  if (IDENTIFIER_NAME_PATTERNS.some((p) => p.test(variable.name))) {
    return { intent: 'identifier', topic: 'respondent_id', confidence: 0.9 };
  }

  // Rule 9 — Temporal / date (name pattern)
  if (TEMPORAL_NAME_PATTERNS.some((p) => p.test(variable.name))) {
    const role: SemanticAnnotation['temporalRole'] =
      /wave/i.test(variable.name) ? 'wave_id' :
      /date|timestamp/i.test(variable.name) ? 'timestamp' : 'period';
    return { intent: 'identifier', topic: 'temporal', confidence: 0.85, temporalRole: role };
  }

  // Rule 8 — Open-ended text
  const normalType = normalizeVariableType(variable.type);
  const isNumeric = normalType === 'numeric';
  if (!isNumeric && variable.valueLabels.length === 0) {
    return { intent: 'open_end', topic: 'open_ended', confidence: 0.8 };
  }

  let confidence = 0;
  let intent: MeasurementIntent = 'other';
  let topic = 'general';
  let conceptFamily: string | undefined;

  // Rule 3 — Gender value labels
  if (hasGenderLabels(variable)) {
    confidence = Math.max(confidence, 0.9);
    intent = 'demographic';
    topic = 'demographics';
    conceptFamily = 'gender';
  }

  // Rule 4 — Likert scale
  if (isLikertScale(variable)) {
    const boost = inGridSet ? 0.15 : 0;
    confidence = Math.max(confidence, 0.75 + boost);
    intent = 'attitude';
    topic = hasSatisfactionLabels(variable) ? 'satisfaction' : 'attitude_scale';
    if (topic === 'satisfaction') conceptFamily = 'satisfaction';
  }

  // NPS variant
  if (isNpsScale(variable)) {
    confidence = Math.max(confidence, 0.85);
    intent = 'attitude';
    topic = 'nps';
    conceptFamily = 'nps';
  }

  // Rule 5 — Binary awareness labels
  if (hasAwarenessLabels(variable) && variable.valueLabels.length <= 4) {
    confidence = Math.max(confidence, 0.8);
    intent = 'awareness';
    topic = 'brand_awareness';
  }

  // Rule 5b — Behavior / frequency labels
  if (hasBehaviorLabels(variable)) {
    confidence = Math.max(confidence, 0.75);
    intent = 'behavior';
    topic = 'behavior_frequency';
  }

  // Rule 6 — Label keyword matching for satisfaction/attitude
  if (DEMOGRAPHIC_LABEL_KEYWORDS.some((p) => p.test(label))) {
    confidence = Math.max(confidence, 0.7);
    intent = 'demographic';
    topic = 'demographics';
  }

  if (/satisf|dissatisf/i.test(label)) {
    confidence = Math.max(confidence, 0.7);
    intent = 'attitude';
    topic = 'satisfaction';
    conceptFamily = 'satisfaction';
  }

  if (/aware|recall|recogni/i.test(label)) {
    confidence = Math.max(confidence, 0.65);
    intent = intent === 'other' ? 'awareness' : intent;
    topic = topic === 'general' ? 'brand_awareness' : topic;
  }

  if (/recommend|nps|net\s+promoter/i.test(label)) {
    confidence = Math.max(confidence, 0.8);
    intent = 'attitude';
    topic = 'nps';
    conceptFamily = 'nps';
  }

  // Rule 7 — Grid sets with rating scale
  if (inGridSet && isLikertScale(variable)) {
    confidence = Math.min(1, confidence + 0.1);
  }

  // Classification patterns
  if (CLASSIFICATION_NAME_PATTERNS.some((p) => p.test(variable.name))) {
    if (confidence < 0.6) {
      confidence = 0.6;
      intent = 'classification';
      topic = 'brand_classification';
    }
  }

  // Rule 10 — Health/clinical domain (name pattern or label keyword)
  // Fires at lower confidence so domain-specific rules can still override.
  const healthNameMatch = HEALTH_NAME_PATTERNS.some((p) => p.test(variable.name));
  const healthLabelMatch = HEALTH_LABEL_KEYWORDS.some((p) => p.test(label));
  if (healthNameMatch || healthLabelMatch) {
    const healthConfidence = healthNameMatch ? 0.72 : 0.65;
    if (confidence < healthConfidence) {
      confidence = healthConfidence;
      intent = 'attitude';
      topic = 'health_wellbeing';
    }
  }

  if (confidence < 0.5) return null;

  return { intent, topic, conceptFamily, confidence };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run heuristic annotation over all variables in a dataset.
 * Returns a Map of variableId → SemanticAnnotation.
 *
 * Only variables that match at least one rule are annotated.
 */
export function autoAnnotate(
  variables: Variable[],
  variableSets: VariableSet[]
): Map<string, SemanticAnnotation> {
  // Build a set of variable IDs that are in grid VariableSets
  const gridVariableIds = new Set<string>();
  for (const vs of variableSets) {
    if (vs.structure === 'grid') {
      for (const vid of vs.variableIds) {
        gridVariableIds.add(vid);
      }
    }
  }

  const annotations = new Map<string, SemanticAnnotation>();

  for (const variable of variables) {
    const inGrid = gridVariableIds.has(variable.id);
    const match = detectAnnotation(variable, inGrid);
    if (!match) continue;

    const annotation: SemanticAnnotation = {
      topic: match.topic,
      measurementIntent: match.intent,
      conceptFamily: match.conceptFamily,
      source: 'auto',
      confidence: Math.round(match.confidence * 100) / 100,
      ...(match.temporalRole !== undefined ? { temporalRole: match.temporalRole } : {}),
    };

    annotations.set(variable.id, annotation);
  }

  return annotations;
}

/**
 * Annotate a single variable without the full dataset context.
 * Useful for post-load updates or manual triggers.
 */
export function annotateVariable(variable: Variable, inGrid = false): SemanticAnnotation | null {
  const match = detectAnnotation(variable, inGrid);
  if (!match) return null;

  return {
    topic: match.topic,
    measurementIntent: match.intent,
    conceptFamily: match.conceptFamily,
    source: 'auto',
    confidence: Math.round(match.confidence * 100) / 100,
    ...(match.temporalRole !== undefined ? { temporalRole: match.temporalRole } : {}),
  };
}
