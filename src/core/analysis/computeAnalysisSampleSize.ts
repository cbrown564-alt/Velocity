import type { AggregatedRow } from '../../types';

/**
 * Effective respondent count (N) from crosstab marginal rows.
 * Uses top-level `Total` column marginals so filtered bases match table totals.
 */
export function computeAnalysisSampleSize(data: AggregatedRow[], options?: { isWeighted?: boolean }): number | null {
  if (data.length === 0) return null;

  const isWeighted = options?.isWeighted ?? false;
  const totalMarginals = data.filter((d) => d.colKey === 'Total');
  if (totalMarginals.length === 0) return null;

  const minDepth = Math.min(...totalMarginals.map((d) => d.rowKeys.length));
  const topLevel = totalMarginals.filter((d) => d.rowKeys.length === minDepth);

  const sum = topLevel.reduce((acc, d) => {
    const n = isWeighted && d.weightedCount !== undefined ? d.weightedCount : d.count;
    return acc + n;
  }, 0);

  return sum > 0 ? Math.round(sum) : null;
}
