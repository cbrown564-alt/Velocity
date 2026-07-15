import { describe, expect, it } from 'vitest';
import { resolveBootRestoreStrategy, resolveRebuildSuccessMode } from './bootOrchestrator';
import type { Dataset } from '../../types/dataset';
import type { PersistedDataInfo } from '../../store/slices/data/types';

const sampleDataset: Dataset = {
  id: 'ds-1',
  name: 'test.sav',
  rowCount: 100,
  variables: [{ id: 'v1', name: 'v1', label: 'V1', type: 'numeric', valueLabels: [], missingValues: {} }],
  source: 'sav',
  opfsFileKey: 'source-key',
};

const matchingPersistedInfo: PersistedDataInfo = {
  schema: [{ name: 'v1', type: 'DOUBLE' }],
  rowCount: 100,
  metadata: {
    rowCount: 100,
    columnCount: 1,
    datasetId: 'ds-1',
    schemaVersion: 1,
    lastModified: Date.now(),
  },
};

describe('resolveBootRestoreStrategy', () => {
  it('keeps source rebuilds in the user-selected app mode', () => {
    expect(resolveRebuildSuccessMode(true)).toBe('splash');
    expect(resolveRebuildSuccessMode(false)).toBe('dashboard');
  });

  it('waits while an explicit dataset load is in progress', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'found',
      persistedDataInfo: matchingPersistedInfo,
      dataset: null,
      mode: 'uploading',
      isWorkspaceMode: false,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({ kind: 'wait' });
  });

  it('completes boot processing without restoring over an active dashboard', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'found',
      persistedDataInfo: matchingPersistedInfo,
      dataset: sampleDataset,
      mode: 'dashboard',
      isWorkspaceMode: false,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({ kind: 'complete' });
  });

  it('completes a fresh boot when no persisted source exists', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'ready',
      persistedDataInfo: null,
      dataset: null,
      mode: 'splash',
      isWorkspaceMode: true,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({ kind: 'complete' });
  });

  it('waits for persistent storage decision when OPFS source exists', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'found',
      persistedDataInfo: matchingPersistedInfo,
      dataset: sampleDataset,
      mode: 'splash',
      isWorkspaceMode: false,
      persistentStorageGranted: null,
      persistentStorageResolved: false,
    });
    expect(plan).toEqual({ kind: 'wait' });
  });

  it('prefers rebuild when persistent storage is denied', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'found',
      persistedDataInfo: matchingPersistedInfo,
      dataset: sampleDataset,
      mode: 'splash',
      isWorkspaceMode: false,
      persistentStorageGranted: false,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({
      kind: 'rebuild-from-source',
      fallbackMode: 'splash',
      forceReload: true,
    });
  });

  it('restores from cache when metadata matches', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'found',
      persistedDataInfo: matchingPersistedInfo,
      dataset: sampleDataset,
      mode: 'splash',
      isWorkspaceMode: false,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({ kind: 'restore-from-cache', nextMode: 'dashboard' });
  });

  it('rebuilds from OPFS source on splash when cache is empty', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'ready',
      persistedDataInfo: null,
      dataset: sampleDataset,
      mode: 'splash',
      isWorkspaceMode: false,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({ kind: 'rebuild-from-source', fallbackMode: 'splash' });
  });

  it('rebuilds after corruption when OPFS source exists', () => {
    const plan = resolveBootRestoreStrategy({
      persistenceState: 'corrupt',
      persistedDataInfo: null,
      dataset: sampleDataset,
      mode: 'splash',
      isWorkspaceMode: false,
      persistentStorageGranted: true,
      persistentStorageResolved: true,
    });
    expect(plan).toEqual({
      kind: 'rebuild-from-source',
      fallbackMode: 'splash',
      forceReload: true,
    });
  });
});
