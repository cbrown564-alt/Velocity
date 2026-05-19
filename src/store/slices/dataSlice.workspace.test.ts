import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVelocityStore } from '../index';

vi.mock('../../services/opfsFileManager', () => ({
  fileExists: vi.fn().mockResolvedValue(true),
  isAvailable: vi.fn().mockResolvedValue(true),
  readFile: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}));

const makeEngineProxy = (overrides: Record<string, unknown> = {}) => ({
  ping: vi.fn().mockResolvedValue({ type: 'engine.pong', requestId: 'ping', hasData: true, rowCount: 100 }),
  loadSAV: vi.fn().mockResolvedValue({
    type: 'engine.savLoaded',
    requestId: 'sav',
    variables: [{ id: 'q1', name: 'q1', label: 'Q1', type: 'categorical', valueLabels: [], missingValues: {} }],
    variableSets: [{ id: 'set-q1', name: 'Q1', variableIds: ['q1'], structure: 'single', type: 'categorical' }],
    rowCount: 100,
    durationMs: 1,
  }),
  setDatasetContext: vi.fn(),
  updatePersistenceMetadata: vi.fn(),
  flushPersistedData: vi.fn().mockResolvedValue({ ok: true, durationMs: 1 }),
  ...overrides,
});

describe('DataSlice workspace persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      engineProxy: null,
      dataset: null,
      variableSets: [],
      folders: [],
      transformLog: [],
      workspace: {
        datasets: [],
        projects: [],
        storageUsed: 0,
        storageQuota: 0,
      },
      activeDatasetId: null,
    } as any);
  });

  it('opens workspace datasets with persisted variable sets and folders intact', async () => {
    const engineProxy = makeEngineProxy();
    const runAnalysis = vi.fn().mockResolvedValue(undefined);

    useVelocityStore.setState({
      engineProxy: engineProxy as any,
      isDbReady: true,
      respawnWorker: vi.fn().mockResolvedValue(undefined),
      runAnalysis,
    } as any);

    await useVelocityStore.getState().openWorkspaceDataset({
      id: 'ds-1',
      name: 'grid.sav',
      fileName: 'grid.sav',
      rowCount: 100,
      source: 'sav',
      opfsFileKey: 'grid_123.sav',
      variables: [
        { id: 'q1_a', name: 'q1_a', label: 'Brand A', type: 'ordered', valueLabels: [], missingValues: {} },
        { id: 'q1_b', name: 'q1_b', label: 'Brand B', type: 'ordered', valueLabels: [], missingValues: {} },
      ],
      variableSets: [{
        id: 'grid-1',
        name: 'Brand Ratings',
        variableIds: ['q1_a', 'q1_b'],
        structure: 'grid',
        type: 'ordered',
        folderId: 'folder-1',
      }],
      folders: [{ id: 'folder-1', name: 'Brands', order: 0 }],
      sessionState: {
        tableConfig: { rowVars: ['q1_a'], colVar: null },
        activeFilters: [],
        transformLog: [],
      },
    } as any);

    expect(useVelocityStore.getState().variableSets).toEqual([{
      id: 'grid-1',
      name: 'Brand Ratings',
      variableIds: ['q1_a', 'q1_b'],
      structure: 'grid',
      type: 'ordered',
      orderedStyle: 'sequence',
      orderedScoring: 'categorical_only',
      folderId: 'folder-1',
    }]);
    expect(useVelocityStore.getState().folders).toEqual([{ id: 'folder-1', name: 'Brands', order: 0 }]);
  });

  it('loads a new SAV through a worker bound to that dataset id', async () => {
    const oldProxy = makeEngineProxy();
    const nextProxy = makeEngineProxy();
    const respawnWorker = vi.fn().mockImplementation(async (_cleanStart?: boolean, datasetId?: string) => {
      expect(datasetId).toBe('new-ds');
      useVelocityStore.setState({ engineProxy: nextProxy as any });
    });

    useVelocityStore.setState({
      engineProxy: oldProxy as any,
      dataset: {
        id: 'old-ds',
        name: 'old.sav',
        rowCount: 50,
        source: 'sav',
        variables: [],
        opfsFileKey: 'old_123.sav',
      },
      respawnWorker,
    } as any);

    await useVelocityStore.getState().loadSAV('new.sav', new ArrayBuffer(8), {
      datasetId: 'new-ds',
      opfsFileKey: 'new_123.sav',
    });

    expect(respawnWorker).toHaveBeenCalledWith(false, 'new-ds');
    expect(oldProxy.loadSAV).not.toHaveBeenCalled();
    expect(nextProxy.loadSAV).toHaveBeenCalledTimes(1);
    expect(useVelocityStore.getState().dataset?.id).toBe('new-ds');
    expect(useVelocityStore.getState().dataset?.opfsFileKey).toBe('new_123.sav');
  });
});
