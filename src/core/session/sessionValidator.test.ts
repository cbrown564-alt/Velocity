import { describe, expect, it } from 'vitest';
import { SESSION_FORMAT_VERSION } from './sessionTypes';
import { parseSessionFile, validateDatasetMatch, validateSessionFile } from './sessionValidator';

const validSession = {
  formatVersion: SESSION_FORMAT_VERSION,
  exportedAt: '2026-02-26T15:00:00.000Z',
  velocityVersion: '0.1.0',
  dataset: {
    originalFilename: 'wave7_2024.sav',
    rowCount: 1000,
    source: 'sav',
    fingerprint: {
      columnCount: 3,
      columnNames: ['q1', 'q2', 'q3'],
    },
  },
  variables: [],
  variableSets: [],
  folders: [],
  transformLog: [],
  tableConfig: { rowVars: [], colVar: null },
  activeFilters: [],
  slides: [],
  sections: [],
};

describe('validateSessionFile', () => {
  it('accepts a structurally valid session file', () => {
    const result = validateSessionFile(validSession);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects unsupported format versions', () => {
    const result = validateSessionFile({
      ...validSession,
      formatVersion: 99,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Unsupported formatVersion');
  });

  it('accepts v1 format version for backward compatibility', () => {
    const result = validateSessionFile({
      ...validSession,
      formatVersion: 1,
    });
    expect(result.valid).toBe(true);
  });

  it('parses valid JSON and throws on invalid shape', () => {
    const parsed = parseSessionFile(JSON.stringify(validSession));
    expect(parsed.dataset.originalFilename).toBe('wave7_2024.sav');

    expect(() => parseSessionFile(JSON.stringify({ hello: 'world' }))).toThrow('Invalid session file');
  });
});

describe('validateDatasetMatch', () => {
  it('returns strict_match when row count and columns are exact', () => {
    const result = validateDatasetMatch(validSession.dataset, {
      rowCount: 1000,
      columnNames: ['q1', 'q2', 'q3'],
    });
    expect(result.status).toBe('strict_match');
    expect(result.canProceed).toBe(true);
    expect(result.overlapRatio).toBe(1);
  });

  it('returns partial_match when overlap is >= 90%', () => {
    const result = validateDatasetMatch(validSession.dataset, {
      rowCount: 950,
      columnNames: ['q1', 'q2', 'q3', 'q4'],
    });
    expect(result.status).toBe('partial_match');
    expect(result.canProceed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns mismatch when overlap is below 90%', () => {
    const result = validateDatasetMatch(validSession.dataset, {
      rowCount: 1000,
      columnNames: ['q1'],
    });
    expect(result.status).toBe('mismatch');
    expect(result.canProceed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('ignores synthetic grid helper columns when validating a matching SAV', () => {
    const result = validateDatasetMatch({
      ...validSession.dataset,
      fingerprint: {
        columnCount: 4,
        columnNames: [
          'q1',
          'q2',
          'heuristic_grid_sleep_energy_scale',
          'heuristic_grid_sleep_energy_items',
        ],
      },
    }, {
      rowCount: 1000,
      columnNames: ['q1', 'q2'],
    }, {
      sessionVariables: [
        { id: 'q1' },
        { id: 'q2' },
        {
          id: 'heuristic_grid_sleep_energy_scale',
          synthetic: true,
          sourceGridId: 'heuristic_grid_sleep_energy',
        },
        {
          id: 'heuristic_grid_sleep_energy_items',
          synthetic: true,
          sourceGridId: 'heuristic_grid_sleep_energy',
        },
      ],
    });

    expect(result.status).toBe('strict_match');
    expect(result.canProceed).toBe(true);
    expect(result.expectedColumnCount).toBe(2);
    expect(result.actualColumnCount).toBe(2);
    expect(result.matchingColumnCount).toBe(2);
    expect(result.missingColumns).toEqual([]);
    expect(result.extraColumns).toEqual([]);
  });
});
