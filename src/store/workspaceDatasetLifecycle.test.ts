import { describe, expect, it } from 'vitest';
import { buildWorkspaceDatasetOpenPatch } from './workspaceDatasetLifecycle';
import type { WorkspaceDatasetOpenInput } from './slices/data/types';

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
});
