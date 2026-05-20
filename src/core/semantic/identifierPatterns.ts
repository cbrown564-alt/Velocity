/**
 * Shared name patterns for respondent / case identifier variables.
 * Used by the annotator, auto-analysis suggestions, and longitudinal linking.
 */

export const RESPONDENT_IDENTIFIER_NAME_PATTERNS: RegExp[] = [
  /^resp(?:ondent)?_?id$/i,
  /^respondent_?id$/i,
  /^respondent$/i,
  /^caseid$/i,
  /^case_?no$/i,
  /^case_?id$/i,
  /^r_?no$/i,
  /^id$/i,
  /^uid$/i,
  /^user_?id$/i,
  /^panel_?id$/i,
  /^respondentno$/i,
  /^sampleno$/i,
  /^serialno$/i,
  /^serial$/i,
  /^record_?id$/i,
  /^interview_?id$/i,
];

export function hasRespondentIdentifierName(name: string): boolean {
  return RESPONDENT_IDENTIFIER_NAME_PATTERNS.some((pattern) => pattern.test(name));
}
