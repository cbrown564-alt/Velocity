import { describe, expect, it } from 'vitest';
import { resolveBootRestoreStrategy } from './bootOrchestrator';
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
