import { describe, expect, it } from 'vitest';
import type { Variable, VariableSet } from '../../../types';
import {
  enrichVariablesWithSemantic,
  isExcludedFromAutoAnalysis,
  isRespondentIdentifierVariable,
} from '../respondentIdentifier';

function makeVar(overrides: Partial<Variable> & Pick<Variable, 'id' | 'name'>): Variable {
  return {
    label: overrides.name,
    type: 'nominal',
    valueLabels: [],
    missingValues: {},
    ...overrides,
  };
}

describe('isRespondentIdentifierVariable', () => {
  it('detects respondent id by name when semantic is absent', () => {
    expect(isRespondentIdentifierVariable(makeVar({ id: 'id', name: 'id' }))).toBe(true);
    expect(isRespondentIdentifierVariable(makeVar({ id: 'resp_id', name: 'resp_id' }))).toBe(true);
  });

  it('detects identifier intent from semantic annotation', () => {
    const variable = makeVar({
      id: 'key',
      name: 'internal_key',
      semantic: {
        topic: 'respondent_id',
        measurementIntent: 'identifier',
        source: 'auto',
        confidence: 0.9,
      },
    });
    expect(isRespondentIdentifierVariable(variable)).toBe(true);
  });

  it('does not treat temporal identifiers as respondent ids', () => {
    const variable = makeVar({
      id: 'wave',
      name: 'wave',
      semantic: {
        topic: 'temporal',
        measurementIntent: 'identifier',
        source: 'auto',
        confidence: 0.85,
        temporalRole: 'wave_id',
      },
    });
    expect(isRespondentIdentifierVariable(variable)).toBe(false);
  });
});

describe('isExcludedFromAutoAnalysis', () => {
  it('excludes respondent ids and weights from auto analysis', () => {
    expect(isExcludedFromAutoAnalysis(makeVar({ id: 'id', name: 'id' }))).toBe(true);
    expect(
      isExcludedFromAutoAnalysis(
        makeVar({
          id: 'wt',
          name: 'wt',
          semantic: {
            topic: 'sampling_weight',
            measurementIntent: 'weight',
            source: 'auto',
            confidence: 0.95,
          },
        }),
      ),
    ).toBe(true);
  });

  it('excludes near-unique categorical keys when row count is known', () => {
    const variable = makeVar({
      id: 'region_code',
      name: 'region_code',
      valueLabels: Array.from({ length: 250 }, (_, i) => ({
        value: i + 1,
        label: `Code ${i + 1}`,
      })),
    });
    expect(isExcludedFromAutoAnalysis(variable, { rowCount: 250 })).toBe(true);
    expect(isExcludedFromAutoAnalysis(variable, { rowCount: 500 })).toBe(false);
  });

  it('allows normal demographic variables', () => {
    const variable = makeVar({
      id: 'gender',
      name: 'gender',
      valueLabels: [
        { value: 1, label: 'Female' },
        { value: 2, label: 'Male' },
      ],
    });
    expect(isExcludedFromAutoAnalysis(variable, { rowCount: 250 })).toBe(false);
  });
});

describe('enrichVariablesWithSemantic', () => {
  it('tags CSV-style id column as identifier on ingest', () => {
    const variables = [makeVar({ id: 'id', name: 'id' }), makeVar({ id: 'gender', name: 'gender' })];
    const sets: VariableSet[] = variables.map((v) => ({
      id: `set_${v.id}`,
      name: v.name,
      variableIds: [v.id],
      structure: 'single',
    }));

    const enriched = enrichVariablesWithSemantic(variables, sets);
    expect(enriched.find((v) => v.id === 'id')?.semantic?.measurementIntent).toBe('identifier');
    expect(enriched.find((v) => v.id === 'gender')?.semantic?.measurementIntent).not.toBe('identifier');
  });
});
