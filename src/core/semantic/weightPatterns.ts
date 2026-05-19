/**
 * Shared name patterns for survey-weight detection.
 * Used by the annotator and analysis guardrails (S4-DEF-1).
 */

export const WEIGHT_NAME_PATTERNS: RegExp[] = [
  /^wt$/i,
  /^wt_/i,
  /^weight$/i,
  /^weight_/i,
  /^w\d+$/i,
  /^fw\d*$/i,
  /^finalwt/i,
  /^sampleweight/i,
];

export function hasWeightLikeName(name: string): boolean {
  return WEIGHT_NAME_PATTERNS.some((pattern) => pattern.test(name));
}
