import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSuggestedVariables } from './useSuggestedVariables';
import type { Variable, VariableSet } from '../../../types';

function makeVariable(overrides: Partial<Variable> & { id: string }): Variable {
  return {
    name: overrides.id,
    label: overrides.label || overrides.id,
    type: 'nominal',
    valueLabels: [],
    missingValues: {},
    ...overrides,
  };
}

function makeSet(overrides: Partial<VariableSet> & { id: string; variableIds: string[] }): VariableSet {
  return {
    name: overrides.id,
    structure: 'single',
    hidden: false,
    ...overrides,
  };
}

describe('useSuggestedVariables', () => {
  it('returns empty when no variables', () => {
    const { result } = renderHook(() => useSuggestedVariables([], [], new Set(), 5));
    expect(result.current).toEqual([]);
  });

  it('returns empty when all variables are excluded', () => {
    const vars = [makeVariable({ id: 'v1' })];
    const sets = [makeSet({ id: 's1', variableIds: ['v1'] })];
    const { result } = renderHook(() => useSuggestedVariables(vars, sets, new Set(['v1']), 5));
    expect(result.current).toEqual([]);
  });

  it('prefers attitude variables with balanced labels', () => {
    const vars = [
      makeVariable({
        id: 'age',
        type: 'scale',
        valueLabels: [
          { value: 1, label: '18-24' },
          { value: 2, label: '25-34' },
          { value: 3, label: '35-44' },
          { value: 4, label: '45-54' },
          { value: 5, label: '55+' },
        ],
      }),
      makeVariable({
        id: 'nps',
        semantic: { topic: 'nps', measurementIntent: 'attitude', source: 'auto', confidence: 0.9 },
        valueLabels: [
          { value: 0, label: '0' },
          { value: 1, label: '1' },
          { value: 2, label: '2' },
        ],
      }),
      makeVariable({ id: 'text', type: 'text', valueLabels: [] }),
    ];
    const sets = [
      makeSet({ id: 'age_set', variableIds: ['age'] }),
      makeSet({ id: 'nps_set', variableIds: ['nps'] }),
      makeSet({ id: 'text_set', variableIds: ['text'] }),
    ];
    const { result } = renderHook(() => useSuggestedVariables(vars, sets, new Set(), 5));
    expect(result.current.length).toBeGreaterThan(0);
    // Attitude variable should be first
    expect(result.current[0].setId).toBe('nps_set');
  });

  it('excludes synthetic variables', () => {
    const vars = [makeVariable({ id: 'v1', synthetic: true }), makeVariable({ id: 'v2' })];
    const sets = [makeSet({ id: 's1', variableIds: ['v1'] }), makeSet({ id: 's2', variableIds: ['v2'] })];
    const { result } = renderHook(() => useSuggestedVariables(vars, sets, new Set(), 5));
    expect(result.current.map((s) => s.setId)).not.toContain('s1');
  });

  it('respects maxSuggestions', () => {
    const vars = Array.from({ length: 10 }, (_, i) =>
      makeVariable({
        id: `v${i}`,
        valueLabels: [
          { value: 1, label: 'A' },
          { value: 2, label: 'B' },
          { value: 3, label: 'C' },
        ],
      }),
    );
    const sets = vars.map((v) => makeSet({ id: `s_${v.id}`, variableIds: [v.id] }));
    const { result } = renderHook(() => useSuggestedVariables(vars, sets, new Set(), 3));
    expect(result.current.length).toBe(3);
  });

  it('excludes respondent id variables from suggestions', () => {
    const vars = [
      makeVariable({ id: 'id', name: 'id' }),
      makeVariable({
        id: 'region',
        valueLabels: [
          { value: 1, label: 'North' },
          { value: 2, label: 'South' },
          { value: 3, label: 'East' },
          { value: 4, label: 'West' },
          { value: 5, label: 'International' },
        ],
      }),
      makeVariable({
        id: 'gender',
        valueLabels: [
          { value: 1, label: 'Female' },
          { value: 2, label: 'Male' },
        ],
      }),
    ];
    const sets = vars.map((v) => makeSet({ id: `s_${v.id}`, variableIds: [v.id] }));
    const { result } = renderHook(() => useSuggestedVariables(vars, sets, new Set(), 5, 250));
    const suggestedNames = result.current.map((s) => s.name);
    expect(suggestedNames).not.toContain('id');
    expect(suggestedNames).not.toContain('s_id');
    expect(result.current.length).toBeGreaterThanOrEqual(2);
  });
});
