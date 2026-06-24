import {
  calculateChiSquare,
  ChiSquareResult,
} from '../../stats/statistics';
import type { CrosstabQueryOptions } from '../../sql/queryBuilder';
import { joinRowKeyPath } from './rowKeys';
import type { CrosstabSqlRow } from './types';

/**
 * Compute chi-square independence test for categorical crosstabs.
 * Uses raw `r.colKey` equality (not getColKeyString) for column label matching.
 */
export function computeChiSquareTableStats(
  options: CrosstabQueryOptions,
  rows: CrosstabSqlRow[]
): { chiSquare?: ChiSquareResult } | undefined {
  if (!options.colVar || options.measureVar || options.gridAggregate) {
    return undefined;
  }

  try {
    const rowLabels = [...new Set(rows.map(r => joinRowKeyPath(r)))];
    const colLabels = [...new Set(rows.map(r => r.colKey).filter(k => k !== 'Total'))];

    if (rowLabels.length > 1 && colLabels.length > 1) {
      const contingencyTable: number[][] = [];

      for (const rowLabel of rowLabels) {
        const tableRow: number[] = [];
        for (const colLabel of colLabels) {
          const cell = rows.find(r =>
            joinRowKeyPath(r) === rowLabel && r.colKey === colLabel
          );
          const count = cell ? (cell.weightedCount ?? cell.count ?? 0) : 0;
          tableRow.push(count);
        }
        contingencyTable.push(tableRow);
      }

      const chiSquareResult = calculateChiSquare(contingencyTable);
      return { chiSquare: chiSquareResult };
    }
  } catch (e) {
    console.warn('Chi-square calculation failed:', e);
  }

  return undefined;
}
