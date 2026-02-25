/**
 * Store Slice Barrel Export
 */

export { createDataSlice, type DataSlice, type Variable, type VariableType, type ValueLabel, type MissingValueDef, type Dataset, type VariableSet } from './dataSlice';
export { createUISlice, type UISlice, type AppMode, type RecodeModalState, type FilterModalState, type WaveDetectionBannerState } from './uiSlice';
export { createAnalysisSlice, type AnalysisSlice, type TableConfig, type Filter, type AnalysisEngine } from './analysisSlice';
export { createDrillDownSlice, type DrillDownSlice, type DrillDownFilter, type DrillDownState } from './drillDownSlice';
export { createSlidesSlice, type SlidesSlice } from './slidesSlice';
export { createWebRSlice, type WebRSlice, type WebRStatus } from './webrSlice';
export { createWorkspaceSlice, type WorkspaceSlice } from './workspaceSlice';
export { createHarmonizationSlice, type HarmonizationSlice } from './harmonizationSlice';
