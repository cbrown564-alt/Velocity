import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVelocityStore } from '../../../store';
import { useWorkspace } from './useWorkspace';
import * as opfsFileManager from '../../../services/opfsFileManager';
import type { StoredDataset } from '../components/WorkspaceView';

vi.mock('../../../services/opfsFileManager', () => ({
  deleteDatasetPersistence: vi.fn().mockResolvedValue(undefined),
  getStorageEstimate: vi.fn().mockResolvedValue({ usage: 0, quota: 1000 }),
  getFileSize: vi.fn().mockResolvedValue(0),
}));

const makeStoredDataset = (id: string, opfsFileKey: string): StoredDataset => ({
  id,
  name: `${id}.sav`,
  fileName: `${id}.sav`,
  rowCount: 100,
  columnCount: 5,
  fileSize: 1024,
  source: 'sav',
  createdAt: Date.now(),
  lastOpenedAt: Date.now(),
  lastModifiedAt: Date.now(),
  starred: false,
  opfsFileKey,
  tableName: `dataset_${id}`,
});

describe('useWorkspace deleteDatasets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      dataset: null,
      variableSets: [],
      folders: [],
      workspace: {
        datasets: [],
        projects: [],
        storageUsed: 0,
        storageQuota: 0,
      },
      activeDatasetId: null,
      isWorkspaceMode: true,
    });
  });

  it('registers variable sets and folders with the current dataset', async () => {
    useVelocityStore.setState({
      dataset: {
        id: 'ds-grid',
        name: 'grid.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          { id: 'q1_a', name: 'q1_a', label: 'Brand A', type: 'ordered', valueLabels: [], missingValues: {} },
          { id: 'q1_b', name: 'q1_b', label: 'Brand B', type: 'ordered', valueLabels: [], missingValues: {} },
        ],
        opfsFileKey: 'grid_123.sav',
      },
      variableSets: [{
        id: 'grid-1',
        name: 'Brand Ratings',
        variableIds: ['q1_a', 'q1_b'],
        structure: 'grid',
        type: 'ordered',
        folderId: 'folder-1',
      }],
      folders: [{ id: 'folder-1', name: 'Brands', order: 0 }],
      workspace: {
        datasets: [],
        projects: [],
        storageUsed: 0,
        storageQuota: 0,
      },
      isWorkspaceMode: false,
    });

    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useWorkspace>, unknown>> | null = null;
    await act(async () => {
      hookResult = renderHook(() => useWorkspace());
    });

    act(() => {
      hookResult?.result.current.registerCurrentDataset();
    });

    const stored = useVelocityStore.getState().workspace.datasets[0] as any;
    expect(stored.variableSets).toEqual(useVelocityStore.getState().variableSets);
    expect(stored.folders).toEqual(useVelocityStore.getState().folders);
  });

  it('removes OPFS persistence for every deleted dataset', async () => {
    const ds1 = makeStoredDataset('ds-1', 'sleep_123.sav');
    const ds2 = makeStoredDataset('ds-2', 'small_456.sav');

    useVelocityStore.setState({
      workspace: {
        datasets: [ds1, ds2],
        projects: [],
        storageUsed: 0,
        storageQuota: 0,
      },
    });

    const { result } = renderHook(() => useWorkspace());

    await act(async () => {
      await result.current.deleteDatasets(['ds-1', 'ds-2']);
    });

    expect(opfsFileManager.deleteDatasetPersistence).toHaveBeenCalledTimes(2);
    expect(opfsFileManager.deleteDatasetPersistence).toHaveBeenCalledWith('ds-1', 'sleep_123.sav');
    expect(opfsFileManager.deleteDatasetPersistence).toHaveBeenCalledWith('ds-2', 'small_456.sav');
    expect(useVelocityStore.getState().workspace.datasets).toEqual([]);
  });
});
