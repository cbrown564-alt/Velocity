import type { Filter, Variable } from '../../types';

type LabeledValue = Pick<Variable, 'id' | 'name' | 'label'>;

function getDisplayLabel(value: LabeledValue): string {
  return value.label || value.name || value.id;
}

export function resolveSlideTitle(
  rowVars: LabeledValue[],
  colVar: LabeledValue | null
): string {
  if (rowVars.length === 0) return 'New Slide';

  const rowLabels = rowVars.map(getDisplayLabel);
  if (!colVar) {
    return rowLabels.length > 1 ? rowLabels.join(' > ') : rowLabels[0];
  }

  return `${rowLabels.join(' > ')} by ${getDisplayLabel(colVar)}`;
}

export function resolveSlideSubtitle(
  filters: Filter[],
  weightVar: LabeledValue | null,
  rowCount: number,
  isWeighted: boolean
): string {
  const parts: string[] = [];

  if (filters.length > 0) {
    parts.push(`Filtered: ${filters.length} active`);
  }

  if (isWeighted && weightVar) {
    parts.push(`Weighted by ${getDisplayLabel(weightVar)}`);
  }

  const nValue = `N = ${rowCount.toLocaleString()} Respondents`;
  return parts.length > 0 ? `${parts.join(' · ')} · ${nValue}` : nValue;
}
