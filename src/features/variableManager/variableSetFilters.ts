import type { Dataset, VariableSet } from '../../store/slices/dataSlice';

export function isSyntheticGridShellSet(
  variableSet: Pick<VariableSet, 'structure' | 'variableIds'>,
  dataset: Dataset | null | undefined
): boolean {
  if (!dataset) return false;
  if (variableSet.structure !== 'single' || variableSet.variableIds.length !== 1) return false;

  const variableId = variableSet.variableIds[0];
  const variable = dataset.variables.find(v => v.id === variableId);
  if (!variable?.synthetic || !variable.sourceGridId) return false;

  return (
    variableId === `${variable.sourceGridId}_scale` ||
    variableId === `${variable.sourceGridId}_items`
  );
}

export function filterSyntheticGridShellSets(
  variableSets: VariableSet[],
  dataset: Dataset | null | undefined
): VariableSet[] {
  return variableSets.filter(vs => !isSyntheticGridShellSet(vs, dataset));
}
