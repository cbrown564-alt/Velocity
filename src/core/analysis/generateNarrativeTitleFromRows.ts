import type { AggregatedRow, TableStats } from '../../types';

const SIG_RANK: Record<string, number> = {
  high_95: 4,
  high_80: 3,
  low_95: 2,
  low_80: 1,
};

interface LabelResolver {
  rowLabel?: (rowKey: string) => string | null;
  colLabel?: (colKey: string) => string | null;
}

/**
 * Lightweight narrative title generator that works directly with
 * AggregatedRow[] (query result) without requiring full ProcessedAnalysisData.
 */
export function generateNarrativeTitleFromRows(
  rows: AggregatedRow[] | null,
  tableStats: TableStats | null,
  rowVarLabel: string,
  colVarLabel: string | null,
  resolver?: LabelResolver,
): string | null {
  if (!rows || rows.length === 0) return null;

  const hasColVar = colVarLabel && rows.some((r) => r.colKey && r.colKey !== '_total');

  // 1. Chi-square significance
  if (tableStats?.chiSquare && tableStats.chiSquare.pValue < 0.05) {
    if (hasColVar) {
      return `${colVarLabel} is a significant predictor of ${rowVarLabel}`;
    }
    return `Significant pattern detected in ${rowVarLabel}`;
  }

  // 2. Find the most significant cell
  let bestCell: {
    rowKey: string;
    colKey: string;
    sig: string;
    count: number;
  } | null = null;

  for (const row of rows) {
    if (!row.sig) continue;
    const rank = SIG_RANK[row.sig] ?? 0;
    if (rank === 0) continue;

    if (!bestCell || rank > SIG_RANK[bestCell.sig] || (rank === SIG_RANK[bestCell.sig] && row.count > bestCell.count)) {
      bestCell = {
        rowKey: row.rowKeys[0] ?? 'Unknown',
        colKey: row.colKey || 'Unknown',
        sig: row.sig,
        count: row.count,
      };
    }
  }

  if (bestCell) {
    const direction = bestCell.sig.startsWith('high') ? 'over-represented' : 'under-represented';
    const rowLabel = resolver?.rowLabel?.(bestCell.rowKey) || bestCell.rowKey;
    const colLabel = resolver?.colLabel?.(bestCell.colKey) || bestCell.colKey;

    if (hasColVar && colLabel) {
      return `${rowLabel} respondents are ${direction} in ${colLabel}`;
    }
    return `${rowLabel} is ${direction}`;
  }

  // 3. Measure variation across columns for each row key
  // First compute column totals
  const colTotals = new Map<string, number>();
  for (const row of rows) {
    const total = colTotals.get(row.colKey) || 0;
    colTotals.set(row.colKey, total + row.count);
  }

  const rowGroups = new Map<string, number[]>();
  for (const row of rows) {
    const key = row.rowKeys[0];
    if (!key) continue;
    const existing = rowGroups.get(key) || [];
    const colTotal = colTotals.get(row.colKey) || 1;
    const pct = colTotal > 0 ? (row.count / colTotal) * 100 : 0;
    existing.push(pct);
    rowGroups.set(key, existing);
  }

  let maxDeviation = 0;
  for (const percents of rowGroups.values()) {
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
