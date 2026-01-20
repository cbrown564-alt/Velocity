/**
 * Store Slice Barrel Export
 */

export { createDataSlice, type DataSlice, type Variable, type VariableType, type ValueLabel, type MissingValueDef, type Dataset, type VariableSet } from './dataSlice';
export { createUISlice, type UISlice, type AppMode, type ViewMode, type RecodeModalState, type FilterModalState } from './uiSlice';
export { createAnalysisSlice, type AnalysisSlice, type TableConfig, type Filter, type AggregatedRow } from './analysisSlice';
export { createDrillDownSlice, type DrillDownSlice, type DrillDownFilter, type DrillDownState } from './drillDownSlice';
