import { useState, useCallback } from 'react';
import { MergeItem, MergeEvent } from '../types/charts';
import { useVelocityStore } from '../store';

interface MergeModalState {
    isOpen: boolean;
    sourceItems: MergeItem[];
    targetItem: MergeItem | null;
    variableId: string | null;
}

const INITIAL_STATE: MergeModalState = {
    isOpen: false,
    sourceItems: [],
    targetItem: null,
    variableId: null,
};

/**
 * Shared merge orchestration: manages the modal state + recodeVariable call
 * for both chart drag-to-merge and table drag-to-merge.
 */
export const useMergeOrchestration = (fallbackVariableId?: string) => {
    const [mergeModal, setMergeModal] = useState<MergeModalState>(INITIAL_STATE);
    const recodeVariable = useVelocityStore(state => state.recodeVariable);
    const dataset = useVelocityStore(state => state.dataset);
    const tableConfig = useVelocityStore(state => state.tableConfig);
    const setTableConfig = useVelocityStore(state => state.setTableConfig);

    const openMerge = useCallback((event: MergeEvent) => {
        setMergeModal({
            isOpen: true,
            sourceItems: event.sourceItems,
            targetItem: event.targetItem,
            variableId: event.variableId ?? fallbackVariableId ?? null,
        });
    }, [fallbackVariableId]);

    const closeMerge = useCallback(() => {
        setMergeModal(INITIAL_STATE);
    }, []);

    const confirmMerge = useCallback(async (groupName: string) => {
        if (!mergeModal.targetItem || !mergeModal.variableId) return;

        const variable = dataset?.variables.find(v => v.id === mergeModal.variableId);
        const label = variable?.label ?? mergeModal.variableId;

        // Build the set of raw values being merged into the group
        const mergedRawValues = new Set([
            ...mergeModal.sourceItems.map(i => i.rawValue),
            mergeModal.targetItem.rawValue,
        ]);

        // Build complete mappings: merged items → groupName, everything else → its label
        const mappings: Record<string, string> = {};
        if (variable?.valueLabels && variable.valueLabels.length > 0) {
            for (const vl of variable.valueLabels) {
                const strVal = String(vl.value);
                mappings[strVal] = mergedRawValues.has(strVal) ? groupName : vl.label;
            }
        } else {
            // No value labels — just map the merged items; others fall through via SQL ELSE
            for (const rv of mergedRawValues) {
                mappings[rv] = groupName;
            }
        }

        try {
            const newVarId = await recodeVariable(
                mergeModal.variableId,
                `${label} (Grouped)`,
                { mode: 'categorical', mappings }
            );

            // Swap the original variable for the new grouped one in the active analysis
            const newRowVars = tableConfig.rowVars.map(id =>
                id === mergeModal.variableId ? newVarId : id
            );
            const newColVar = tableConfig.colVar === mergeModal.variableId
                ? newVarId
                : tableConfig.colVar;
            setTableConfig({ rowVars: newRowVars, colVar: newColVar });
        } catch (e) {
            console.error('Failed to create merged group:', e);
        }

        setMergeModal(INITIAL_STATE);
    }, [dataset, mergeModal, recodeVariable, tableConfig, setTableConfig]);

    return {
        mergeModal,
        openMerge,
        closeMerge,
        confirmMerge,
    };
};
