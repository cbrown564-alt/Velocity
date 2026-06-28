import type { CrosstabQueryOptions } from '../sql/queryBuilder';
import type { Dataset, Filter, Variable, VariableSet } from '../../types';
import { allowsNumericStats } from '../../types';

interface AnalysisSignificanceSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.9 | 0.8;
}

interface BuildCrosstabRequestParams {
  dataset: Dataset;
  variableSets: VariableSet[];
  rowVars: string[];
  colVar: string | null;
  filters: Filter[];
  weightVar?: string | null;
  analysisSettings?: AnalysisSignificanceSettings;
}

interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

interface BuildCrosstabRequestResult {
  options: CrosstabQueryOptions & { includeDistributions?: boolean };
  context: CrosstabContext;
  analysisSettings?: AnalysisSignificanceSettings;
  isWeighted: boolean;
  measureVarId?: string;
}

export const buildCrosstabRequest = ({
  dataset,
  variableSets,
  rowVars,
  colVar,
  filters,
  weightVar,
  analysisSettings,
}: BuildCrosstabRequestParams): BuildCrosstabRequestResult => {
  const resolvedWeightVar = weightVar ?? dataset.weightVariable ?? null;

  const options: CrosstabQueryOptions & { includeDistributions?: boolean } = {
    rowVars: [],
    colVar,
    filters,
    weightVar: resolvedWeightVar || undefined,
  };

  const contextVariables: Record<string, Variable> = {};
  const contextVariableSets: Record<string, VariableSet> = {};

  const addToContext = (varId: string) => {
    const variable = dataset.variables.find((v) => v.id === varId);
    if (variable) contextVariables[varId] = variable;
  };

  const resolveSourceSet = (variableId: string) => {
    const variable = dataset.variables.find((v) => v.id === variableId);
    if (variable?.synthetic && variable.sourceGridId) {
      const sourceSet = variableSets.find((s) => s.id === variable.sourceGridId);
      if (sourceSet) {
        contextVariableSets[sourceSet.id] = sourceSet;
        sourceSet.variableIds.forEach((vid) => addToContext(vid));
      }
    }
  };

  rowVars.forEach((vid) => {
    addToContext(vid);
    resolveSourceSet(vid);
  });
  if (colVar) {
    addToContext(colVar);
    resolveSourceSet(colVar);
  }

  const firstRowVarSet = variableSets.find((s) => s.id === rowVars[0]);
  const colVarSet = colVar ? variableSets.find((s) => s.id === colVar) : null;
  let measureVarId: string | undefined;

  if (firstRowVarSet?.structure === 'multiple') {
    options.multipleColumns = firstRowVarSet.variableIds.map((varId) => {
      const variable = dataset.variables.find((v) => v.id === varId);
      return {
        name: varId,
        label: variable?.label || varId,
        countedValue: firstRowVarSet.countedValue ?? 1,
      };
    });
  } else if (colVarSet?.structure === 'multiple') {
    const resolveToCol = (id: string): string => {
      const variable = dataset.variables.find((v) => v.id === id);
      if (variable) return id;
      const varSet = variableSets.find((s) => s.id === id);
      if (varSet && varSet.variableIds.length > 0) {
        return varSet.variableIds[0];
      }
      return id;
    };

    options.rowVars = rowVars.map(resolveToCol);
    options.colVar = null;
    options.columnMultipleColumns = colVarSet.variableIds.map((varId) => {
      const variable = dataset.variables.find((v) => v.id === varId);
      return {
        name: varId,
        label: variable?.label || varId,
        countedValue: colVarSet.countedValue ?? 1,
      };
    });
    colVarSet.variableIds.forEach((varId) => addToContext(varId));
  } else if (
    allowsNumericStats(firstRowVarSet?.type, firstRowVarSet?.orderedScoring) ||
    (colVar &&
      allowsNumericStats(
        variableSets.find((s) => s.id === colVar)?.type,
        variableSets.find((s) => s.id === colVar)?.orderedScoring,
      ))
  ) {
    const colVarSet = colVar ? variableSets.find((s) => s.id === colVar) : null;
    const isRowScale = allowsNumericStats(firstRowVarSet?.type, firstRowVarSet?.orderedScoring);

    const measureVarSet = isRowScale ? firstRowVarSet! : colVarSet!;
    measureVarId = measureVarSet.variableIds[0];

    options.measureVar = measureVarId;
    options.measureLabel = measureVarSet.name;
    options.includeDistributions = true;

    addToContext(measureVarId);

    if (isRowScale) {
      const col = colVar ? colVarSet?.variableIds[0] || colVar : null;
      options.colVar = col;
    } else {
      const resolveToCol = (id: string): string => {
        const varSet = variableSets.find((s) => s.id === id);
        if (varSet && varSet.variableIds.length > 0) {
          return varSet.variableIds[0];
        }
        return id;
      };
      options.rowVars = rowVars.map(resolveToCol);
      options.colVar = null;
    }
  } else {
    const resolveToCol = (id: string): string => {
      const variable = dataset.variables.find((v) => v.id === id);
      if (variable) return id;
      const varSet = variableSets.find((s) => s.id === id);
      if (varSet && varSet.variableIds.length > 0) {
        return varSet.variableIds[0];
      }
      return id;
    };

    options.rowVars = rowVars.map(resolveToCol);
    options.colVar = colVar ? resolveToCol(colVar) : null;
  }

  return {
    options,
    context: {
      variables: contextVariables,
      variableSets: contextVariableSets,
    },
    analysisSettings: analysisSettings
      ? {
          comparisonMethod: analysisSettings.comparisonMethod,
          correctionType: analysisSettings.correctionType,
          significanceLevel: analysisSettings.significanceLevel,
        }
      : undefined,
    isWeighted: !!resolvedWeightVar,
    measureVarId,
  };
};
