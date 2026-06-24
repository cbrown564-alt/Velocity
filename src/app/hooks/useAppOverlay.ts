import { useCallback, useState } from 'react';
import type { Project, StoredDataset } from '../../features/workspace';
import { NO_OVERLAY, type AppOverlay } from '../types';

export interface UseAppOverlayReturn {
  overlay: AppOverlay;
  closeOverlay: () => void;
  openSessionImport: () => void;
  openSessionExport: () => void;
  openProjectLink: (datasetIds: string[]) => void;
  openCrossWave: (
    project: Project,
    datasets: StoredDataset[],
    selectedWaves?: [StoredDataset, StoredDataset],
  ) => void;
  openWorkspaceExport: (selectedIds: string[]) => void;
  openCombine: () => void;
}

export function useAppOverlay(): UseAppOverlayReturn {
  const [overlay, setOverlay] = useState<AppOverlay>(NO_OVERLAY);

  const closeOverlay = useCallback(() => setOverlay(NO_OVERLAY), []);

  const openSessionImport = useCallback(() => setOverlay({ kind: 'sessionImport' }), []);

  const openSessionExport = useCallback(() => setOverlay({ kind: 'sessionExport' }), []);

  const openProjectLink = useCallback(
    (datasetIds: string[]) => setOverlay({ kind: 'projectLink', datasetIds }),
    [],
  );

  const openCrossWave = useCallback(
    (
      project: Project,
      datasets: StoredDataset[],
      selectedWaves?: [StoredDataset, StoredDataset],
    ) => setOverlay({ kind: 'crossWave', project, datasets, selectedWaves }),
    [],
  );

  const openWorkspaceExport = useCallback(
    (selectedIds: string[]) => setOverlay({ kind: 'workspaceExport', selectedIds }),
    [],
  );

  const openCombine = useCallback(() => setOverlay({ kind: 'combine' }), []);

  return {
    overlay,
    closeOverlay,
    openSessionImport,
    openSessionExport,
    openProjectLink,
    openCrossWave,
    openWorkspaceExport,
    openCombine,
  };
}
