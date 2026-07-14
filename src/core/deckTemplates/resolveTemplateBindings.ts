import type { Variable, VariableSet } from '../../types';

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function findVariableSetIdByVariableName(
  variableSets: VariableSet[],
  variables: Variable[],
  names: string[],
): string | null {
  const wanted = new Set(names.map(normalizeName));
  const match = variableSets.find((set) =>
    set.variableIds.some((id) => {
      const variable = variables.find((v) => v.id === id);
      if (!variable) return false;
      const variableName = normalizeName(variable.name ?? variable.id);
      const variableId = normalizeName(variable.id);
      return wanted.has(variableName) || wanted.has(variableId);
    }),
  );
  return match?.id ?? null;
}

export function findVariableIdByName(variables: Variable[], names: string[]): string | null {
  const wanted = new Set(names.map(normalizeName));
  const match = variables.find((variable) => {
    const variableName = normalizeName(variable.name ?? variable.id);
    const variableId = normalizeName(variable.id);
    return wanted.has(variableName) || wanted.has(variableId);
  });
  return match?.id ?? null;
}
