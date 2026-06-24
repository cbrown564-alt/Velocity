/**
 * Workspace Feature Module
 *
 * Multi-file workspace and file management system for Velocity.
 */

export { WorkspaceView } from './components/WorkspaceView';
export type { StoredDataset, Project, WorkspaceState, WorkspaceViewProps } from './types';

export { DatasetSidebar } from './components/DatasetSidebar';
export { ProjectLinkModal } from './components/ProjectLinkModal';
export { WaveTimeline } from './components/WaveTimeline';
export { CrossWavePanel } from './components/CrossWavePanel';

export { ExportImportModal, type WorkspaceExport } from './components/ExportImportModal';

export { useWorkspace } from './hooks/useWorkspace';
export { useWorkspaceOpen } from './hooks/useWorkspaceOpen';
export type { WorkspaceOpenAppMode, UseWorkspaceOpenOptions, UseWorkspaceOpenReturn } from './hooks/useWorkspaceOpen';
export { useWelcomeBack } from './hooks/useWelcomeBack';
export type { UseWelcomeBackOptions, UseWelcomeBackReturn } from './hooks/useWelcomeBack';
export { useFileUpload, type FileUploadState } from './hooks/useFileUpload';
export {
  assignOpfsKeyAndLoad,
  assignOpfsStorageForUpload,
  type AssignOpfsKeyAndLoadOptions,
  type AssignOpfsStorageResult,
  type LoadSavFn,
} from './hooks/assignOpfsKeyAndLoad';
