import { describe, it, expect } from 'vitest';
import type { Variable, VariableSet } from '../../types';
import {
  BRAND_TRACKER_FUNNEL_TEMPLATE,
  materializeBrandTrackerFunnelSkeleton,
  materializeDeckTemplate,
} from './brandTrackerSkeleton';

function set(o: Partial<VariableSet> & { id: string; name: string }): VariableSet {
  return { variableIds: ['v1'], structure: 'single', hidden: false, ...o };
}
function variable(o: Partial<Variable> & { id: string; name: string }): Variable {
  return { label: o.name, type: 'categorical', valueLabels: [], missingValues: {}, ...o };
}

describe('materializeBrandTrackerFunnelSkeleton', () => {
  const sets = [
    set({ id: 'vs_aware', name: 'Awareness', variableIds: ['aware_atlas'] }),
    set({ id: 'vs_consider', name: 'Consideration', variableIds: ['consider_atlas'] }),
    set({ id: 'vs_pref', name: 'Preference', variableIds: ['brand_pref'] }),
    set({ id: 'vs_wt', name: 'wt', variableIds: ['wt'] }),
  ];
  const vars = [
    variable({ id: 'aware_atlas', name: 'aware_atlas' }),
    variable({ id: 'consider_atlas', name: 'consider_atlas' }),
    variable({ id: 'brand_pref', name: 'brand_pref' }),
    variable({ id: 'wt', name: 'wt', type: 'numeric' }),
  ];

  it('creates a 3-slide funnel section with brand tracker variable bindings', () => {
    const result = materializeBrandTrackerFunnelSkeleton(sets, vars, { now: 1000 });
    expect(result.slides).toHaveLength(3);
    expect(result.sections[0].title).toBe('The funnel');
    expect(result.slides.map((s) => s.title)).toEqual(['Awareness', 'Consideration', 'Preference']);
    expect(result.slides[0].analysisState.rowVars).toEqual(['vs_aware']);
    expect(result.unresolvedBindings).toEqual([]);
  });

  it('marks missing variables as unresolved but still creates placeholder slides', () => {
    const result = materializeDeckTemplate(BRAND_TRACKER_FUNNEL_TEMPLATE, [], [], { now: 2000 });
    expect(result.slides).toHaveLength(3);
    expect(result.unresolvedBindings).toEqual(['aware_atlas', 'consider_atlas', 'brand_pref']);
  });
});
