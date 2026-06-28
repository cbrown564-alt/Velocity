/**
 * Harmonization Match Engine
 *
 * Pure functions for scoring and auto-matching variables across waves.
 * Zero browser dependencies — fully testable in Node.js.
 */

import type {
  VariableMatchScore,
  MatchingWeights,
  VariableMapping,
  ValueMapping,
  HarmonizationWarning,
  MappingStatus,
} from '../../types/harmonization';
import { DEFAULT_MATCHING_WEIGHTS } from '../../types/harmonization';
import type { Variable, ValueLabel, VariableType } from '../../types/index';
import { normalizeVariableType } from '../../types/index';

// ============================================================================
// String Similarity
// ============================================================================

/**
 * Jaro-Winkler similarity for short variable names.
 * Returns a value in [0, 1] where 1 = identical.
 */
export function jaroWinklerSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix boost
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ============================================================================
// Value Label Overlap
// ============================================================================

/**
 * Jaccard coefficient on label text (case-insensitive).
 * Returns a value in [0, 1].
 */
export function valueLabelOverlap(a: ValueLabel[], b: ValueLabel[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map((v) => v.label.toLowerCase().trim()));
  const setB = new Set(b.map((v) => v.label.toLowerCase().trim()));

  let intersection = 0;
  for (const label of setA) {
    if (setB.has(label)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============================================================================
// Type Compatibility
// ============================================================================

/**
 * Returns compatibility score between two variable types.
 * 1.0 = same type, 0.5 = compatible, 0.0 = incompatible
 */
export function typeCompatibility(a: VariableType, b: VariableType): number {
  const normalizedA = normalizeVariableType(a);
  const normalizedB = normalizeVariableType(b);
  if (normalizedA === normalizedB) return 1.0;

  const compatiblePairs: Array<[typeof normalizedA, typeof normalizedB]> = [
    ['categorical', 'ordered'],
    ['ordered', 'categorical'],
    ['ordered', 'numeric'],
    ['numeric', 'ordered'],
  ];

  for (const [x, y] of compatiblePairs) {
    if (normalizedA === x && normalizedB === y) return 0.5;
  }

  return 0.0;
}

// ============================================================================
// Scale Inversion Detection
// ============================================================================

/**
 * Detects whether a Likert scale has been inverted between source and target.
 * E.g. 1=Strongly Agree → 1=Strongly Disagree
 */
export function detectScaleInversion(source: Variable, target: Variable): boolean {
  const srcLabels = source.valueLabels;
  const tgtLabels = target.valueLabels;

  if (srcLabels.length < 2 || tgtLabels.length < 2) return false;
  if (srcLabels.length !== tgtLabels.length) return false;

  const srcSorted = [...srcLabels].sort((a, b) => a.value - b.value);
  const tgtSorted = [...tgtLabels].sort((a, b) => a.value - b.value);

  const srcFirst = srcSorted[0].label.toLowerCase().trim();
  const srcLast = srcSorted[srcSorted.length - 1].label.toLowerCase().trim();
  const tgtFirst = tgtSorted[0].label.toLowerCase().trim();
  const tgtLast = tgtSorted[tgtSorted.length - 1].label.toLowerCase().trim();

  const firstMatchesFirst = jaroWinklerSimilarity(srcFirst, tgtFirst);
  const firstMatchesLast = jaroWinklerSimilarity(srcFirst, tgtLast);
  const lastMatchesFirst = jaroWinklerSimilarity(srcLast, tgtFirst);

  // Inversion: cross-matching must be strong AND forward-matching must be weaker
  // This prevents false positives when "Very Dissatisfied" ≈ "Very Satisfied" lexically
  return firstMatchesLast > 0.8 && lastMatchesFirst > 0.8 && firstMatchesFirst < firstMatchesLast;
}

// ============================================================================
// Data Loss Detection
// ============================================================================

/**
 * Returns source values that have no corresponding target mapping.
 */
export function detectDataLoss(source: Variable, target: Variable): number[] {
  if (source.valueLabels.length === 0) return [];

  const targetValues = new Set(target.valueLabels.map((v) => v.value));
  return source.valueLabels.filter((v) => !targetValues.has(v.value)).map((v) => v.value);
}

// ============================================================================
// Pair Scoring
// ============================================================================

/**
 * Computes a composite match score for a source→target variable pair.
 */
export function scoreVariablePair(
  source: Variable,
  target: Variable,
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS,
): VariableMatchScore {
  const nameSimilarity = jaroWinklerSimilarity(source.name, target.name);
  const labelSimilarity = jaroWinklerSimilarity(source.label, target.label);
  const typeMatch = typeCompatibility(source.type, target.type);
  const overlap = valueLabelOverlap(source.valueLabels, target.valueLabels);

  const total =
    nameSimilarity * weights.name +
    labelSimilarity * weights.label +
    typeMatch * weights.type +
    overlap * weights.valueLabels;

  return {
    total,
    nameSimilarity,
    labelSimilarity,
    typeMatch,
    valueLabelOverlap: overlap,
  };
}

// ============================================================================
// Auto-Matching
// ============================================================================

/**
 * Greedy best-match assignment: each source variable is matched to the
 * highest-scoring unmatched target variable above the threshold.
 */
export function autoMatchVariables(
  sourceVars: Variable[],
  targetVars: Variable[],
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS,
  threshold = 0.4,
): VariableMapping[] {
  const availableTargets = new Set(targetVars.map((v) => v.id));
  const mappings: VariableMapping[] = [];

  for (const source of sourceVars) {
    let bestScore: VariableMatchScore | null = null;
    let bestTargetId: string | null = null;

    for (const target of targetVars) {
      if (!availableTargets.has(target.id)) continue;
      const score = scoreVariablePair(source, target, weights);
      if (score.total >= threshold && (bestScore === null || score.total > bestScore.total)) {
        bestScore = score;
        bestTargetId = target.id;
      }
    }

    const targetVar = bestTargetId ? targetVars.find((v) => v.id === bestTargetId) : null;

    const warnings: HarmonizationWarning[] = [];
    let valueMappings: ValueMapping[] = [];

    if (targetVar && bestTargetId) {
      availableTargets.delete(bestTargetId);

      if (detectScaleInversion(source, targetVar)) {
        const srcSorted = [...source.valueLabels].sort((a, b) => a.value - b.value);
        const tgtSorted = [...targetVar.valueLabels].sort((a, b) => a.value - b.value);
        warnings.push({
          kind: 'scale_inversion',
          sourceMin: srcSorted[0]?.value ?? 0,
          sourceMax: srcSorted[srcSorted.length - 1]?.value ?? 0,
          targetMin: tgtSorted[0]?.value ?? 0,
          targetMax: tgtSorted[tgtSorted.length - 1]?.value ?? 0,
        });
      }

      const orphans = detectDataLoss(source, targetVar);
      if (orphans.length > 0) {
        warnings.push({ kind: 'data_loss', orphanValues: orphans });
      }

      if (source.type !== targetVar.type) {
        warnings.push({
          kind: 'type_mismatch',
          sourceType: source.type,
          targetType: targetVar.type,
        });
      }

      valueMappings = generateValueMappings(source, targetVar);
    }

    const status: MappingStatus = bestTargetId ? 'auto_matched' : 'unmapped';

    mappings.push({
      id: `${source.id}::${bestTargetId ?? 'unmapped'}`,
      sourceVariableId: source.id,
      targetVariableId: bestTargetId,
      status,
      score: bestScore,
      valueMappings,
      warnings,
      confirmed: false,
    });
  }

  return mappings;
}

// ============================================================================
// Value Mapping Generation
// ============================================================================

/**
 * Generates default value-level mappings by matching label similarity.
 */
export function generateValueMappings(source: Variable, target: Variable): ValueMapping[] {
  if (source.valueLabels.length === 0) {
    return target.valueLabels.map((tl) => ({
      sourceValue: null,
      sourceLabel: '',
      targetValue: tl.value,
      targetLabel: tl.label,
    }));
  }

  return source.valueLabels.map((sl) => {
    let bestMatch: ValueLabel | null = null;
    let bestSimilarity = -1;

    for (const tl of target.valueLabels) {
      if (tl.value === sl.value) {
        bestMatch = tl;
        break;
      }
      const sim = jaroWinklerSimilarity(sl.label, tl.label);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = tl;
      }
    }

    const useMatch = bestMatch && (bestMatch.value === sl.value || bestSimilarity > 0.8);

    return {
      sourceValue: sl.value,
      sourceLabel: sl.label,
      targetValue: useMatch ? bestMatch!.value : null,
      targetLabel: useMatch ? bestMatch!.label : '',
    };
  });
}
