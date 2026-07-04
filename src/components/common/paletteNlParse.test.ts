import { describe, it, expect } from 'vitest';
import { makeVariable, mockNominalSet } from '../../test/fixtures/variables';
import type { Variable, VariableSet } from '../../types';
import {
  buildCrosstabBindingTableConfig,
  formatCrosstabBindingPreview,
  parsePaletteNlCrosstab,
  splitCrosstabQuery,
} from './paletteNlParse';

function brandTrackerFixture(): { sets: VariableSet[]; variables: Variable[] } {
  const sets: VariableSet[] = [
    { ...mockNominalSet, id: 'q5', name: 'q5_preference', variableIds: ['v_q5'] },
    {
      ...mockNominalSet,
      id: 'vs_segment',
      name: 'SEG. Consumer segment (from segmentation model)',
      variableIds: ['segment'],
    },
  ];
  const variables: Variable[] = [
    makeVariable({ id: 'v_q5', name: 'q5_preference', label: 'Which brand do you most prefer?' }),
    makeVariable({
      id: 'segment',
      name: 'segment',
      label: 'Consumer segment',
      valueLabels: [
        { value: 1, label: 'Loyalists' },
        { value: 2, label: 'Switchers' },
      ],
    }),
  ];
  return { sets, variables };
}

describe('paletteNlParse', () => {
  it('splits "Q5 by segment"', () => {
    expect(splitCrosstabQuery('Q5 by segment')).toEqual({
      rowQuery: 'Q5',
      columnQuery: 'segment',
      connector: 'by',
    });
  });

  it.each([
    ['preference vs segment', 'vs'],
    ['preference x segment', 'x'],
    ['preference crossed with segment', 'crossed with'],
    ['preference against segment', 'against'],
  ])('splits connector form %# (%s)', (query, connector) => {
    expect(splitCrosstabQuery(query)).toMatchObject({
      rowQuery: 'preference',
      columnQuery: 'segment',
      connector,
    });
  });

  it('binds "Q5 by segment" to existing variable-set ids', () => {
    const { sets, variables } = brandTrackerFixture();
    const result = parsePaletteNlCrosstab('Q5 by segment', sets, { variables });
    expect(result.kind).toBe('crosstab');
    if (result.kind !== 'crosstab') return;
    expect(result.row.setId).toBe('q5');
    expect(result.column.setId).toBe('vs_segment');
    expect(result.row.setName).toBe('q5_preference');
    expect(result.column.setName).toContain('Consumer segment');
    expect(buildCrosstabBindingTableConfig(result)).toEqual({ rowVars: ['q5'], colVar: 'vs_segment' });
    expect(formatCrosstabBindingPreview(result)).toBe(
      'q5_preference → rows · SEG. Consumer segment (from segmentation model) → columns',
    );
  });

  it('returns partial when one side does not resolve', () => {
    const { sets, variables } = brandTrackerFixture();
    const result = parsePaletteNlCrosstab('Q5 by unknown', sets, { variables });
    expect(result.kind).toBe('partial');
    if (result.kind !== 'partial') return;
    expect(result.row?.setId).toBe('q5');
    expect(result.column).toBeUndefined();
    expect(result.rowQuery).toBe('Q5');
    expect(result.columnQuery).toBe('unknown');
  });

  it('returns none without a crosstab connector (binding grammar only)', () => {
    const { sets, variables } = brandTrackerFixture();
    // Free-form analysis phrasing is out of scope — not opaque AI, not auto-analysis.
    expect(parsePaletteNlCrosstab('analyze brand preference', sets, { variables }).kind).toBe('none');
    expect(parsePaletteNlCrosstab('segment', sets, { variables }).kind).toBe('none');
  });
});
