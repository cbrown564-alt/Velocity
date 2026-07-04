import type { Dataset, Variable, VariableSet } from '../../types/dataset';
import type { VariableStatsResult } from '../../types/worker';
import { isCategoricalType, normalizeVariableType } from '../../types';

export interface VariableRowDisplay {
  monoName: string;
  label: string;
  meta: string;
}

export function getPrimaryVariable(variableSet: VariableSet, dataset: Dataset | null): Variable | null {
  if (!dataset || variableSet.variableIds.length === 0) return null;
  const variable = dataset.variables.find((v) => v.id === variableSet.variableIds[0]);
  return variable ?? null;
}

function getStructureMeta(variableSet: VariableSet): string | null {
  const count = variableSet.variableIds.length;
  if (variableSet.structure === 'grid' && count > 1) return `Grid · ${count}`;
  if (variableSet.structure === 'multiple' && count > 1) return `Multi (${count})`;
  if (count > 1) return `${count} items`;
  return null;
}

function formatTopCategory(
  stats: VariableStatsResult,
  variable: Variable | null,
): { label: string; percent: number } | null {
  if (!stats.frequencies.length) return null;

  const sorted = [...stats.frequencies].sort((a, b) => b.count - a.count);
  const topItem = sorted[0];
  let label = String(topItem.value);

  if (variable?.valueLabels) {
    const valueLabel = variable.valueLabels.find((vl) => vl.value === (topItem.value as never));
    if (valueLabel) label = valueLabel.label;
  }

  const percent = stats.totalCount > 0 ? (topItem.count / stats.totalCount) * 100 : 0;
  return { label, percent };
}

export function getVariableRowDisplay(
  variableSet: VariableSet,
  dataset: Dataset | null,
  stats: VariableStatsResult | null | undefined,
): VariableRowDisplay {
  const primaryVariable = getPrimaryVariable(variableSet, dataset);
  const structureMeta = getStructureMeta(variableSet);

  const monoName = primaryVariable?.name ?? variableSet.name;
  const label =
    primaryVariable?.label && primaryVariable.label.trim() !== '' ? primaryVariable.label : variableSet.name;

  if (structureMeta) {
    return { monoName, label, meta: structureMeta };
  }

  if (!stats) {
    return { monoName, label, meta: '' };
  }

  const type = normalizeVariableType(variableSet.type || primaryVariable?.type || 'categorical');
  const validCount = Math.max(0, stats.totalCount - stats.missingCount);

  if (isCategoricalType(type) || type === 'text') {
    const top = formatTopCategory(stats, primaryVariable);
    if (top) {
      const shortLabel = top.label.length > 18 ? `${top.label.slice(0, 16)}…` : top.label;
      return { monoName, label, meta: `${shortLabel} ${top.percent.toFixed(0)}%` };
    }
    if (stats.frequencies.length > 0) {
      return { monoName, label, meta: `${stats.frequencies.length} values` };
    }
  }

  if (type === 'numeric' || type === 'ordered') {
    if (stats.numeric?.mean !== undefined) {
      return { monoName, label, meta: `μ ${stats.numeric.mean.toFixed(1)}` };
    }
    const top = formatTopCategory(stats, primaryVariable);
    if (top) return { monoName, label, meta: `${top.percent.toFixed(0)}%` };
  }

  if (type === 'date') {
    return { monoName, label, meta: `${validCount.toLocaleString()} valid` };
  }

  if (stats.frequencies.length > 0) {
    const uniqueCount = stats.frequencies.length;
    return { monoName, label, meta: `${uniqueCount.toLocaleString()} unique` };
  }

  return { monoName, label, meta: validCount > 0 ? `${validCount.toLocaleString()} valid` : '' };
}
