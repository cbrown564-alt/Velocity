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

        const mappings: Record<string, string> = {};
        mergeModal.sourceItems.forEach(item => {
            mappings[item.rawValue] = groupName;
        });
        mappings[mergeModal.targetItem.rawValue] = groupName;

        const variable = dataset?.variables.find(v => v.id === mergeModal.variableId);
        const label = variable?.label ?? mergeModal.variableId;

        try {
            await recodeVariable(
                mergeModal.variableId,
                `${label} (Grouped)`,
                { mode: 'categorical', mappings }
            );
        } catch (e) {
            console.error('Failed to create merged group:', e);
        }

        setMergeModal(INITIAL_STATE);
    }, [dataset, mergeModal, recodeVariable]);

    return {
        mergeModal,
        openMerge,
        closeMerge,
        confirmMerge,
    };
};
