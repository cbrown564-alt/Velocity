/**
 * UXP-002: proportional column widths for fixed-layout crosstabs.
 * Weights columns by header label length with a floor for numeric stacks (% + n=).
 */

const ROW_LABEL_PCT = 28;
const TOTAL_COL_PCT = 8;
const NUMERIC_FLOOR = 8;

export interface CrosstabColumnWidths {
  rowLabel: string;
  columns: Record<string, string>;
  total?: string;
}

export function computeCrosstabColumnWidths(
  colKeys: string[],
  colLabels: Record<string, string>,
  hasTotalColumn: boolean,
): CrosstabColumnWidths {
  if (colKeys.length === 0) {
    return { rowLabel: `${ROW_LABEL_PCT}%`, columns: {} };
  }

  const weights = colKeys.map((key) => {
    const raw = colLabels[key] ?? key;
    const label = raw == null ? '' : String(raw);
    return Math.max(label.length, NUMERIC_FLOOR);
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const dataBudget = hasTotalColumn ? 100 - ROW_LABEL_PCT - TOTAL_COL_PCT : 100 - ROW_LABEL_PCT;

  const columns: Record<string, string> = {};
  colKeys.forEach((key, index) => {
    const pct = (dataBudget * weights[index]) / weightSum;
    columns[key] = `${pct.toFixed(2)}%`;
  });

  return {
    rowLabel: `${ROW_LABEL_PCT}%`,
    columns,
    total: hasTotalColumn ? `${TOTAL_COL_PCT}%` : undefined,
  };
}
