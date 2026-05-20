import type { ProcessedAnalysisData } from '../../types/processedData';
import type { TableStats } from '../../types';

const SIG_RANK: Record<string, number> = {
  high_95: 4,
  high_80: 3,
  low_95: 2,
  low_80: 1,
};

/**
 * Generate a narrative title suggestion based on the most striking finding
 * in a crosstab result. Rule-based heuristic (not ML).
 */
export function generateNarrativeTitle(
  data: ProcessedAnalysisData | null,
  tableStats: TableStats | null,
  rowVarLabel: string,
  colVarLabel: string | null
): string | null {
  if (!data || data.rows.length === 0) return null;

  const columns = data.columns;
  const hasColVar = columns.length > 0 && colVarLabel;

  // 1. Chi-square significance: strongest table-level signal
  if (tableStats?.chiSquare && tableStats.chiSquare.pValue < 0.05) {
    if (hasColVar) {
      return `${colVarLabel} is a significant predictor of ${rowVarLabel}`;
    }
    return `Significant pattern detected in ${rowVarLabel}`;
  }

  // 2. Find the most significant cell
  let bestCell: {
    rowLabel: string;
    colLabel: string;
    sig: string;
    percent: number;
  } | null = null;

  for (const row of data.rows) {
    for (const [colKey, cell] of Object.entries(row.cells)) {
      if (!cell.sig) continue;
      const rank = SIG_RANK[cell.sig] ?? 0;
      if (rank === 0) continue;

      const colLabel = columns.find((c) => c.key === colKey)?.label || colKey;

      if (
        !bestCell ||
        rank > SIG_RANK[bestCell.sig] ||
        (rank === SIG_RANK[bestCell.sig] && cell.percent > bestCell.percent)
      ) {
        bestCell = {
          rowLabel: row.label,
          colLabel,
          sig: cell.sig,
          percent: cell.percent,
        };
      }
    }
  }

  if (bestCell) {
    const direction = bestCell.sig.startsWith('high') ? 'over-represented' : 'under-represented';
    if (hasColVar) {
      return `${bestCell.rowLabel} respondents are ${direction} in ${bestCell.colLabel}`;
    }
    return `${bestCell.rowLabel} is ${direction}`;
  }

  // 3. No significance — measure variation
  let maxDeviation = 0;
  for (const row of data.rows) {
    const percents = Object.values(row.cells).map((c) => c.percent);
    if (percents.length < 2) continue;
    const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
    const deviation = Math.max(...percents.map((p) => Math.abs(p - avg)));
    if (deviation > maxDeviation) maxDeviation = deviation;
  }

  if (maxDeviation < 5) {
    if (hasColVar) {
      return `${rowVarLabel} is relatively even across ${colVarLabel} categories`;
    }
    return `${rowVarLabel} is relatively evenly distributed`;
  }

  if (hasColVar) {
    return `${rowVarLabel} distribution varies by ${colVarLabel}`;
  }
  return `${rowVarLabel} shows meaningful variation`;
}
