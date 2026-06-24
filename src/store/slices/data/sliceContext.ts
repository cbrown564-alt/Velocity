/**
 * Typed store access for data slice modules that touch analysis/UI state.
 */

import type { AnalysisSlice } from '../analysisSlice';
import type { UISlice } from '../uiSlice';
import type { DataSlice } from './types';

export type DataSliceStore = DataSlice
    & Pick<AnalysisSlice, 'tableConfig' | 'queryResult' | 'tableStats' | 'activeFilters' | 'runAnalysis' | 'setTableConfig'>
    & Pick<UISlice, 'setSelectedVariableId'>;

export type DataSliceGet = () => DataSliceStore;
export type DataSliceSet = (
    partial: Partial<DataSliceStore> | ((state: DataSliceStore) => Partial<DataSliceStore>),
) => void;

export function getRunAnalysis(get: DataSliceGet): (() => Promise<void>) | undefined {
    const { runAnalysis } = get();
    return typeof runAnalysis === 'function' ? runAnalysis : undefined;
}
