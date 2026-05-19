import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVelocityStore } from '../../../store';
import { useWorkspaceOpen } from './useWorkspaceOpen';
import type { StoredDataset } from '../components/WorkspaceView';

const makeStoredDataset = (id: string): StoredDataset => ({
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
  opfsFileKey: `${id}_key.sav`,
  tableName: `dataset_${id}`,
});

describe('useWorkspaceOpen', () => {
  const setMode = vi.fn();
  const clearImportedSessionSemantic = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      dataset: null,
      variableSets: [],
      folders: [],
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      transformLog: [],
      workspace: { datasets: [], projects: [], storageUsed: 0, storageQuota: 0 },
      activeDatasetId: null,
      isWorkspaceMode: true,
    });
  });

  it('saves the current session before opening a different dataset', async () => {
    const saveDatasetSession = vi.fn();
    const updateStoredDataset = vi.fn();
    const openWorkspaceDataset = vi.fn().mockResolvedValue(undefined);

    useVelocityStore.setState({
      dataset: {
        id: 'ds-current',
        name: 'current.sav',
        rowCount: 50,
        source: 'sav',
        variables: [{ id: 'q1', name: 'q1', label: 'Q1', type: 'categorical', valueLabels: [], missingValues: {} }],
      },
      activeDatasetId: 'ds-current',
      variableSets: [{ id: 'set-1', name: 'Set 1', variableIds: ['q1'], structure: 'single', type: 'categorical' }],
      folders: [{ id: 'folder-1', name: 'Folder', order: 0 }],
      tableConfig: { rowVars: ['q1'], colVar: null },
      activeFilters: [{ id: 'f1', variableId: 'q1', operator: 'eq', value: 1 }],
      transformLog: [],
      saveDatasetSession,
      updateStoredDataset,
      openWorkspaceDataset,
    } as any);

    const target = makeStoredDataset('ds-target');
    const { result } = renderHook(() => useWorkspaceOpen({ setMode, clearImportedSessionSemantic }));

    await act(async () => {
      await result.current.openDataset(target);
    });

    expect(clearImportedSessionSemantic).toHaveBeenCalledOnce();
    expect(saveDatasetSession).toHaveBeenCalledWith('ds-current', {
      tableConfig: { rowVars: ['q1'], colVar: null },
      activeFilters: [{ id: 'f1', variableId: 'q1', operator: 'eq', value: 1 }],
      transformLog: [],
    });
    expect(updateStoredDataset).toHaveBeenCalledWith('ds-current', expect.objectContaining({
      variableSets: useVelocityStore.getState().variableSets,
      folders: useVelocityStore.getState().folders,
    }));
    expect(openWorkspaceDataset).toHaveBeenCalledWith(target);
    expect(setMode).toHaveBeenCalledWith('uploading');
    expect(setMode).toHaveBeenLastCalledWith('dashboard');
    expect(useVelocityStore.getState().activeDatasetId).toBe('ds-target');
    expect(useVelocityStore.getState().isWorkspaceMode).toBe(false);
  });

  it('returns to dashboard without reopening when the dataset is already active', async () => {
    const openWorkspaceDataset = vi.fn();

    useVelocityStore.setState({
      dataset: {
        id: 'ds-same',
        name: 'same.sav',
        rowCount: 50,
        source: 'sav',
        variables: [],
      },
      activeDatasetId: 'ds-same',
      openWorkspaceDataset,
    } as any);

    const target = makeStoredDataset('ds-same');
    const { result } = renderHook(() => useWorkspaceOpen({ setMode, clearImportedSessionSemantic }));

    await act(async () => {
      await result.current.openDataset(target);
    });

    expect(openWorkspaceDataset).not.toHaveBeenCalled();
    expect(setMode).toHaveBeenCalledOnce();
    expect(setMode).toHaveBeenCalledWith('dashboard');
  });

  it('restores workspace mode on open failure', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const openWorkspaceDataset = vi.fn().mockRejectedValue(new Error('OPFS miss'));

    useVelocityStore.setState({ openWorkspaceDataset } as any);

    const target = makeStoredDataset('ds-missing');
    const { result } = renderHook(() => useWorkspaceOpen({ setMode, clearImportedSessionSemantic }));

    await act(async () => {
      await result.current.openDataset(target);
    });

    expect(alertSpy).toHaveBeenCalledWith('OPFS miss');
    expect(setMode).toHaveBeenCalledWith('uploading');
    expect(setMode).toHaveBeenLastCalledWith('splash');
    expect(useVelocityStore.getState().isWorkspaceMode).toBe(true);

    alertSpy.mockRestore();
  });
});
