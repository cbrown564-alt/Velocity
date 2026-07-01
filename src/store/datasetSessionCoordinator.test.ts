import { describe, expect, it, vi } from 'vitest';
import {
  captureBeforeDatasetSwitch,
  captureCatalogSnapshot,
  captureSessionSnapshot,
  enrichTableConfigLabels,
  normalizeStoredSessionState,
  persistDatasetSession,
  sessionStateToStorePatch,
  shouldCaptureBeforeSwitch,
} from './datasetSessionCoordinator';
import type { DatasetLiveState } from './datasetSessionCoordinator';

const baseLive = (): DatasetLiveState => ({
  dataset: {
    id: 'ds-1',
    name: 'survey.sav',
    rowCount: 100,
    source: 'sav',
    variables: [{ id: 'q1', name: 'q1', label: 'Q1', type: 'categorical', valueLabels: [], missingValues: {} }],
  },
  activeDatasetId: 'ds-1',
  tableConfig: { rowVars: ['q1'], colVar: null },
  activeFilters: [{ id: 'f1', variableId: 'q1', operator: 'eq', value: 1 }],
  transformLog: [],
  variableSets: [{ id: 'set-1', name: 'Set 1', variableIds: ['q1'], structure: 'single', type: 'categorical' }],
  folders: [{ id: 'folder-1', name: 'Folder', order: 0 }],
});

describe('datasetSessionCoordinator', () => {
  it('captures session and catalog snapshots from live state', () => {
    const live = baseLive();

    expect(captureSessionSnapshot(live)).toEqual({
      tableConfig: {
        rowVars: ['q1'],
        colVar: null,
        rowVarLabels: ['Q1'],
        colVarLabel: null,
      },
      activeFilters: [{ id: 'f1', variableId: 'q1', operator: 'eq', value: 1 }],
      transformLog: [],
    });

    expect(captureCatalogSnapshot(live)).toEqual({
      variables: live.dataset!.variables,
      variableSets: live.variableSets,
      folders: live.folders,
    });
  });

  it('persists session and catalog when dataset is active', () => {
    const live = baseLive();
    const saveDatasetSession = vi.fn();
    const updateStoredDataset = vi.fn();

    persistDatasetSession(live, { saveDatasetSession, updateStoredDataset });

    expect(saveDatasetSession).toHaveBeenCalledWith('ds-1', captureSessionSnapshot(live));
    expect(updateStoredDataset).toHaveBeenCalledWith('ds-1', captureCatalogSnapshot(live));
  });

  it('skips persistence when no active dataset', () => {
    const saveDatasetSession = vi.fn();
    const updateStoredDataset = vi.fn();

    persistDatasetSession(
      { ...baseLive(), dataset: null, activeDatasetId: null },
      { saveDatasetSession, updateStoredDataset },
    );

    expect(saveDatasetSession).not.toHaveBeenCalled();
    expect(updateStoredDataset).not.toHaveBeenCalled();
  });

  it('captures only when switching to a different dataset', () => {
    const live = baseLive();

    expect(shouldCaptureBeforeSwitch(live, 'ds-2')).toBe(true);
    expect(shouldCaptureBeforeSwitch(live, 'ds-1')).toBe(false);
    expect(shouldCaptureBeforeSwitch({ dataset: null, activeDatasetId: null }, 'ds-2')).toBe(false);
  });

  it('captureBeforeDatasetSwitch delegates to persist only on switch', () => {
    const live = baseLive();
    const actions = {
      saveDatasetSession: vi.fn(),
      updateStoredDataset: vi.fn(),
    };

    captureBeforeDatasetSwitch(live, 'ds-1', actions);
    expect(actions.saveDatasetSession).not.toHaveBeenCalled();

    captureBeforeDatasetSwitch(live, 'ds-2', actions);
    expect(actions.saveDatasetSession).toHaveBeenCalledOnce();
    expect(actions.updateStoredDataset).toHaveBeenCalledOnce();
  });

  it('normalizes partial stored session state with typed defaults', () => {
    expect(normalizeStoredSessionState()).toEqual({
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      transformLog: [],
    });

    expect(
      normalizeStoredSessionState({
        tableConfig: { rowVars: ['a'], colVar: 'b' },
        activeFilters: [{ id: 'f1', variableId: 'a', operator: 'in', value: [1, 2] }],
      }),
    ).toEqual({
      tableConfig: { rowVars: ['a'], colVar: 'b' },
      activeFilters: [{ id: 'f1', variableId: 'a', operator: 'in', value: [1, 2] }],
      transformLog: [],
    });
  });

  it('enriches table config labels from the live variable catalog', () => {
    const live = baseLive();
    expect(enrichTableConfigLabels(live.tableConfig, live.dataset?.variables)).toEqual({
      rowVars: ['q1'],
      colVar: null,
      rowVarLabels: ['Q1'],
      colVarLabel: null,
    });
  });

  it('maps session state to store patch without casts', () => {
    const session = captureSessionSnapshot(baseLive());
    expect(sessionStateToStorePatch(session)).toEqual(session);
  });
});
