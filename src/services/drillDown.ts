import type { Filter } from '../store/slices/analysisSlice';

export interface DrillDownPathEntry {
  variable: string;
  value: string;
}

export interface DrillDownFilter {
  variable: string;
  value: string;
}

interface VariableSetLike {
  id: string;
  variableIds: string[];
}

interface VariableLike {
  id: string;
  label: string;
}

interface ResolveDrillDownContextArgs {
  rowPath: DrillDownPathEntry[];
  colValue: string | null;
  colVarId: string | null;
  variableSets: VariableSetLike[];
  variables: VariableLike[];
}

export interface DrillDownQueryOptionsInput {
  rowFilters: DrillDownFilter[];
  colFilter: DrillDownFilter | null;
  filters: Filter[];
  limit: number;
  offset: number;
}

export interface DrillDownQueryOptions {
  rowVars: DrillDownFilter[];
  colVar: string | null;
  colValue: string | null;
  filters: Filter[];
  limit: number;
  offset: number;
}

export function resolveDrillDownContext({
  rowPath,
  colValue,
  colVarId,
  variableSets,
  variables,
}: ResolveDrillDownContextArgs): {
  rowFilters: DrillDownFilter[];
  colFilter: DrillDownFilter | null;
  title: string;
} {
  const rowFilters: DrillDownFilter[] = rowPath.map((entry) => ({
    variable: entry.variable,
    value: entry.value,
  }));

  const resolvedColVar = colVarId ? resolveVariableSetToColumn(colVarId, variableSets) : null;
  const colFilter: DrillDownFilter | null = resolvedColVar && colValue
    ? { variable: resolvedColVar, value: colValue }
    : null;

  const variableLabelById = new Map(variables.map((v) => [v.id, v.label]));
  const titleParts = rowFilters.map((entry) => `${variableLabelById.get(entry.variable) ?? entry.variable}: ${entry.value}`);
  if (colFilter) {
    titleParts.push(`${variableLabelById.get(colFilter.variable) ?? colFilter.variable}: ${colFilter.value}`);
  }

  return {
    rowFilters,
    colFilter,
    title: titleParts.join(' • '),
  };
}

export function buildDrillDownQueryOptions(input: DrillDownQueryOptionsInput): DrillDownQueryOptions {
  return {
    rowVars: input.rowFilters,
    colVar: input.colFilter?.variable ?? null,
    colValue: input.colFilter?.value ?? null,
    filters: input.filters,
    limit: input.limit,
    offset: input.offset,
  };
}

function resolveVariableSetToColumn(id: string, variableSets: VariableSetLike[]): string {
  const varSet = variableSets.find((entry) => entry.id === id);
  if (!varSet || varSet.variableIds.length === 0) {
    return id;
  }
  return varSet.variableIds[0];
}
