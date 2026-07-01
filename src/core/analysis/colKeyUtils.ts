/** Stable column key for SQL null / blank crosstab column values. */
export const CROSSTAB_MISSING_COL_KEY = '(Missing)';

export const CROSSTAB_MISSING_COL_LABEL = '(Missing)';

export function normalizeCrosstabColKey(colKey: unknown): string {
  if (colKey === null || colKey === undefined || colKey === '') {
    return CROSSTAB_MISSING_COL_KEY;
  }
  return String(colKey);
}

export function resolveCrosstabColLabel(key: string, colVariable: { valueLabels?: { value: number | string; label: string }[] } | null): string {
  if (key === CROSSTAB_MISSING_COL_KEY) {
    return CROSSTAB_MISSING_COL_LABEL;
  }

  let label = key;
  if (colVariable?.valueLabels) {
    const found = colVariable.valueLabels.find((vl) => String(vl.value) === String(key));
    if (found?.label) {
      label = found.label;
    }
  }
  return label;
}
