
import { useMemo } from 'react';
import { useVelocityStore } from '../../../store';
import { Variable, VariableSet } from '../../../types';

interface ResolvedVariables {
    resolvedRowVars: Variable[];
    resolvedColVar: Variable | null;
    /** The first variable set in the row config (useful for checking structure like multiple/grid) */
    firstRowVarSet: VariableSet | undefined;
}

/**
 * Hook to resolve VariableSet IDs from the table configuration into 
 * actual Variable objects for use in charts and tables.
 * 
 * Handles looking up the Set, falling back to Variable ID, 
 * and handling single-variable sets vs sets with multiple variables.
 */
export const useResolvedVariables = (): ResolvedVariables => {
    // Selectors
    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const variableSets = useVelocityStore((state) => state.variableSets);
    const allVariables = useVelocityStore((state) => state.dataset?.variables || []);

    return useMemo(() => {
        const resolveVarSetToVariable = (varSetId: string): Variable | null => {
            // 1. Find the VariableSet
            const varSet = variableSets.find(vs => vs.id === varSetId);

            // If not found OR empty, check if the ID is directly a variable ID (fallback)
            if (!varSet || varSet.variableIds.length === 0) {
                return allVariables.find(v => v.id === varSetId) || null;
            }

            // 2. Get the primary variable from the set (usually the first one)
            // For analysis visualization (table/chart), we typically visualize the "primary" variable content
            const primaryVarId = varSet.variableIds[0];
            const variable = allVariables.find(v => v.id === primaryVarId);

            if (variable) {
                // Return variable with label from VariableSet if available to ensure
                // the UI shows the Set name (e.g. "Satisfaction") rather than the underlying variable label (e.g. "Q1_Sat")
                // if the Set name is more descriptive/consolidated.
                return {
                    ...variable,
                    label: varSet.name || variable.label,
                };
            }

            return null;
        };

        const rowVars = tableConfig.rowVars
            .map(resolveVarSetToVariable)
            .filter((v): v is Variable => v !== null);

        const colVar = tableConfig.colVar
            ? resolveVarSetToVariable(tableConfig.colVar)
            : null;

        const firstRowVarSet = tableConfig.rowVars.length > 0
            ? variableSets.find(vs => vs.id === tableConfig.rowVars[0])
            : undefined;

        return {
            resolvedRowVars: rowVars,
            resolvedColVar: colVar,
            firstRowVarSet
        };
    }, [tableConfig.rowVars, tableConfig.colVar, variableSets, allVariables]);
};
