import React from 'react';
import { DataDrawer } from '../../components/overlays/DataDrawer';
import { RecodeModal } from '../../components/overlays/RecodeModal';
import { FilterModal } from '../../components/overlays/FilterModal';
import { ExportModal } from '../../components/overlays/ExportModal';
import { SessionImportModal } from '../../components/overlays/SessionImportModal';
import { SessionExportModal } from '../../components/overlays/SessionExportModal';
import type { SessionExportSummary } from '../../components/overlays/SessionExportModal';
import { InputModal } from '../../components/overlays/InputModal';
import {
  ProjectLinkModal,
  CrossWavePanel,
  ExportImportModal,
  type StoredDataset,
  type Project,
  type WorkspaceState,
  type WorkspaceExport,
} from '../../features/workspace';
import { HarmonizationWorkspace } from '../../features/harmonization';
import type { Filter, Variable } from '../../store';
import type { SessionImportPayload } from '../../components/overlays/SessionImportModal';
import type { DrillDownState } from '../../store/slices/drillDownSlice';
import type { AnalysisExportModalState } from '../../store/slices/uiSlice';
import type { AppOverlay } from '../types';
import { datasetTableName } from '../utils';

export interface ModalHostProps {
  overlay: AppOverlay;
  closeOverlay: () => void;
  workspace: WorkspaceState;
  variables: Variable[];
  sessionExportSummary: SessionExportSummary | null;
  harmonization: {
    isOpen: boolean;
    sourceDataset: StoredDataset | null;
    targetDataset: StoredDataset | null;
    sourceVars: Variable[] | null;
    targetVars: Variable[] | null;
  };
  drillDown: DrillDownState;
  recodeModal: { isOpen: boolean; variable: unknown };
  filterModal: { isOpen: boolean };
  analysisExportModal: AnalysisExportModalState;
  onCloseDrillDown: () => void;
  onLoadMoreDrillDown: () => void;
  onCloseRecodeModal: () => void;
  onCloseFilterModal: () => void;
  onSaveFilter: (filter: Omit<Filter, 'id'>, applyToAll: boolean) => void;
  onCloseAnalysisExportModal: () => void;
  onSessionImport: (payload: SessionImportPayload) => Promise<void>;
  onSessionExportDownload: () => Promise<void>;
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onAddToProject: (ids: string[], projectId: string) => void;
  onUpdateWaveNumber: (id: string, wave: number) => void;
  onSetRespondentKey: (id: string, key: string) => void;
  onOpenDataset: (storedDataset: StoredDataset) => Promise<void>;
  onOpenHarmonization: (w1: StoredDataset, w2: StoredDataset) => void;
  onWorkspaceImport: (data: WorkspaceExport) => void;
}

export const ModalHost: React.FC<ModalHostProps> = ({
  overlay,
  closeOverlay,
  workspace,
  variables,
  sessionExportSummary,
  harmonization,
  drillDown,
  recodeModal,
  filterModal,
  analysisExportModal,
  onCloseDrillDown,
  onLoadMoreDrillDown,
  onCloseRecodeModal,
  onCloseFilterModal,
  onSaveFilter,
  onCloseAnalysisExportModal,
  onSessionImport,
  onSessionExportDownload,
  onCreateProject,
  onAddToProject,
  onUpdateWaveNumber,
  onSetRespondentKey,
  onOpenDataset,
  onOpenHarmonization,
  onWorkspaceImport,
}) => (
  <>
    <DataDrawer
      isOpen={drillDown.isOpen}
      onClose={onCloseDrillDown}
      title={drillDown.title}
      data={drillDown.data}
      loading={drillDown.loading}
      totalCount={drillDown.totalCount}
      loadedCount={drillDown.data.length}
      onLoadMore={onLoadMoreDrillDown}
      filterColumns={[
        ...drillDown.rowFilters.map((f) => f.variable),
        ...(drillDown.colFilter ? [drillDown.colFilter.variable] : []),
      ]}
    />

    <RecodeModal
      isOpen={recodeModal.isOpen}
      onClose={onCloseRecodeModal}
      variable={recodeModal.variable as Parameters<typeof RecodeModal>[0]['variable']}
      onSave={async () => {}}
    />

    <FilterModal
      isOpen={filterModal.isOpen}
      onClose={onCloseFilterModal}
      variables={variables}
      onSave={onSaveFilter}
    />

    <InputModal
      isOpen={overlay.kind === 'combine'}
      onClose={closeOverlay}
      onSubmit={() => {}}
      title="Combine Variables"
      placeholder="Enter name for new variable set..."
      submitLabel="Create"
    />

    <ProjectLinkModal
      isOpen={overlay.kind === 'projectLink'}
      onClose={closeOverlay}
      datasets={workspace.datasets}
      projects={workspace.projects}
      selectedDatasetIds={overlay.kind === 'projectLink' ? overlay.datasetIds : []}
      onCreateProject={onCreateProject}
      onAddToProject={onAddToProject}
      onUpdateWaveNumber={onUpdateWaveNumber}
      onSetRespondentKey={onSetRespondentKey}
    />

    {overlay.kind === 'crossWave' && (
      <CrossWavePanel
        isOpen
        onClose={closeOverlay}
        project={overlay.project}
        datasets={overlay.datasets}
        selectedWaves={overlay.selectedWaves}
        onOpenDataset={onOpenDataset}
        onOpenHarmonization={onOpenHarmonization}
      />
    )}

    {harmonization.isOpen &&
      harmonization.sourceDataset &&
      harmonization.targetDataset &&
      harmonization.sourceVars &&
      harmonization.targetVars && (
        <HarmonizationWorkspace
          sourceVars={harmonization.sourceVars}
          targetVars={harmonization.targetVars}
          sourceDatasetName={harmonization.sourceDataset.name}
          targetDatasetName={harmonization.targetDataset.name}
          sourceTableName={
            harmonization.sourceDataset.tableName ??
            datasetTableName(harmonization.sourceDataset.id)
          }
          targetTableName={
            harmonization.targetDataset.tableName ??
            datasetTableName(harmonization.targetDataset.id)
          }
        />
      )}

    <ExportImportModal
      isOpen={overlay.kind === 'workspaceExport'}
      onClose={closeOverlay}
      workspaceState={workspace}
      selectedDatasetIds={overlay.kind === 'workspaceExport' ? overlay.selectedIds : []}
      onImport={onWorkspaceImport}
    />

    <ExportModal
      isOpen={analysisExportModal.isOpen}
      onClose={onCloseAnalysisExportModal}
      config={analysisExportModal.config ?? { title: 'Analysis Report', analyses: [] }}
    />

    <SessionImportModal
      isOpen={overlay.kind === 'sessionImport'}
      onClose={closeOverlay}
      onImport={onSessionImport}
    />

    {sessionExportSummary && (
      <SessionExportModal
        isOpen={overlay.kind === 'sessionExport'}
        onClose={closeOverlay}
        onExport={onSessionExportDownload}
        summary={sessionExportSummary}
      />
    )}
  </>
);
