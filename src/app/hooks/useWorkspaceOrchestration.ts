import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Filter, Variable } from '../../store';
import { useVelocityStore } from '../../store';
import { persistDatasetSession } from '../../store/datasetSessionCoordinator';
import * as opfsFileManager from '../../services/opfsFileManager';
import type { Project, StoredDataset, WorkspaceExport } from '../../features/workspace';
import type { AppPhase } from '../types';
import { datasetTableName } from '../utils';

export interface UseWorkspaceOrchestrationOptions {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
  openProjectLink: (datasetIds: string[]) => void;
  openCrossWave: (project: Project, datasets: StoredDataset[], selectedWaves?: [StoredDataset, StoredDataset]) => void;
  openWorkspaceExport: (selectedIds: string[]) => void;
  closeCrossWaveOverlay: () => void;
  closeProjectLinkOverlay: () => void;
}

export interface UseWorkspaceOrchestrationReturn {
  handleDeleteDataset: (id: string) => Promise<void>;
  handleReturnToWorkspace: () => void;
  handleOpenProjectModal: (ids: string[]) => void;
  handleCreateProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  handleAddToProject: (ids: string[], projectId: string) => void;
  handleUpdateWaveNumber: (id: string, wave: number) => void;
  handleSetRespondentKey: (id: string, key: string) => void;
  handleUnlinkDataset: (id: string) => void;
  handleOpenCrossWavePanel: (project: Project, w1: StoredDataset, w2: StoredDataset) => void;
  handleOpenHarmonization: (w1: StoredDataset, w2: StoredDataset) => void;
  handleWorkspaceImport: (data: WorkspaceExport) => void;
  handleBatchStar: (ids: string[], starred: boolean) => void;
  handleBatchDelete: (ids: string[]) => Promise<void>;
  handleSaveFilter: (filter: Omit<Filter, 'id'>, applyToAll: boolean) => void;
  harmonizationSourceDataset: StoredDataset | null;
  harmonizationTargetDataset: StoredDataset | null;
  harmonizationSourceVars: Variable[] | null;
  harmonizationTargetVars: Variable[] | null;
}

