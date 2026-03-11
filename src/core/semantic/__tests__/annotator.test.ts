import { describe, it, expect } from 'vitest';
import { autoAnnotate, annotateVariable } from '../annotator';
import type { Variable, VariableSet } from '../../../types';

// ============================================================================
// Fixtures
// ============================================================================

function makeVar(overrides: Partial<Variable> & Pick<Variable, 'id' | 'name'>): Variable {
  return {
    label: overrides.name,
    type: 'categorical',
    valueLabels: [],
    missingValues: {},
    ...overrides,
  };
}

const WEIGHT_VAR = makeVar({ id: 'wt', name: 'wt', label: 'Weight variable' });
const WEIGHT_WTN = makeVar({ id: 'wt_final', name: 'wt_final', label: 'Final weight' });
const RESP_ID_VAR = makeVar({ id: 'resp_id', name: 'resp_id', label: 'Respondent ID' });
const CASE_ID_VAR = makeVar({ id: 'caseid', name: 'caseid', label: 'Case ID' });
const WAVE_VAR = makeVar({ id: 'wave', name: 'wave', label: 'Wave number' });
const DATE_VAR = makeVar({ id: 'survey_date', name: 'survey_date', label: 'Survey date' });

const GENDER_VAR = makeVar({
  id: 'gender',
  name: 'gender',
  label: 'Gender',
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
});

const LIKERT_VAR = makeVar({
  id: 'q1_sat',
  name: 'q1_sat',
  label: 'Q1 Satisfaction',
  valueLabels: [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neither Agree nor Disagree' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' },
  ],
});

const SATISFACTION_VAR = makeVar({
  id: 'sat_overall',
  name: 'sat_overall',
  label: 'Overall Satisfaction',
  valueLabels: [
    { value: 1, label: 'Very Dissatisfied' },
    { value: 2, label: 'Dissatisfied' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Satisfied' },
    { value: 5, label: 'Very Satisfied' },
  ],
});

const AWARENESS_VAR = makeVar({
  id: 'brand_aware',
  name: 'brand_aware',
  label: 'Brand Awareness',
  valueLabels: [
    { value: 1, label: 'Aware' },
    { value: 2, label: 'Not Aware' },
  ],
});

const BEHAVIOR_VAR = makeVar({
  id: 'freq_purchase',
  name: 'freq_purchase',
  label: 'Purchase Frequency',
  valueLabels: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Often' },
    { value: 5, label: 'Always' },
  ],
});

const OPEN_END_VAR = makeVar({
  id: 'q99_oe',
  name: 'q99_oe',
  label: 'Any other comments?',
  type: 'text',
  valueLabels: [],
});

// A variable that should not match any annotation rule
const UNCLASSIFIABLE_VAR = makeVar({
  id: 'q42',
  name: 'q42',
  label: 'Q42',
  type: 'numeric',
  valueLabels: [],
});

// ============================================================================
// Weight Detection
// ============================================================================

