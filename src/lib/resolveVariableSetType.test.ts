import { describe, expect, it } from 'vitest';
import { resolveEffectiveVariableSetType } from './resolveVariableSetType';
import type { Variable, VariableSet } from '../types/dataset';

const categoricalVariable: Variable = {
  id: 'cat_buyer',
  name: 'cat_buyer',
  label: 'Category buyer',
  type: 'categorical',
  valueLabels: [{ value: 1, label: 'Yes - bought in past 3 months' }],
  missingValues: {},
};

const numericVariable: Variable = {
  id: 'age',
  name: 'age',
  label: 'Age',
  type: 'numeric',
  valueLabels: [],
  missingValues: {},
};

describe('resolveEffectiveVariableSetType', () => {
  it('prefers a categorical variable type over a stale numeric set type', () => {
    const set: VariableSet = {
      id: 'vs_cat_buyer',
      name: 'cat buyer',
      variableIds: ['cat_buyer'],
      structure: 'single',
      type: 'numeric',
    };

    expect(resolveEffectiveVariableSetType(set, categoricalVariable)).toBe('categorical');
  });

  it('prefers a bulk-set categorical type over a numeric variable type', () => {
    const set: VariableSet = {
      id: 'vs_region',
      name: 'Region',
      variableIds: ['region'],
      structure: 'single',
      type: 'categorical',
    };
    const variable: Variable = {
      id: 'region',
      name: 'region',
      label: 'Region',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
    };

    expect(resolveEffectiveVariableSetType(set, variable)).toBe('categorical');
  });

  it('re-infers from value labels when both records say numeric', () => {
    const set: VariableSet = {
      id: 'vs_gender',
      name: 'Gender',
      variableIds: ['gender'],
      structure: 'single',
      type: 'numeric',
    };
    const variable: Variable = {
      id: 'gender',
      name: 'gender',
      label: 'Gender',
      type: 'numeric',
      valueLabels: [
        { value: 1, label: 'Female' },
        { value: 2, label: 'Male' },
      ],
      missingValues: {},
    };

    expect(resolveEffectiveVariableSetType(set, variable)).toBe('categorical');
  });

  it('keeps numeric for true numeric variables', () => {
    const set: VariableSet = {
      id: 'vs_age',
      name: 'Age',
      variableIds: ['age'],
      structure: 'single',
      type: 'numeric',
    };

    expect(resolveEffectiveVariableSetType(set, numericVariable)).toBe('numeric');
  });

  it('uses set type for grid structures', () => {
    const set: VariableSet = {
      id: 'vs_grid',
      name: 'Attitudes',
      variableIds: ['q1', 'q2', 'q3'],
      structure: 'grid',
      type: 'ordered',
    };

    expect(resolveEffectiveVariableSetType(set, null)).toBe('ordered');
  });
});
