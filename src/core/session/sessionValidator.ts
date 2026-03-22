import { SESSION_FORMAT_VERSION, SESSION_FORMAT_VERSION_V1 } from './sessionTypes';
import type { SessionDatasetDescriptor, VelocitySessionFile } from './sessionTypes';
import type { Variable } from '../../store/slices/dataSlice';

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export interface SessionFileValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DatasetMatchInput {
  rowCount: number;
  columnNames: string[];
}

export type DatasetMatchStatus = 'strict_match' | 'partial_match' | 'mismatch';

export interface DatasetMatchResult {
  status: DatasetMatchStatus;
  canProceed: boolean;
  overlapRatio: number;
  rowCountMatches: boolean;
  columnCountMatches: boolean;
  expectedColumnCount: number;
  actualColumnCount: number;
  matchingColumnCount: number;
  missingColumns: string[];
  extraColumns: string[];
  warnings: string[];
  issues: string[];
}

export interface DatasetMatchOptions {
  sessionVariables?: Pick<Variable, 'id' | 'synthetic' | 'sourceGridId'>[];
}

function isSyntheticGridFingerprintColumn(name: string): boolean {
  return name.startsWith('heuristic_grid_') && (name.endsWith('_scale') || name.endsWith('_items'));
}

function getIgnoredExpectedColumns(
  sessionVariables: DatasetMatchOptions['sessionVariables']
): Set<string> {
  const ignored = new Set<string>();

  for (const variable of sessionVariables ?? []) {
    if (variable.synthetic && variable.sourceGridId) {
      ignored.add(variable.id);
    }
  }

  return ignored;
}

function getComparableColumnNames(
  columnNames: string[],
  options: {
    ignoredColumns?: Set<string>;
  } = {}
): string[] {
  const ignoredColumns = options.ignoredColumns ?? new Set<string>();
  return Array.from(new Set(columnNames)).filter(
    (name) => !ignoredColumns.has(name) && !isSyntheticGridFingerprintColumn(name)
  );
}

export function validateSessionFile(candidate: unknown): SessionFileValidationResult {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ['Session file must be a JSON object'] };
  }

  const supportedVersions: unknown[] = [SESSION_FORMAT_VERSION_V1, SESSION_FORMAT_VERSION];
  if (!supportedVersions.includes(candidate.formatVersion)) {
    errors.push(`Unsupported formatVersion: ${String(candidate.formatVersion)}`);
  }

  if (typeof candidate.exportedAt !== 'string') {
    errors.push('Missing or invalid exportedAt timestamp');
  }

  if (typeof candidate.velocityVersion !== 'string') {
    errors.push('Missing or invalid velocityVersion');
  }

  const dataset = candidate.dataset;
  if (!isRecord(dataset)) {
    errors.push('Missing dataset descriptor');
  } else {
    if (typeof dataset.originalFilename !== 'string') {
      errors.push('dataset.originalFilename is required');
    }
    if (typeof dataset.rowCount !== 'number') {
      errors.push('dataset.rowCount is required');
    }
    if (dataset.source !== 'sav' && dataset.source !== 'csv' && dataset.source !== 'arrow') {
      errors.push('dataset.source must be one of: sav, csv, arrow');
    }

    const fingerprint = dataset.fingerprint;
    if (!isRecord(fingerprint)) {
      errors.push('dataset.fingerprint is required');
    } else {
      if (typeof fingerprint.columnCount !== 'number') {
        errors.push('dataset.fingerprint.columnCount is required');
      }
      if (!Array.isArray(fingerprint.columnNames) || !fingerprint.columnNames.every((name) => typeof name === 'string')) {
        errors.push('dataset.fingerprint.columnNames must be a string array');
      }
    }
  }

  if (!Array.isArray(candidate.variables)) {
    errors.push('variables array is required');
  }
  if (!Array.isArray(candidate.variableSets)) {
    errors.push('variableSets array is required');
  }
  if (!Array.isArray(candidate.folders)) {
    errors.push('folders array is required');
  }
  if (!Array.isArray(candidate.transformLog)) {
    errors.push('transformLog array is required');
  }
  if (!Array.isArray(candidate.activeFilters)) {
    errors.push('activeFilters array is required');
  }
  if (!Array.isArray(candidate.slides)) {
    errors.push('slides array is required');
  }
  if (!Array.isArray(candidate.sections)) {
    errors.push('sections array is required');
  }

  if (!isRecord(candidate.tableConfig)) {
    errors.push('tableConfig is required');
  }

  return { valid: errors.length === 0, errors };
}

export function parseSessionFile(raw: string): VelocitySessionFile {
  const parsed: unknown = JSON.parse(raw);
  const validation = validateSessionFile(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid session file: ${validation.errors.join('; ')}`);
  }
  return parsed as VelocitySessionFile;
}

export function validateDatasetMatch(
  expected: SessionDatasetDescriptor,
  actual: DatasetMatchInput,
  options: DatasetMatchOptions = {}
): DatasetMatchResult {
  const ignoredExpectedColumns = getIgnoredExpectedColumns(options.sessionVariables);
  const expectedColumns = getComparableColumnNames(expected.fingerprint.columnNames, {
    ignoredColumns: ignoredExpectedColumns,
  });
  const actualColumns = getComparableColumnNames(actual.columnNames);
  const actualSet = new Set(actualColumns);
  const expectedSet = new Set(expectedColumns);

  const matchingColumns = expectedColumns.filter((name) => actualSet.has(name));
  const missingColumns = expectedColumns.filter((name) => !actualSet.has(name));
  const extraColumns = actualColumns.filter((name) => !expectedSet.has(name));
  const overlapRatio = expectedColumns.length === 0 ? 0 : matchingColumns.length / expectedColumns.length;
  const rowCountMatches = expected.rowCount === actual.rowCount;
  const columnCountMatches = expectedColumns.length === actualColumns.length;

  let status: DatasetMatchStatus;
  if (overlapRatio === 1 && rowCountMatches && columnCountMatches) {
    status = 'strict_match';
  } else if (overlapRatio >= 0.9) {
    status = 'partial_match';
  } else {
    status = 'mismatch';
  }

  const warnings: string[] = [];
  const issues: string[] = [];

  if (!rowCountMatches) {
    const message = `Row count differs (expected ${expected.rowCount.toLocaleString()}, got ${actual.rowCount.toLocaleString()})`;
    if (status === 'mismatch') issues.push(message);
    else warnings.push(message);
  }

  if (status === 'partial_match') {
    warnings.push(
      `Dataset columns overlap ${(overlapRatio * 100).toFixed(1)}% (${matchingColumns.length}/${expectedColumns.length})`
    );
  } else if (status === 'mismatch') {
    issues.push(
      `Dataset columns overlap ${(overlapRatio * 100).toFixed(1)}% (${matchingColumns.length}/${expectedColumns.length})`
    );
  }

  return {
    status,
    canProceed: status !== 'mismatch',
    overlapRatio,
    rowCountMatches,
    columnCountMatches,
    expectedColumnCount: expectedColumns.length,
    actualColumnCount: actualColumns.length,
    matchingColumnCount: matchingColumns.length,
    missingColumns,
    extraColumns,
    warnings,
    issues,
  };
}