describe('annotator — weight detection', () => {
  it('detects "wt" name → weight intent', () => {
    const annotations = autoAnnotate([WEIGHT_VAR], []);
    const a = annotations.get('wt');
    expect(a?.measurementIntent).toBe('weight');
    expect(a?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects "wt_final" name → weight intent', () => {
    const annotations = autoAnnotate([WEIGHT_WTN], []);
    expect(annotations.get('wt_final')?.measurementIntent).toBe('weight');
  });

  it('weight annotation source is "auto"', () => {
    const annotations = autoAnnotate([WEIGHT_VAR], []);
    expect(annotations.get('wt')?.source).toBe('auto');
  });
});

// ============================================================================
// Identifier Detection
// ============================================================================

describe('annotator — identifier detection', () => {
  it('detects "resp_id" → identifier intent', () => {
    const annotations = autoAnnotate([RESP_ID_VAR], []);
    expect(annotations.get('resp_id')?.measurementIntent).toBe('identifier');
  });

  it('detects "caseid" → identifier intent', () => {
    const annotations = autoAnnotate([CASE_ID_VAR], []);
    expect(annotations.get('caseid')?.measurementIntent).toBe('identifier');
  });
});

// ============================================================================
// Temporal Detection
// ============================================================================

describe('annotator — temporal detection', () => {
  it('detects "wave" → temporalRole: wave_id', () => {
    const annotations = autoAnnotate([WAVE_VAR], []);
    const a = annotations.get('wave');
    expect(a?.temporalRole).toBe('wave_id');
  });

  it('detects "survey_date" → temporalRole: timestamp', () => {
    const annotations = autoAnnotate([DATE_VAR], []);
    const a = annotations.get('survey_date');
    expect(a?.temporalRole).toBe('timestamp');
  });
});

// ============================================================================
// Demographic Detection
// ============================================================================

describe('annotator — demographic detection', () => {
  it('detects Male/Female value labels → demographic intent', () => {
    const annotations = autoAnnotate([GENDER_VAR], []);
    const a = annotations.get('gender');
    expect(a?.measurementIntent).toBe('demographic');
    expect(a?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('sets topic "demographics" for gender variable', () => {
    const annotations = autoAnnotate([GENDER_VAR], []);
    expect(annotations.get('gender')?.topic).toBe('demographics');
  });
});

// ============================================================================
// Likert / Attitude Detection
// ============================================================================

describe('annotator — Likert/attitude detection', () => {
  it('detects Strongly Agree/Disagree scale → attitude intent', () => {
    const annotations = autoAnnotate([LIKERT_VAR], []);
    const a = annotations.get('q1_sat');
    expect(a?.measurementIntent).toBe('attitude');
  });

  it('detects satisfaction labels → topic: satisfaction', () => {
    const annotations = autoAnnotate([SATISFACTION_VAR], []);
    const a = annotations.get('sat_overall');
    expect(a?.topic).toBe('satisfaction');
    expect(a?.conceptFamily).toBe('satisfaction');
  });

  it('grid set membership boosts confidence', () => {
    const gridSet: VariableSet = {
      id: 'grid1',
      name: 'Grid',
      variableIds: ['q1_sat'],
      structure: 'grid',
    };
    const withGrid = autoAnnotate([LIKERT_VAR], [gridSet]);
    const withoutGrid = autoAnnotate([LIKERT_VAR], []);
    expect(withGrid.get('q1_sat')!.confidence).toBeGreaterThanOrEqual(
      withoutGrid.get('q1_sat')!.confidence
    );
  });
});

// ============================================================================
// Awareness Detection
// ============================================================================

describe('annotator — awareness detection', () => {
  it('detects Aware/Not Aware labels → awareness intent', () => {
    const annotations = autoAnnotate([AWARENESS_VAR], []);
    const a = annotations.get('brand_aware');
    expect(a?.measurementIntent).toBe('awareness');
  });
});

// ============================================================================
// Behavior Detection
// ============================================================================

describe('annotator — behavior detection', () => {
  it('detects Never/Rarely/Often frequency labels → behavior intent', () => {
    const annotations = autoAnnotate([BEHAVIOR_VAR], []);
    const a = annotations.get('freq_purchase');
    expect(a?.measurementIntent).toBe('behavior');
  });
});

// ============================================================================
// Open-End Detection
// ============================================================================

describe('annotator — open-end detection', () => {
  it('detects text type with no value labels → open_end intent', () => {
    const annotations = autoAnnotate([OPEN_END_VAR], []);
    const a = annotations.get('q99_oe');
    expect(a?.measurementIntent).toBe('open_end');
  });
});

// ============================================================================
// Confidence Scoring
// ============================================================================

describe('annotator — confidence scoring', () => {
  it('weight has confidence >= 0.9', () => {
    const annotations = autoAnnotate([WEIGHT_VAR], []);
    expect(annotations.get('wt')!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('identifier has confidence >= 0.85', () => {
    const annotations = autoAnnotate([RESP_ID_VAR], []);
    expect(annotations.get('resp_id')!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('all confidence values are between 0 and 1', () => {
    const vars = [WEIGHT_VAR, RESP_ID_VAR, GENDER_VAR, LIKERT_VAR, AWARENESS_VAR, BEHAVIOR_VAR];
    const annotations = autoAnnotate(vars, []);
    for (const [, ann] of annotations) {
      expect(ann.confidence).toBeGreaterThanOrEqual(0);
      expect(ann.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// annotateVariable (single variable)
// ============================================================================

describe('annotateVariable', () => {
  it('returns annotation for a matchable variable', () => {
    const result = annotateVariable(WEIGHT_VAR);
    expect(result).not.toBeNull();
    expect(result?.measurementIntent).toBe('weight');
  });

  it('returns null for an unclassifiable variable with no labels and opaque name', () => {
    const result = annotateVariable(UNCLASSIFIABLE_VAR);
    // Generic "q42" with no value labels and no known patterns → no match
    expect(result).toBeNull();
  });
});

// ============================================================================
// Bulk annotation
// ============================================================================

describe('autoAnnotate — bulk', () => {
  it('annotates only variables that match rules (not all)', () => {
    const vars = [WEIGHT_VAR, UNCLASSIFIABLE_VAR, GENDER_VAR];
    const annotations = autoAnnotate(vars, []);
    // UNCLASSIFIABLE_VAR (generic "q42" with no labels) should not get annotated
    expect(annotations.has('q42')).toBe(false);
    expect(annotations.has('wt')).toBe(true);
    expect(annotations.has('gender')).toBe(true);
  });

  it('handles empty variable list gracefully', () => {
    const annotations = autoAnnotate([], []);
    expect(annotations.size).toBe(0);
  });
});
