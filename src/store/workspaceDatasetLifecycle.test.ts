import { describe, expect, it, vi } from 'vitest';
import {
  buildWorkspaceDatasetOpenPatch,
  rehydrateDatasetFromOpfsSource,
} from './workspaceDatasetLifecycle';
import type { WorkspaceDatasetOpenInput } from './slices/data/types';

vi.mock('../services/opfsFileManager', () => ({
  isAvailable: vi.fn().mockResolvedValue(true),
  fileExists: vi.fn().mockResolvedValue(true),
  readFile: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
}));

describe('buildWorkspaceDatasetOpenPatch', () => {
  it('normalizes variables and preserves session state', () => {
    const stored: WorkspaceDatasetOpenInput = {
      id: 'ds-1',
      name: 'grid.sav',
      fileName: 'grid.sav',
      rowCount: 100,
      source: 'sav',
      opfsFileKey: 'grid_123.sav',
      variables: [
        { id: 'q1_a', name: 'q1_a', label: 'Brand A', type: 'scale', valueLabels: [], missingValues: {} },
      ],
      variableSets: [{
        id: 'grid-1',
        name: 'Brand Ratings',
        variableIds: ['q1_a'],
        structure: 'grid',
        type: 'scale',
        folderId: 'folder-1',
      }],
      folders: [{ id: 'folder-1', name: 'Brands', order: 0 }],
      sessionState: {
        tableConfig: { rowVars: ['q1_a'], colVar: null },
        activeFilters: [],
        transformLog: [],
      },
    };

    const patch = buildWorkspaceDatasetOpenPatch(stored);

    expect(patch.dataset.id).toBe('ds-1');
    expect(patch.dataset.metadataOnly).toBe(false);
    expect(patch.variableSets[0].orderedStyle).toBe('rating');
    expect(patch.variableSets[0].orderedScoring).toBe('allow_numeric_stats');
    expect(patch.folders).toEqual(stored.folders);
    expect(patch.tableConfig.rowVars).toEqual(['q1_a']);
  });

  it('builds variable sets from variables when none are stored', () => {
    const patch = buildWorkspaceDatasetOpenPatch({
      id: 'ds-2',
      name: 'empty.sav',
      rowCount: 0,
      source: 'sav',
      variables: [
        { id: 'q1', name: 'q1', label: 'Q1', type: 'categorical', valueLabels: [], missingValues: {} },
      ],
    });

    expect(patch.variableSets).toHaveLength(1);
    expect(patch.variableSets[0].variableIds).toEqual(['q1']);
    expect(patch.dataset.metadataOnly).toBe(false);
  });

  it('rehydrates OPFS source via browserEngine.loadBuffer', async () => {
    const loadBuffer = vi.fn().mockResolvedValue({
      loaded: {
        type: 'engine.savLoaded',
        variables: [],
        variableSets: [],
        rowCount: 50,
        durationMs: 1,
      },
      envelope: {
        data: { datasetName: 'grid.sav', rowCount: 50, variableCount: 0, variableSetCount: 0, source: 'sav' },
        operation: 'loadBuffer',
        inputs: {},
        durationMs: 1,
        warnings: [],
        metadata: {
          datasetName: 'grid.sav',
          rowCount: 50,
          filtersApplied: 0,
          isWeighted: false,
          engineVersion: 'browser-wasm',
        },
      },
    });
    const recode = vi.fn().mockResolvedValue({ data: { column: 'q1_binned' } });
    const flushPersistedData = vi.fn().mockResolvedValue(undefined);

    await rehydrateDatasetFromOpfsSource({
      browserEngine: {
        ping: vi.fn().mockResolvedValue({ hasData: false }),
        loadBuffer,
        recode,
      } as any,
      dataset: {
        id: 'ds-1',
        name: 'grid.sav',
        rowCount: 50,
        source: 'sav',
        variables: [],
        opfsFileKey: 'grid_123.sav',
      },
      transformLog: [],
      flushPersistedData,
    }, { forceReload: true });

    expect(loadBuffer).toHaveBeenCalledWith('grid.sav', expect.any(ArrayBuffer), 'sav');
    expect(flushPersistedData).toHaveBeenCalled();
  });

  it('replays recode transforms via browserEngine.recode', async () => {
    const recode = vi.fn().mockResolvedValue({ data: { column: 'q1_binned' } });
    const loadBuffer = vi.fn().mockResolvedValue({
      loaded: {
        type: 'engine.savLoaded',
        variables: [],
        variableSets: [],
        rowCount: 50,
        durationMs: 1,
      },
      envelope: {
        data: { datasetName: 'grid.sav', rowCount: 50, variableCount: 0, variableSetCount: 0, source: 'sav' },
        operation: 'loadBuffer',
        inputs: {},
        durationMs: 1,
        warnings: [],
        metadata: {
          datasetName: 'grid.sav',
          rowCount: 50,
          filtersApplied: 0,
          isWeighted: false,
          engineVersion: 'browser-wasm',
        },
      },
    });

    await rehydrateDatasetFromOpfsSource({
      browserEngine: {
        ping: vi.fn().mockResolvedValue({ hasData: false }),
        loadBuffer,
        recode,
      } as any,
      dataset: {
        id: 'ds-1',
        name: 'grid.sav',
        rowCount: 50,
        source: 'sav',
        variables: [],
        opfsFileKey: 'grid_123.sav',
      },
      transformLog: [{
        type: 'recode',
        sourceColId: 'q1',
        newColId: 'q1_binned',
        label: 'Q1 Binned',
        config: { mode: 'binning', rules: [{ min: 0, max: 5, label: 'Low' }] },
        createdAt: 1,
      }],
      flushPersistedData: vi.fn().mockResolvedValue(undefined),
    }, { forceReload: true });

    expect(recode).toHaveBeenCalledWith(
      'q1',
      expect.objectContaining({
        mode: 'binning',
        rules: [{ min: 0, max: 5, label: 'Low' }],
        targetVariableName: 'q1_binned',
      }),
    );
  });
});
