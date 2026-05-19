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
