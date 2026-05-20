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
  it('falls back to respondent count when no filters or weight are active', () => {
    expect(resolveSlideSubtitle([], null, 80, false)).toBe('N = 80 Respondents');
  });

  it('renders filter variable label, operator, and value', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'region', operator: 'eq', value: 'North' },
    ];
    const labels = { region: 'Region' };

    expect(resolveSlideSubtitle(filters, null, 1500, false, labels)).toBe(
      'Filtered: Region = North · N = 1,500 Respondents'
    );
  });

  it('falls back to variableId when no label map is provided', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'region', operator: 'eq', value: 'North' },
    ];

    expect(resolveSlideSubtitle(filters, null, 1500, false)).toBe(
      'Filtered: region = North · N = 1,500 Respondents'
    );
  });

  it('renders all operator types', () => {
    const base = (operator: Filter['operator']) =>
      resolveSlideSubtitle(
        [{ id: 'f', variableId: 'age', operator, value: 34 }],
        null,
        100,
        false,
        { age: 'Age' }
      );

    expect(base('eq')).toContain('Age = 34');
    expect(base('neq')).toContain('Age ≠ 34');
    expect(base('gt')).toContain('Age > 34');
    expect(base('lt')).toContain('Age < 34');
    expect(base('in')).toContain('Age in 34');
  });

  it('renders two filters inline and truncates the rest', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'region', operator: 'eq', value: 'North' },
      { id: 'f2', variableId: 'gender', operator: 'eq', value: 'Female' },
      { id: 'f3', variableId: 'age', operator: 'gt', value: 34 },
    ];
    const labels = { region: 'Region', gender: 'Gender', age: 'Age' };

    expect(resolveSlideSubtitle(filters, null, 500, false, labels)).toBe(
      'Filtered: Region = North, Gender = Female +1 more · N = 500 Respondents'
    );
  });

  it('uses provided respondent count for filtered bases', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'nps', operator: 'eq', value: 'Promoter' },
    ];
    expect(resolveSlideSubtitle(filters, null, 42, false, { nps: 'NPS segment' })).toBe(
      'Filtered: NPS segment = Promoter · N = 42 Respondents'
    );
  });

  it('includes weighting and formatted N when present', () => {
    const filters: Filter[] = [
      { id: 'f1', variableId: 'region', operator: 'eq', value: 'North' },
    ];

    expect(
      resolveSlideSubtitle(
        filters,
        { id: 'w1', name: 'weight', label: 'Population weight' },
        12345,
        true,
        { region: 'Region' }
      )
    ).toBe('Filtered: Region = North · Weighted by Population weight · N = 12,345 Respondents');
  });
});
