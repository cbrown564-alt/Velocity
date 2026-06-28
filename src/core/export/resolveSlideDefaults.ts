import type { Filter, Variable } from '../../types';
import { toTitleCase } from '../text/displayCase';

type LabeledValue = Pick<Variable, 'id' | 'name' | 'label'>;

function getDisplayLabel(value: LabeledValue): string {
  return value.label || value.name || value.id;
}

const OPERATOR_LABELS: Record<Filter['operator'], string> = {
  eq: '=',
  neq: '≠',
  in: 'in',
  gt: '>',
  lt: '<',
};

function renderFilter(filter: Filter, variableLabels?: Record<string, string>): string {
  const varLabel = variableLabels?.[filter.variableId] ?? filter.variableId;
  const op = OPERATOR_LABELS[filter.operator];
  const val = Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value);
  return `${varLabel} ${op} ${val}`;
}

export function resolveSlideTitle(rowVars: LabeledValue[], colVar: LabeledValue | null): string {
  if (rowVars.length === 0) return 'New Slide';

  const rowLabels = rowVars.map(getDisplayLabel);
  if (!colVar) {
    const raw = rowLabels.length > 1 ? rowLabels.join(' > ') : rowLabels[0];
    return toTitleCase(raw);
  }

  return toTitleCase(`${rowLabels.join(' > ')} by ${getDisplayLabel(colVar)}`);
}

export function resolveSlideSubtitle(
  filters: Filter[],
  weightVar: LabeledValue | null,
  rowCount: number,
  isWeighted: boolean,
  variableLabels?: Record<string, string>,
): string {
  const parts: string[] = [];

  if (filters.length > 0) {
    const MAX_INLINE = 2;
    const inline = filters.slice(0, MAX_INLINE).map((f) => renderFilter(f, variableLabels));
    const overflow = filters.length - MAX_INLINE;
    const filterStr = overflow > 0 ? `${inline.join(', ')} +${overflow} more` : inline.join(', ');
    parts.push(`Filtered: ${filterStr}`);
  }

  if (isWeighted && weightVar) {
    parts.push(`Weighted by ${getDisplayLabel(weightVar)}`);
  }

  const nValue = `N = ${rowCount.toLocaleString()} Respondents`;
  return parts.length > 0 ? `${parts.join(' · ')} · ${nValue}` : nValue;
}
