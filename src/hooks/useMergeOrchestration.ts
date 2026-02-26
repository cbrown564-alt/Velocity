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

        // Snapshot state BEFORE the recode so we can find the source entry in rowVars.
        // tableConfig.rowVars stores VariableSet UUIDs, not variable IDs directly, so we
        // search by which variableSet contains the variable being merged.
        const priorState = useVelocityStore.getState();
        const sourceEntry = priorState.tableConfig.rowVars.find(id => {
            const vs = priorState.variableSets.find(s => s.id === id);
            return vs ? vs.variableIds.includes(mergeModal.variableId!) : id === mergeModal.variableId;
        });
        const sourceColEntry = priorState.tableConfig.colVar !== null
            && (() => {
                const colId = priorState.tableConfig.colVar!;
                const vs = priorState.variableSets.find(s => s.id === colId);
                return vs ? vs.variableIds.includes(mergeModal.variableId!) : colId === mergeModal.variableId;
            })()
            ? priorState.tableConfig.colVar
            : null;

        try {
            const newVarId = await recodeVariable(
                mergeModal.variableId,
                `${label} (Grouped)`,
                { mode: 'categorical', mappings }
            );

            // Snapshot state AFTER the recode — dataSlice has now added the new variable
            // and a new VariableSet for it.
            const postState = useVelocityStore.getState();
            const newVarSet = postState.variableSets.find(vs => vs.variableIds.includes(newVarId));
            const newEntry = newVarSet?.id ?? newVarId;

            // Swap the old entry for the new one in the active analysis config
            if (sourceEntry || sourceColEntry) {
                const newRowVars = postState.tableConfig.rowVars.map(id =>
                    id === sourceEntry ? newEntry : id
                );
                const newColVar = sourceColEntry ? newEntry : postState.tableConfig.colVar;
                setTableConfig({ rowVars: newRowVars, colVar: newColVar });
            }
        } catch (e) {
            console.error('Failed to create merged group:', e);
        }

        setMergeModal(INITIAL_STATE);
    }, [dataset, mergeModal, recodeVariable, setTableConfig]);

    return {
        mergeModal,
        openMerge,
        closeMerge,
        confirmMerge,
    };
};
