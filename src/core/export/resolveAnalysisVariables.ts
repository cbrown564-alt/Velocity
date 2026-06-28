import type { Variable, VariableSet } from '../../types';
import type { SlideAnalysisState } from '../../types/slides';

interface ResolvedAnalysisVariables {
  rowVariables: Variable[];
  colVariable: Variable | null;
  firstRowVarSet: VariableSet | undefined;
}

export const resolveAnalysisVariables = (
  analysisState: SlideAnalysisState,
  variableSets: VariableSet[],
  variables: Variable[],
): ResolvedAnalysisVariables => {
  const resolveVarSetToVariable = (varSetId: string): Variable | null => {
    const varSet = variableSets.find((vs) => vs.id === varSetId);

    if (!varSet || varSet.variableIds.length === 0) {
      return variables.find((v) => v.id === varSetId) || null;
    }

    const primaryVarId = varSet.variableIds[0];
    const variable = variables.find((v) => v.id === primaryVarId);

    if (variable) {
      return {
        ...variable,
        label: varSet.name || variable.label,
      };
    }

    return null;
  };

  const rowVariables = analysisState.rowVars.map(resolveVarSetToVariable).filter((v): v is Variable => v !== null);

  const colVariable = analysisState.colVar ? resolveVarSetToVariable(analysisState.colVar) : null;

  const firstRowVarSet =
    analysisState.rowVars.length > 0 ? variableSets.find((vs) => vs.id === analysisState.rowVars[0]) : undefined;

  return { rowVariables, colVariable, firstRowVarSet };
};
