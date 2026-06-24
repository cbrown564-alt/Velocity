/**
 * Data Slice
 *
 * Thin compositor delegating to focused modules under ./data/.
 * Manages dataset state, variables, worker lifecycle, and persistence.
 */

import type { StateCreator } from 'zustand';
import type { AnalysisSlice } from './analysisSlice';
import type { UISlice } from './uiSlice';
import {
    createDatasetActions,
    createEngineActions,
    createPersistenceActions,
    createTransformActions,
    createVariableCatalogActions,
    dataSliceInitialState,
    type DataSlice,
    type DataSliceStore,
} from './data';

export type {
    DataSlice,
    PersistenceState,
    PersistedDataInfo,
    LoadProgressState,
    WorkspaceDatasetOpenInput,
    VariableType,
    DataTransform,
    Dataset,
    Folder,
    MissingValueDef,
    ValueLabel,
    Variable,
    VariableSet,
} from './data';

export {
    normalizeVariable,
    normalizeVariableSet,
    buildVariableSetsFromVariables,
    applyLoadProgressMessage,
} from './data';

type DataSliceCreator = StateCreator<DataSlice & AnalysisSlice & UISlice, [], [], DataSlice>;

export const createDataSlice: DataSliceCreator = (set, get) => {
    const typedSet = set as (partial: Partial<DataSliceStore> | ((state: DataSliceStore) => Partial<DataSliceStore>)) => void;
    const typedGet = get as () => DataSliceStore;

    return {
        ...dataSliceInitialState,
        ...createEngineActions(typedSet, typedGet),
        ...createPersistenceActions(typedSet, typedGet),
        ...createDatasetActions(typedSet, typedGet),
        ...createVariableCatalogActions(typedSet, typedGet),
        ...createTransformActions(typedSet, typedGet),
    };
};
