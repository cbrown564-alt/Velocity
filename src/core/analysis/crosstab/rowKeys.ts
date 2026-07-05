import type { CrosstabRowKeyFields } from './types';
import type { CrosstabSqlRow } from './types';

/**
 * Collect rowKey_0, rowKey_1, … in index order until the first gap.
 * Matches the sequential while-loop pattern used throughout crosstab analysis.
 */
export function extractRowKeys(row: CrosstabRowKeyFields): unknown[] {
  const keys: unknown[] = [];
  let i = 0;
  while (row[`rowKey_${i}`] !== undefined) {
    keys.push(row[`rowKey_${i}`]);
    i++;
  }
  return keys;
}

/** String form of extractRowKeys — used for map keys and chi-square row labels. */
export function extractRowKeyStrings(row: CrosstabRowKeyFields): string[] {
  return extractRowKeys(row).map((key) => String(key));
}

/** Join rowKey path with a separator (default '|' for significance / totals maps). */
export function joinRowKeyPath(row: CrosstabRowKeyFields, separator = '|'): string {
  return extractRowKeyStrings(row).join(separator);
}

/** Prefix nested frequency rows so they nest under a measure parent row in buildTree. */
export function prefixNestedCrosstabRows(rows: CrosstabSqlRow[], measureLabel: string): CrosstabSqlRow[] {
  return rows.map((row) => {
    const keys = extractRowKeys(row);
    const prefixed: CrosstabSqlRow = { ...row };
    prefixed.rowKey_0 = measureLabel;
    keys.forEach((key, index) => {
      prefixed[`rowKey_${index + 1}`] = key;
    });
    return prefixed;
  });
}

/** Normalize colKey from SQL rows for map lookups (defaults to 'Total'). */
export function getColKeyString(row: { colKey?: unknown }, fallback = 'Total'): string {
  return String(row.colKey || fallback);
}
