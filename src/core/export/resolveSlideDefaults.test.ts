import { describe, expect, it } from 'vitest';
import type { Filter } from '../../types';
import { resolveSlideSubtitle, resolveSlideTitle } from './resolveSlideDefaults';

describe('resolveSlideTitle', () => {
  it('returns a new-slide placeholder when no rows are selected', () => {
    expect(resolveSlideTitle([], null)).toBe('New Slide');
  });

  it('builds a by-title when row and column variables are present', () => {
    expect(
      resolveSlideTitle(
        [
          { id: 'q1', name: 'Q1', label: 'Age' },
          { id: 'q2', name: 'Q2', label: 'Brand' },
        ],
        { id: 'q3', name: 'Q3', label: 'Region' }
      )
    ).toBe('Age > Brand by Region');
  });
});

describe('resolveSlideSubtitle', () => {
  it('includes filters, weighting, and formatted N when present', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'gender', operator: 'eq', value: 1 },
      { id: 'f2', variableId: 'age', operator: 'gt', value: 34 },
    ];

    expect(
      resolveSlideSubtitle(filters, { id: 'w1', name: 'weight', label: 'Population weight' }, 12345, true)
    ).toBe('Filtered: 2 active · Weighted by Population weight · N = 12,345 Respondents');
  });

  it('falls back to respondent count when no filters or weight are active', () => {
    expect(resolveSlideSubtitle([], null, 80, false)).toBe('N = 80 Respondents');
  });
});
