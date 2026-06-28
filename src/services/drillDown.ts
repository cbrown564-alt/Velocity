import type { Filter } from '../types';

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
  structure?: 'single' | 'grid' | 'multiple';
  countedValue?: number;
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
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));

  const rowFilters: DrillDownFilter[] = rowPath.map((entry) =>
    resolvePathEntryFilter(entry, variableSets, variableById),
  );

  const colFilter: DrillDownFilter | null =
    colVarId && colValue ? resolveColumnFilter(colVarId, colValue, variableSets, variableById) : null;

  const variableLabelById = new Map(variables.map((v) => [v.id, v.label]));
  const titleParts = rowPath.map(
    (entry) => `${variableLabelById.get(entry.variable) ?? entry.variable}: ${entry.value}`,
  );
  if (colFilter && colValue) {
    titleParts.push(`${variableLabelById.get(colFilter.variable) ?? colFilter.variable}: ${colValue}`);
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

function resolvePathEntryFilter(
  entry: DrillDownPathEntry,
  variableSets: VariableSetLike[],
  variableById: Map<string, VariableLike>,
): DrillDownFilter {
  const sourceSet = variableSets.find((set) => set.variableIds.includes(entry.variable));
  if (!sourceSet || sourceSet.structure !== 'multiple') {
    return {
      variable: entry.variable,
      value: entry.value,
    };
  }

  const matchedMember = findVariableByLabel(sourceSet.variableIds, entry.value, variableById);
  if (!matchedMember) {
    return {
      variable: entry.variable,
      value: entry.value,
    };
  }

  return {
    variable: matchedMember.id,
    value: String(sourceSet.countedValue ?? 1),
  };
}

function resolveColumnFilter(
  colVarId: string,
  colValue: string,
  variableSets: VariableSetLike[],
  variableById: Map<string, VariableLike>,
): DrillDownFilter {
  const colVarSet = variableSets.find((entry) => entry.id === colVarId);
  if (colVarSet?.structure === 'multiple') {
    const matchedMember = findVariableByLabel(colVarSet.variableIds, colValue, variableById);
    if (matchedMember) {
      return {
        variable: matchedMember.id,
        value: String(colVarSet.countedValue ?? 1),
      };
    }
  }

  return {
    variable: resolveVariableSetToColumn(colVarId, variableSets),
    value: colValue,
  };
}

function findVariableByLabel(
  variableIds: string[],
  displayValue: string,
  variableById: Map<string, VariableLike>,
): VariableLike | undefined {
  const normalizedTarget = normalizeForMatch(displayValue);
  return variableIds
    .map((id) => variableById.get(id))
    .find((variable) => variable && normalizeForMatch(variable.label) === normalizedTarget);
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}
