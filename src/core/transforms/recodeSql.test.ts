import { describe, expect, it } from 'vitest';
import type { RecodeConfig } from '../../types';
import { buildCaseSql } from './recodeSql';

describe('buildCaseSql', () => {
  it('builds categorical CASE with escaped single quotes', () => {
    const config: RecodeConfig = {
      mode: 'categorical',
      mappings: {
        "don't know": "Don't Know",
      },
    };

    expect(buildCaseSql('q1', config)).toBe(
      "CASE WHEN \"q1\" = 'don''t know' THEN 'Don''t Know' ELSE CAST(\"q1\" AS VARCHAR) END",
    );
  });

  it('builds categorical CASE for multiple mappings', () => {
    const config: RecodeConfig = {
      mode: 'categorical',
      mappings: { '1': 'Yes', '2': 'No' },
    };

    const sql = buildCaseSql('q1', config);
    expect(sql).toContain("WHEN \"q1\" = '1' THEN 'Yes'");
    expect(sql).toContain("WHEN \"q1\" = '2' THEN 'No'");
    expect(sql).toMatch(/ELSE CAST\("q1" AS VARCHAR\) END$/);
  });

  it('builds binning CASE with min and max bounds', () => {
    const config: RecodeConfig = {
      mode: 'binning',
      rules: [
        { min: 0, max: 18, label: 'Under 18' },
        { min: 18, max: 65, label: 'Working age' },
        { min: 65, label: '65+' },
      ],
    };

    expect(buildCaseSql('age', config)).toBe(
      'CASE WHEN "age" >= 0 AND "age" < 18 THEN \'Under 18\' WHEN "age" >= 18 AND "age" < 65 THEN \'Working age\' WHEN "age" >= 65 THEN \'65+\' ELSE CAST("age" AS VARCHAR) END',
    );
  });

  it('skips binning rules with no bounds', () => {
    const config: RecodeConfig = {
      mode: 'binning',
      rules: [{ label: 'orphan' }],
    };

    expect(buildCaseSql('score', config)).toBe('CASE ELSE CAST("score" AS VARCHAR) END');
  });

  it('falls through to ELSE when categorical mode has no mappings', () => {
    const config: RecodeConfig = { mode: 'categorical' };

    expect(buildCaseSql('region', config)).toBe('CASE ELSE CAST("region" AS VARCHAR) END');
  });

  it('uses binning path when mode is binning even if mappings are present', () => {
    const config: RecodeConfig = {
      mode: 'binning',
      mappings: { '1': 'Yes' },
      rules: [{ min: 0, max: 18, label: 'Under 18' }],
    };

    expect(buildCaseSql('age', config)).toBe(
      'CASE WHEN "age" >= 0 AND "age" < 18 THEN \'Under 18\' ELSE CAST("age" AS VARCHAR) END',
    );
  });

  it('does not apply binning when mode is categorical even if rules are present', () => {
    const config: RecodeConfig = {
      mode: 'categorical',
      rules: [{ min: 0, max: 18, label: 'Under 18' }],
    };

    expect(buildCaseSql('age', config)).toBe('CASE ELSE CAST("age" AS VARCHAR) END');
  });

  it('uses categorical path when mode is categorical with both mappings and rules', () => {
    const config: RecodeConfig = {
      mode: 'categorical',
      mappings: { '1': 'Yes' },
      rules: [{ min: 0, max: 18, label: 'Under 18' }],
    };

    expect(buildCaseSql('q1', config)).toBe('CASE WHEN "q1" = \'1\' THEN \'Yes\' ELSE CAST("q1" AS VARCHAR) END');
  });

  it('escapes single quotes in binning rule labels', () => {
    const config: RecodeConfig = {
      mode: 'binning',
      rules: [{ min: 65, label: "65+' years" }],
    };

    expect(buildCaseSql('age', config)).toBe(
      'CASE WHEN "age" >= 65 THEN \'65+\'\' years\' ELSE CAST("age" AS VARCHAR) END',
    );
  });
});
