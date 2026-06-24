import { Variable, VariableSet } from '../types';
import { normalizeVariableType } from '../types';

export type GridTableConfigMode = 'full' | 'row-scale-col-items';

export type GridDropTarget = 'drop-zone-rows' | 'drop-zone-cols' | 'canvas';

/** Synthetic variable ids for a grid VariableSet. */
export function gridSyntheticVarIds(setId: string): { scaleId: string; itemsId: string } {
    return { scaleId: `${setId}_scale`, itemsId: `${setId}_items` };
}

/**
 * Map a grid set id to table row/col synthetic variable ids.
 * `full` and `row-scale-col-items` both use scale on rows and items on columns
 * (click-to-analyze and canvas drop behavior).
 */
export function gridSetToTableConfig(
    setId: string,
    mode: GridTableConfigMode = 'full',
): { rowVars: string[]; colVar: string } {
    const { scaleId, itemsId } = gridSyntheticVarIds(setId);
    switch (mode) {
        case 'full':
        case 'row-scale-col-items':
            return { rowVars: [scaleId], colVar: itemsId };
        default: {
            const _exhaustive: never = mode;
            return _exhaustive;
        }
    }
}

/** Apply grid set drop onto a dashboard table config for the given target zone. */
export function applyGridSetDrop(
    setId: string,
    target: GridDropTarget,
    current: { rowVars: string[]; colVar: string | null },
): { rowVars: string[]; colVar: string | null } {
    const { scaleId, itemsId } = gridSyntheticVarIds(setId);
    switch (target) {
        case 'drop-zone-rows':
            if (current.rowVars.includes(scaleId)) {
                return current;
            }
            return { rowVars: [...current.rowVars, scaleId], colVar: itemsId };
        case 'drop-zone-cols':
            return {
                colVar: scaleId,
                rowVars: current.rowVars.includes(itemsId)
                    ? current.rowVars
                    : [...current.rowVars, itemsId],
            };
        case 'canvas':
            return gridSetToTableConfig(setId, 'full');
        default: {
            const _exhaustive: never = target;
            return _exhaustive;
        }
    }
}

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
