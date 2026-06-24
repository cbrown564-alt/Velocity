import { Variable, VariableSet } from '../../types';
import { normalizeVariableType } from '../../types';

export type GridTableConfigMode = 'full' | 'row-scale-col-items';

export type GridDropTarget = 'drop-zone-rows' | 'drop-zone-cols' | 'canvas';

export type CanvasPlacementTarget = GridDropTarget;

export type TableConfigSnapshot = {
    rowVars: string[];
    colVar: string | null;
};

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

/**
 * Compute a table-config patch for placing a variable set on a shelf or the canvas.
 * Returns null when the placement is a no-op (e.g. duplicate row drop).
 */
export function placeVariableSet(
    setId: string,
    structure: VariableSet['structure'],
    target: CanvasPlacementTarget,
    current: TableConfigSnapshot,
): Partial<TableConfigSnapshot> | null {
    if (structure === 'grid') {
        return applyGridSetDrop(setId, target, current);
    }

    switch (target) {
        case 'drop-zone-rows':
            if (current.rowVars.includes(setId)) {
                return null;
            }
            return { rowVars: [...current.rowVars, setId] };
        case 'drop-zone-cols':
            return { colVar: setId };
        case 'canvas':
            if (current.rowVars.length === 0) {
                return { rowVars: [setId] };
            }
            return { colVar: setId };
        default: {
            const _exhaustive: never = target;
            return _exhaustive;
        }
    }
}

/** Canvas click / suggest placement (first row, then column). */
export function applyCanvasPlacement(
    setId: string,
    structure: VariableSet['structure'],
    current: TableConfigSnapshot,
): Partial<TableConfigSnapshot> {
    return placeVariableSet(setId, structure, 'canvas', current) ?? {};
}

/** Apply grid set drop onto a dashboard table config for the given target zone. */
export function applyGridSetDrop(
    setId: string,
    target: GridDropTarget,
    current: TableConfigSnapshot,
): TableConfigSnapshot {
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
