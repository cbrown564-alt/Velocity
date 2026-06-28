/**
 * Harmonization SQL Query Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildValueFrequencyQuery,
  buildHarmonizedTableQuery,
  buildRespondentOverlapQuery,
} from './harmonizationQueries';
import type { VariableMapping } from '../../types/harmonization';

describe('buildValueFrequencyQuery', () => {
  it('generates valid SELECT with GROUP BY', () => {
    const sql = buildValueFrequencyQuery('survey_data', 'Q1');
    expect(sql).toContain('SELECT');
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('GROUP BY');
    expect(sql).toContain('"Q1"');
  });

  it('escapes column names with double quotes', () => {
    const sql = buildValueFrequencyQuery('my_table', 'my column');
    expect(sql).toContain('"my column"');
  });

  it('filters NULLs', () => {
    const sql = buildValueFrequencyQuery('data', 'AGE');
    expect(sql).toContain('IS NOT NULL');
  });

  it('orders by count descending', () => {
    const sql = buildValueFrequencyQuery('data', 'Q1');
    expect(sql).toContain('ORDER BY count DESC');
  });
});

describe('buildHarmonizedTableQuery', () => {
  const mappings: VariableMapping[] = [
    {
      id: 'q1::q1',
      sourceVariableId: 'w1_q1',
      targetVariableId: 'w2_q1',
      status: 'auto_matched',
      score: null,
      valueMappings: [
        { sourceValue: 1, sourceLabel: 'Very Dissatisfied', targetValue: 1, targetLabel: 'Very Dissatisfied' },
        { sourceValue: 5, sourceLabel: 'Very Satisfied', targetValue: 5, targetLabel: 'Very Satisfied' },
      ],
      warnings: [],
      confirmed: true,
    },
  ];

  const sourceVarNames = { w1_q1: 'Q1' };
  const targetVarNames = { w2_q1: 'Q1' };

  it('generates UNION ALL between source and target', () => {
    const sql = buildHarmonizedTableQuery('wave1_data', 'wave2_data', mappings, sourceVarNames, targetVarNames);
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('_wave');
  });

  it('includes wave number identifiers', () => {
    const sql = buildHarmonizedTableQuery('wave1_data', 'wave2_data', mappings, sourceVarNames, targetVarNames);
    expect(sql).toContain('1 AS _wave');
    expect(sql).toContain('2 AS _wave');
  });

  it('returns empty-result query for no valid mappings', () => {
    const unmapped: VariableMapping[] = [{ ...mappings[0], targetVariableId: null, status: 'unmapped' }];
    const sql = buildHarmonizedTableQuery('w1', 'w2', unmapped, sourceVarNames, targetVarNames);
    expect(sql).toContain('WHERE 1=0');
  });

  it('keeps target wave coding in target rows (no reverse remap)', () => {
    const remapped: VariableMapping[] = [
      {
        ...mappings[0],
        valueMappings: [
          { sourceValue: 1, sourceLabel: 'Old Low', targetValue: 10, targetLabel: 'New Low' },
          { sourceValue: 2, sourceLabel: 'Old High', targetValue: 20, targetLabel: 'New High' },
        ],
      },
    ];
    const sql = buildHarmonizedTableQuery('wave1_data', 'wave2_data', remapped, { w1_q1: 'Q_OLD' }, { w2_q1: 'Q_NEW' });

    // Source rows are remapped to target coding.
    expect(sql).toContain('WHEN "Q_OLD" = 1 THEN 10');
    // Target rows should remain in target coding, not reverse-map back to source.
    expect(sql).not.toContain('WHEN "Q_NEW" = 10 THEN 1');
  });

  it('returns empty-result query when mappings resolve to missing variable names', () => {
    const sql = buildHarmonizedTableQuery(
      'wave1_data',
      'wave2_data',
      mappings,
      {}, // missing source lookup
      {}, // missing target lookup
    );
    expect(sql).toContain('WHERE 1=0');
  });
});

describe('buildRespondentOverlapQuery', () => {
  it('generates a query with both tables and key column', () => {
    const sql = buildRespondentOverlapQuery('wave1', 'wave2', 'respondent_id');
    expect(sql).toContain('total_source');
    expect(sql).toContain('total_target');
    expect(sql).toContain('overlap');
    expect(sql).toContain('"respondent_id"');
  });

  it('uses INNER JOIN for overlap calculation', () => {
    const sql = buildRespondentOverlapQuery('w1', 'w2', 'rid');
    expect(sql).toContain('INNER JOIN');
  });
});
