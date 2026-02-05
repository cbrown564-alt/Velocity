/**
 * Workspace Feature Module
 *
 * Multi-file workspace and file management system for Velocity.
 */

export { WorkspaceView } from './components/WorkspaceView';
export type { StoredDataset, Project, WorkspaceState } from './components/WorkspaceView';

export { DatasetSidebar } from './components/DatasetSidebar';
export { ProjectLinkModal } from './components/ProjectLinkModal';
export { WaveTimeline } from './components/WaveTimeline';
export { CrossWavePanel } from './components/CrossWavePanel';

export { useWorkspace } from './hooks/useWorkspace';
