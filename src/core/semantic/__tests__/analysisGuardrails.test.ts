import { describe, expect, it } from 'vitest';
import type { Variable } from '../../../types';
import type { SemanticAnnotation } from '../../../types/semantic';
import {
  collectCrosstabWarnings,
  collectTopicGuidanceWarnings,
  isLikelyMeasurementWeight,
  warnHighCardinality,
  warnMisclassifiedWeight,
} from '../analysisGuardrails';

function makeVar(overrides: Partial<Variable> & Pick<Variable, 'id' | 'name'>): Variable {
  return {
    label: overrides.name,
    type: 'nominal',
    valueLabels: [],
    missingValues: { discrete: [] },
    ...overrides,
  };
}

const bodyWeightAnn: SemanticAnnotation = {
  topic: 'sampling_weight',
  measurementIntent: 'weight',
  source: 'auto',
  confidence: 0.95,
};

describe('isLikelyMeasurementWeight', () => {
  it('flags EVAL-01 sleep.sav-style body weight variable', () => {
    const variable = makeVar({
      id: 'weight',
      name: 'weight',
      label: 'weight',
      type: 'numeric',
      valueLabels: [],
    });
    expect(isLikelyMeasurementWeight(variable, bodyWeightAnn)).toBe(true);
  });

  it('does not flag typical survey weight names', () => {
    const variable = makeVar({
      id: 'wt_final',
      name: 'wt_final',
      label: 'Final weight',
      type: 'scale',
      valueLabels: [],
    });
    expect(isLikelyMeasurementWeight(variable)).toBe(false);
  });

  it('flags explicit body weight label on a weight-like name', () => {
    const variable = makeVar({
      id: 'weight_kg',
      name: 'weight_kg',
      label: 'Body weight (kg)',
      type: 'numeric',
      valueLabels: [],
    });
    expect(isLikelyMeasurementWeight(variable)).toBe(true);
  });
});

describe('warnMisclassifiedWeight', () => {
  it('returns weight_selection message when used as weightVar', () => {
    const variable = makeVar({
      id: 'weight',
      name: 'weight',
      type: 'numeric',
      valueLabels: [],
    });
    const message = warnMisclassifiedWeight(variable, bodyWeightAnn, 'weight_selection');
    expect(message).toContain('Do not use it as weightVar');
  });
});

describe('warnHighCardinality', () => {
  it('warns on high-cardinality row variable', () => {
    const variable = makeVar({
      id: 'region',
      name: 'region',
      valueLabels: Array.from({ length: 25 }, (_, i) => ({
        value: i + 1,
        label: `Region ${i + 1}`,
      })),
    });
    expect(warnHighCardinality(variable, 'row')).toContain('25 categories');
  });

  it('warns on continuous numeric row without labels', () => {
    const variable = makeVar({
      id: 'age_raw',
      name: 'age_raw',
      type: 'numeric',
      valueLabels: [],
    });
    expect(warnHighCardinality(variable, 'row')).toContain('continuous numeric');
  });

  it('warns on high-cardinality column variable', () => {
    const variable = makeVar({
      id: 'party',
      name: 'party',
      valueLabels: Array.from({ length: 14 }, (_, i) => ({
        value: i + 1,
        label: `Party ${i + 1}`,
      })),
    });
    expect(warnHighCardinality(variable, 'col')).toContain('14 categories');
  });
});

describe('collectCrosstabWarnings', () => {
  it('aggregates weight and cardinality warnings', () => {
    const rowVar = makeVar({
      id: 'region',
      name: 'region',
      valueLabels: Array.from({ length: 22 }, (_, i) => ({
        value: i + 1,
        label: `R${i + 1}`,
      })),
    });
    const weightVar = makeVar({
      id: 'weight',
      name: 'weight',
      type: 'numeric',
      valueLabels: [],
    });

    const warnings = collectCrosstabWarnings({
      rowVars: [rowVar],
      colVar: null,
      weightVar,
      getAnnotation: (id) => (id === 'weight' ? bodyWeightAnn : undefined),
    });

    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.includes('weightVar'))).toBe(true);
    expect(warnings.some((w) => w.includes('High cardinality'))).toBe(true);
  });
});

describe('collectTopicGuidanceWarnings', () => {
  it('warns when topic variable is likely body weight', () => {
    const variable = makeVar({
      id: 'weight',
      name: 'weight',
      type: 'numeric',
      valueLabels: [],
    });
    const warnings = collectTopicGuidanceWarnings(variable, bodyWeightAnn);
    expect(warnings.some((w) => w.includes('body weight'))).toBe(true);
  });
});
