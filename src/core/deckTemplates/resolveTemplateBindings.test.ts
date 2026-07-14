import { describe, it, expect } from 'vitest';
import type { Variable, VariableSet } from '../../types';
import { findVariableIdByName, findVariableSetIdByVariableName } from './resolveTemplateBindings';

describe('resolveTemplateBindings', () => {
  const variables: Variable[] = [
    {
      id: 'v_aware',
      name: 'aware_atlas',
      label: 'Awareness',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    },
    {
      id: 'wt',
      name: 'wt',
      label: 'Weight',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
    },
  ];
  const sets: VariableSet[] = [
    { id: 'vs_aware', name: 'Awareness', variableIds: ['v_aware'], structure: 'single', hidden: false },
  ];

  it('resolves variable set ids by variable name', () => {
    expect(findVariableSetIdByVariableName(sets, variables, ['aware_atlas'])).toBe('vs_aware');
    expect(findVariableSetIdByVariableName(sets, variables, ['missing'])).toBeNull();
  });

  it('resolves variable ids by name with normalization', () => {
    expect(findVariableIdByName(variables, ['Aware Atlas'])).toBe('v_aware');
    expect(findVariableIdByName(variables, ['wt'])).toBe('wt');
  });
});