export function useWorkspaceOrchestration({
  phase,
  setPhase,
  openProjectLink,
  openCrossWave,
  closeCrossWaveOverlay,
  closeProjectLinkOverlay,
}: UseWorkspaceOrchestrationOptions): UseWorkspaceOrchestrationReturn {
  const {
    isDbReady,
    dataset,
    variableSets,
    folders,
    transformLog,
    tableConfig,
    activeFilters,
    slides,
    browserEngine,
    activeDbPath,
    workspace,
    activeDatasetId,
    addStoredDataset,
    updateStoredDataset,
    toggleDatasetStar,
    removeStoredDataset,
    removeStoredDatasets,
    saveDatasetSession,
    setAppMode,
    setWorkspaceMode,
    createProject,
    addDatasetsToProject,
    removeDatasetsFromProject,
    setDatasetWave,
    setDatasetRespondentKey,
    harmonization,
    openHarmonization,
    closeHarmonization,
    setActiveDataset,
    addFilter,
    addFilterToSlides,
    respawnWorker,
    touchLastActiveAt,
  } = useVelocityStore();

  const registeredDatasetIds = useRef<Set<string>>(new Set());
  const materializedDatasetTables = useRef<Set<string>>(new Set());
  const prevPhaseRef = useRef<AppPhase>(phase);
  const splashActivityTouchedRef = useRef(false);

  const materializeDatasetTable = useCallback(
    async (datasetId: string) => {
      if (!browserEngine) return false;
      const tableName = datasetTableName(datasetId);
      if (materializedDatasetTables.current.has(tableName)) return true;

      try {
        const status = await browserEngine.ping();
        if (!status.hasData) {
          console.log(
            `[App] Skipping workspace table materialization for ${tableName}: DuckDB has no active main table`,
          );
          return false;
        }

        await browserEngine.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM main`);
        materializedDatasetTables.current.add(tableName);
        const persistedSize = await opfsFileManager.getDatasetPersistenceSize(datasetId, dataset?.opfsFileKey);
        if (persistedSize > 0) {
          updateStoredDataset(datasetId, { fileSize: persistedSize });
        }
        return true;
      } catch (error) {
        console.warn(`[App] Failed to materialize workspace table ${tableName}:`, error);
        materializedDatasetTables.current.delete(tableName);
        return false;
      }
    },
    [browserEngine, dataset?.opfsFileKey, updateStoredDataset],
  );

  const registerDatasetInWorkspace = useCallback(() => {
    if (!dataset) return;
    if (registeredDatasetIds.current.has(dataset.id)) return;
    registeredDatasetIds.current.add(dataset.id);
    addStoredDataset({
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: dataset.variables.length,
      fileSize: 0,
      source: dataset.source,
      variables: dataset.variables,
      variableSets,
      folders,
      opfsFileKey: dataset.opfsFileKey,
      tableName: datasetTableName(dataset.id),
    });
    opfsFileManager
      .getDatasetPersistenceSize(dataset.id, dataset.opfsFileKey)
      .then((size) => {
        if (size > 0) updateStoredDataset(dataset.id, { fileSize: size });
      })
      .catch(() => {});
    setActiveDataset(dataset.id);
  }, [dataset, variableSets, folders, addStoredDataset, updateStoredDataset, setActiveDataset]);

  useEffect(() => {
    if (dataset && phase === 'dashboard') registerDatasetInWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id, phase]);

  useEffect(() => {
    materializedDatasetTables.current.clear();
  }, [activeDbPath]);

  useEffect(() => {
    if (!dataset || phase !== 'dashboard') return;
    void materializeDatasetTable(dataset.id);
  }, [dataset?.id, phase, materializeDatasetTable]);

  const clearLoadedDatasetState = useCallback(async () => {
    useVelocityStore.setState({
      dataset: null,
      variableSets: [],
      folders: [],
      transformLog: [],
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      queryResult: [],
      tableStats: null,
      persistedDataInfo: null,
      persistenceState: 'ready',
    } as any);
    await respawnWorker(false);
  }, [respawnWorker]);

  const handleDeleteDataset = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this dataset from your workspace? The original file will not be affected.')) {
        return;
      }

      const storedDataset = workspace.datasets.find((entry) => entry.id === id);
      if (storedDataset) {
        await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
      }

      removeStoredDataset(id);

      if (activeDatasetId === id || dataset?.id === id) {
        setActiveDataset(null);
        await clearLoadedDatasetState();
        setPhase('splash');
        setWorkspaceMode(true);
      }
    },
    [
      workspace.datasets,
      removeStoredDataset,
      activeDatasetId,
      dataset?.id,
      setActiveDataset,
      clearLoadedDatasetState,
      setWorkspaceMode,
      setPhase,
    ],
  );

  const handleReturnToWorkspace = useCallback(() => {
    persistDatasetSession(
      {
        dataset,
        activeDatasetId,
        tableConfig,
        activeFilters,
        transformLog,
        variableSets,
        folders,
      },
      { saveDatasetSession, updateStoredDataset },
    );
    setWorkspaceMode(true);
    setAppMode('analysis');
    setPhase('splash');
  }, [
    dataset,
    activeDatasetId,
    tableConfig,
    activeFilters,
    transformLog,
    variableSets,
    folders,
    saveDatasetSession,
    updateStoredDataset,
    setAppMode,
    setWorkspaceMode,
    setPhase,
  ]);

  useEffect(() => {
    if (phase === 'dashboard' && prevPhaseRef.current !== 'dashboard') {
      touchLastActiveAt();
    }

    if (phase === 'dashboard') {
      setWorkspaceMode(false);
    }

    if (phase === 'splash' && isDbReady) {
      const enteredSplash = prevPhaseRef.current !== 'splash';
      if (enteredSplash || !splashActivityTouchedRef.current) {
        touchLastActiveAt();
        splashActivityTouchedRef.current = true;
      }
    } else if (phase !== 'splash') {
      splashActivityTouchedRef.current = false;
    }

    prevPhaseRef.current = phase;
  }, [phase, isDbReady, touchLastActiveAt, setWorkspaceMode]);

  const handleOpenProjectModal = useCallback((ids: string[]) => openProjectLink(ids), [openProjectLink]);

  const handleCreateProject = useCallback(
    (project: Omit<Project, 'id' | 'createdAt'>) => {
      createProject(project);
      closeProjectLinkOverlay();
    },
    [createProject, closeProjectLinkOverlay],
  );

  const handleAddToProject = useCallback(
    (ids: string[], projectId: string) => {
      addDatasetsToProject(ids, projectId);
      closeProjectLinkOverlay();
    },
    [addDatasetsToProject, closeProjectLinkOverlay],
  );

  const handleUpdateWaveNumber = useCallback((id: string, wave: number) => setDatasetWave(id, wave), [setDatasetWave]);

  const handleSetRespondentKey = useCallback(
    (id: string, key: string) => setDatasetRespondentKey(id, key),
    [setDatasetRespondentKey],
  );

  const handleUnlinkDataset = useCallback((id: string) => removeDatasetsFromProject([id]), [removeDatasetsFromProject]);

  const handleOpenCrossWavePanel = useCallback(
    (project: Project, w1: StoredDataset, w2: StoredDataset) => {
      openCrossWave(
        project,
        workspace.datasets.filter((d) => d.projectId === project.id),
        [w1, w2],
      );
    },
    [workspace.datasets, openCrossWave],
  );

  const resolveWorkspaceVariables = useCallback(
    (stored: StoredDataset): Variable[] | null => {
      if (stored.variables && stored.variables.length > 0) return stored.variables as Variable[];
      if (dataset?.id === stored.id) return dataset.variables as Variable[];
      return null;
    },
    [dataset],
  );

  const handleOpenHarmonization = useCallback(
    (w1: StoredDataset, w2: StoredDataset) => {
      const src = resolveWorkspaceVariables(w1);
      const tgt = resolveWorkspaceVariables(w2);
      if (!src || !tgt) {
        alert(
          'Harmonization needs variable metadata for both waves. Open each dataset at least once to cache metadata.',
        );
        return;
      }
      openHarmonization(w1.id, w2.id);
      closeCrossWaveOverlay();
    },
    [openHarmonization, resolveWorkspaceVariables, closeCrossWaveOverlay],
  );

  const harmonizationSession = harmonization.session;
  const harmonizationSourceDataset = useMemo(
    () =>
      harmonizationSession
        ? (workspace.datasets.find((d) => d.id === harmonizationSession.sourceDatasetId) ?? null)
        : null,
    [harmonizationSession, workspace.datasets],
  );
  const harmonizationTargetDataset = useMemo(
    () =>
      harmonizationSession
        ? (workspace.datasets.find((d) => d.id === harmonizationSession.targetDatasetId) ?? null)
        : null,
    [harmonizationSession, workspace.datasets],
  );
  const harmonizationSourceVars = useMemo(
    () => (harmonizationSourceDataset ? resolveWorkspaceVariables(harmonizationSourceDataset) : null),
    [harmonizationSourceDataset, resolveWorkspaceVariables],
  );
  const harmonizationTargetVars = useMemo(
    () => (harmonizationTargetDataset ? resolveWorkspaceVariables(harmonizationTargetDataset) : null),
    [harmonizationTargetDataset, resolveWorkspaceVariables],
  );

  useEffect(() => {
    if (!harmonization.isOpen) return;
    if (harmonizationSourceVars && harmonizationTargetVars) return;
    closeHarmonization();
  }, [harmonization.isOpen, harmonizationSourceVars, harmonizationTargetVars, closeHarmonization]);

  const handleWorkspaceImport = useCallback(
    (data: WorkspaceExport) => {
      data.workspace.datasets.forEach((d) => {
        const existing = workspace.datasets.find((e) => e.id === d.id);
        if (existing) updateStoredDataset(d.id, d);
        else
          addStoredDataset({
            id: d.id,
            name: d.name,
            fileName: d.fileName,
            rowCount: d.rowCount,
            columnCount: d.columnCount,
            fileSize: d.fileSize,
            source: d.source,
            variables: d.variables,
            variableSets: d.variableSets,
            folders: d.folders,
            opfsFileKey: d.opfsFileKey,
            tableName: d.tableName,
          });
      });
      data.workspace.projects.forEach((p) => {
        if (!workspace.projects.find((e) => e.id === p.id)) {
          createProject({
            name: p.name,
            color: p.color,
            description: p.description,
            datasetIds: p.datasetIds,
            isLongitudinal: p.isLongitudinal,
            respondentKeyVariable: p.respondentKeyVariable,
          });
        }
      });
    },
    [workspace.datasets, workspace.projects, updateStoredDataset, addStoredDataset, createProject],
  );

  const handleBatchStar = useCallback(
    (ids: string[], starred: boolean) => {
      ids.forEach((id) => {
        const ds = workspace.datasets.find((d) => d.id === id);
        if (ds && ds.starred !== starred) toggleDatasetStar(id);
      });
    },
    [workspace.datasets, toggleDatasetStar],
  );

  const handleBatchDelete = useCallback(
    async (ids: string[]) => {
      if (!window.confirm(`Delete ${ids.length} datasets from your workspace?`)) return;

      await Promise.all(
        ids.map(async (id) => {
          const storedDataset = workspace.datasets.find((entry) => entry.id === id);
          if (storedDataset) {
            await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
          }
        }),
      );

      const deletingActive = ids.includes(activeDatasetId ?? '') || (dataset?.id ? ids.includes(dataset.id) : false);
      removeStoredDatasets(ids);

      if (deletingActive) {
        setActiveDataset(null);
        await clearLoadedDatasetState();
        setPhase('splash');
        setWorkspaceMode(true);
      }
    },
    [
      workspace.datasets,
      activeDatasetId,
      dataset?.id,
      removeStoredDatasets,
      setActiveDataset,
      clearLoadedDatasetState,
      setWorkspaceMode,
      setPhase,
    ],
  );

  const handleSaveFilter = useCallback(
    (filter: Omit<Filter, 'id'>, applyToAll: boolean) => {
      addFilter(filter);
      if (applyToAll) {
        const filterWithId = { ...filter, id: crypto.randomUUID() };
        addFilterToSlides(
          slides.map((s) => s.id),
          filterWithId,
        );
      }
    },
    [addFilter, addFilterToSlides, slides],
  );

  return {
    handleDeleteDataset,
    handleReturnToWorkspace,
    handleOpenProjectModal,
    handleCreateProject,
    handleAddToProject,
    handleUpdateWaveNumber,
    handleSetRespondentKey,
    handleUnlinkDataset,
    handleOpenCrossWavePanel,
    handleOpenHarmonization,
    handleWorkspaceImport,
    handleBatchStar,
    handleBatchDelete,
    handleSaveFilter,
    harmonizationSourceDataset,
    harmonizationTargetDataset,
    harmonizationSourceVars,
    harmonizationTargetVars,
  };
}
