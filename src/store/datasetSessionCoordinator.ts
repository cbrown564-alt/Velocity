/**
 * Dataset session coordinator (TN-3.2).
 *
 * Single module for capture / apply / switch of per-dataset session state
 * (table config, filters, transform log + variable catalog metadata).
 */

import type { Filter, TableConfig } from '../types/analysis';
import type { DataTransform, Dataset, Folder, Variable, VariableSet } from '../types/dataset';
import type { DatasetSessionState } from '../types/workspaceSession';

export type { DatasetSessionState };

export interface DatasetLiveState {
  dataset: Dataset | null;
  activeDatasetId: string | null;
  tableConfig: TableConfig;
  activeFilters: Filter[];
  transformLog: DataTransform[];
  variableSets: VariableSet[];
  folders: Folder[];
}

export interface DatasetCatalogSnapshot {
  variables: Variable[];
  variableSets: VariableSet[];
  folders: Folder[];
}

export interface DatasetSessionPersistenceActions {
  saveDatasetSession: (datasetId: string, session: DatasetSessionState) => void;
  updateStoredDataset: (datasetId: string, catalog: DatasetCatalogSnapshot) => void;
}

export function captureSessionSnapshot(
  live: Pick<DatasetLiveState, 'tableConfig' | 'activeFilters' | 'transformLog'>,
): DatasetSessionState {
  return {
    tableConfig: live.tableConfig,
    activeFilters: live.activeFilters,
    transformLog: live.transformLog,
  };
}

export function captureCatalogSnapshot(
  live: Pick<DatasetLiveState, 'dataset' | 'variableSets' | 'folders'>,
): DatasetCatalogSnapshot | null {
  if (!live.dataset) return null;
  return {
    variables: live.dataset.variables,
    variableSets: live.variableSets,
    folders: live.folders,
  };
}

export function persistDatasetSession(live: DatasetLiveState, actions: DatasetSessionPersistenceActions): void {
  if (!live.dataset || !live.activeDatasetId) return;

  actions.saveDatasetSession(live.activeDatasetId, captureSessionSnapshot(live));

  const catalog = captureCatalogSnapshot(live);
  if (catalog) {
    actions.updateStoredDataset(live.activeDatasetId, catalog);
  }
}

export function shouldCaptureBeforeSwitch(
  live: Pick<DatasetLiveState, 'dataset' | 'activeDatasetId'>,
  targetDatasetId: string,
): boolean {
  return Boolean(live.dataset && live.activeDatasetId && live.dataset.id !== targetDatasetId);
}

export function captureBeforeDatasetSwitch(
  live: DatasetLiveState,
  targetDatasetId: string,
  actions: DatasetSessionPersistenceActions,
): void {
  if (!shouldCaptureBeforeSwitch(live, targetDatasetId)) return;
  persistDatasetSession(live, actions);
}

export function normalizeStoredSessionState(session?: Partial<DatasetSessionState> | null): DatasetSessionState {
  return {
    tableConfig: session?.tableConfig ?? { rowVars: [], colVar: null },
    activeFilters: session?.activeFilters ?? [],
    transformLog: session?.transformLog ?? [],
  };
}

export interface DatasetSessionStorePatch {
  tableConfig: TableConfig;
  activeFilters: Filter[];
  transformLog: DataTransform[];
}

export function sessionStateToStorePatch(session: DatasetSessionState): DatasetSessionStorePatch {
  return {
    tableConfig: session.tableConfig,
    activeFilters: session.activeFilters,
    transformLog: session.transformLog,
  };
}
