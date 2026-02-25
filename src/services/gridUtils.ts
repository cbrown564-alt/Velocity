import { Variable, VariableSet } from '../types';
import { normalizeVariableType } from '../types';

/**
 * Generate synthetic variables for a grid VariableSet
 * Creates:
 * 1. Scale variable (representing the rows)
 * 2. Items variable (representing the columns)
 */
export function generateSyntheticGridVariables(variableSet: VariableSet): Variable[] {
    if (!variableSet.gridMetadata) return [];

    const { id, name, gridMetadata } = variableSet;
    const { sharedScale, itemLabels } = gridMetadata;

    // 1. Scale Variable (Rows)
    // This represents the rating values (1-5, Agree-Disagree, etc.)
    const scaleVariable: Variable = {
        id: `${id}_scale`,
        name: `${name}_scale`, // Suffix for unique naming
        label: name,
        type: normalizeVariableType(sharedScale.type),
        orderedStyle: sharedScale.orderedStyle,
        orderedScoring: sharedScale.orderedScoring,
        // Restore value labels so table rows show text (e.g. "Not at all")
        // Sorting logic in DataTable will handle numeric sorting based on these values
        valueLabels: Object.entries(sharedScale.valueLabels).map(([val, label]) => ({
            value: Number(val),
            label
        })),
        missingValues: { discrete: [], range: undefined },
        synthetic: true,
        sourceGridId: id
    };

    // 2. Items Variable (Columns)
    // This represents the items being rated (Product A, Product B, etc.)
    const itemsVariable: Variable = {
        id: `${id}_items`,
        name: `${id}_items`, // ID-based name to avoid collisions
        label: name,
        type: 'categorical', // Items are always unordered categories
        valueLabels: itemLabels.map((label, index) => ({
            value: index,
            label
        })),
        missingValues: { discrete: [], range: undefined },
        synthetic: true,
        sourceGridId: id
    };

    return [scaleVariable, itemsVariable];
}
