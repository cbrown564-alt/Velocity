import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVelocityStore } from '../../index';
import type { VariableStatsResult } from '../../../types/worker';

const mockStats: VariableStatsResult = {
  column: 'v1',
  frequencies: [{ value: 1, count: 50 }],
  totalCount: 100,
  missingCount: 0,
};

const mockEnvelope = (data: VariableStatsResult) => ({
  data,
  operation: 'getVariableStats',
  inputs: {},
  durationMs: 1,
  warnings: [],
  metadata: {},
});

describe('variableCatalogActions.getVariableStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
  });

  it('calls browserEngine.runAnalysis with variable metadata', async () => {
    const runAnalysis = vi.fn().mockResolvedValue(mockEnvelope(mockStats));
    const missingValues = { discrete: [99] };

    useVelocityStore.setState({
      browserEngine: { runAnalysis } as never,
      dataset: {
        id: 'ds-1',
        name: 'test.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          {
            id: 'v1',
            name: 'Q1',
            label: 'Question 1',
            type: 'ordered',
            orderedScoring: 'allow_numeric_stats',
            valueLabels: [],
            missingValues,
          },
        ],
      },
    });

    const result = await useVelocityStore.getState().getVariableStats('v1');

    expect(runAnalysis).toHaveBeenCalledWith('variableStats', {
      column: 'v1',
      variableType: 'ordered',
      orderedScoring: 'allow_numeric_stats',
      missingValues,
    });
    expect(result).toEqual(mockStats);
    expect(useVelocityStore.getState().variableStats.v1).toEqual(mockStats);
    expect(useVelocityStore.getState().variableStatsLoading.v1).toBe(false);
  });

  it('returns cached stats without calling runAnalysis', async () => {
    const runAnalysis = vi.fn().mockResolvedValue(mockEnvelope(mockStats));

    useVelocityStore.setState({
      browserEngine: { runAnalysis } as never,
      dataset: {
        id: 'ds-1',
        name: 'test.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          {
            id: 'v1',
            name: 'Q1',
            label: 'Question 1',
            type: 'nominal',
            valueLabels: [],
            missingValues: {},
          },
        ],
      },
      variableStats: { v1: mockStats },
    });

    const result = await useVelocityStore.getState().getVariableStats('v1');

    expect(runAnalysis).not.toHaveBeenCalled();
    expect(result).toEqual(mockStats);
  });

  it('refetches ordered stats when cached frequencies lack numeric summaries', async () => {
    const runAnalysis = vi.fn().mockResolvedValue(
      mockEnvelope({
        ...mockStats,
        numeric: {
          min: 1,
          max: 5,
          mean: 3.2,
          median: 3,
          stdDev: 1,
          q1: 2,
          q3: 4,
          histogramBins: [],
        },
      }),
    );
    useVelocityStore.setState({
      browserEngine: { runAnalysis } as never,
      dataset: {
        id: 'ds-1',
        name: 'test.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          {
            id: 'v1',
            name: 'Q1',
            label: 'Question 1',
            type: 'ordered',
            orderedScoring: 'allow_numeric_stats',
            valueLabels: [],
            missingValues: {},
          },
        ],
      },
      variableStats: { v1: mockStats },
    });

    await useVelocityStore.getState().getVariableStats('v1');
    expect(runAnalysis).toHaveBeenCalled();
  });

  it('returns null while a fetch is already in progress', async () => {
    const runAnalysis = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    useVelocityStore.setState({
      browserEngine: { runAnalysis } as never,
      variableStats: {},
      dataset: {
        id: 'ds-1',
        name: 'test.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          {
            id: 'v1',
            name: 'Q1',
            label: 'Question 1',
            type: 'nominal',
            valueLabels: [],
            missingValues: {},
          },
        ],
      },
      variableStatsLoading: { v1: true },
    });

    const result = await useVelocityStore.getState().getVariableStats('v1');

    expect(result).toBeNull();
    expect(runAnalysis).not.toHaveBeenCalled();
  });
});

describe('variableCatalogActions catalog mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      dataset: {
        id: 'ds-1',
        name: 'test.sav',
        rowCount: 100,
        source: 'sav',
        variables: [
          {
            id: 'v1',
            name: 'gender',
            label: 'Gender',
            type: 'nominal',
            valueLabels: [
              { value: 1, label: 'Male' },
              { value: 2, label: 'Female' },
            ],
            missingValues: {},
          },
          {
            id: 'v2',
            name: 'region',
            label: 'Region',
            type: 'nominal',
            valueLabels: [],
            missingValues: {},
          },
        ],
      },
      variableSets: [
        { id: 'vs-grid', name: 'Grid', variableIds: ['v1', 'v2'], structure: 'multiple', type: 'nominal' },
        { id: 'vs-single', name: 'Gender', variableIds: ['v1'], structure: 'single', type: 'nominal' },
      ],
      folders: [{ id: 'folder-1', name: 'Demographics', order: 0 }],
      browserEngine: {
        getUniqueValues: vi.fn().mockResolvedValue({ data: ['east', 'west'] }),
        runAnalysis: vi.fn(),
      } as never,
    });
  });

  it('getUniqueValues returns embedded value labels without calling the engine', async () => {
    const getUniqueValues = vi.fn();
    useVelocityStore.setState({
      browserEngine: { getUniqueValues } as never,
    });

    const values = await useVelocityStore.getState().getUniqueValues('v1');
    expect(values).toEqual(['1', '2']);
    expect(getUniqueValues).not.toHaveBeenCalled();
  });

  it('getUniqueValues delegates to the engine when labels are absent', async () => {
    const getUniqueValues = vi.fn().mockResolvedValue({ data: ['east', 'west'] });
    useVelocityStore.setState({
      browserEngine: { getUniqueValues } as never,
    });

    const values = await useVelocityStore.getState().getUniqueValues('v2');
    expect(getUniqueValues).toHaveBeenCalledWith('v2');
    expect(values).toEqual(['east', 'west']);
  });

  it('createVariableSet adds a grouped set and removes superseded singles', () => {
    useVelocityStore.getState().createVariableSet('Gender + Region', ['v1', 'v2']);
    const sets = useVelocityStore.getState().variableSets;
    expect(sets.some((s) => s.name === 'Gender + Region' && s.structure === 'multiple')).toBe(true);
  });

  it('splitVariableSet expands a multi-variable set into singles', () => {
    useVelocityStore.getState().splitVariableSet('vs-grid');
    const sets = useVelocityStore.getState().variableSets;
    expect(sets.filter((s) => s.structure === 'single').length).toBeGreaterThanOrEqual(2);
  });

  it('setWeightVariable stores the selected weight on the dataset', () => {
    useVelocityStore.getState().setWeightVariable('v2');
    expect(useVelocityStore.getState().dataset?.weightVariable).toBe('v2');
  });

  it('createFolder, renameFolder, and deleteFolder manage folder metadata', () => {
    const folderId = useVelocityStore.getState().createFolder('Wave 1');
    expect(useVelocityStore.getState().folders.some((f) => f.name === 'Wave 1')).toBe(true);

    useVelocityStore.getState().renameFolder(folderId, 'Wave One');
    expect(useVelocityStore.getState().folders.find((f) => f.id === folderId)?.name).toBe('Wave One');

    useVelocityStore.getState().deleteFolder('folder-1');
    expect(useVelocityStore.getState().folders.find((f) => f.id === 'folder-1')).toBeUndefined();
  });

  it('moveToFolder and bulkHide update variable set metadata', () => {
    useVelocityStore.getState().moveToFolder(['vs-single'], 'folder-1');
    expect(useVelocityStore.getState().variableSets.find((s) => s.id === 'vs-single')?.folderId).toBe('folder-1');

    useVelocityStore.getState().bulkHide(['vs-single'], true);
    expect(useVelocityStore.getState().variableSets.find((s) => s.id === 'vs-single')?.hidden).toBe(true);
  });

  it('updateVariableMetadata and updateValueLabel keep labels in sync', () => {
    useVelocityStore.getState().updateVariableMetadata('v1', { label: 'Sex' });
    expect(useVelocityStore.getState().dataset?.variables.find((v) => v.id === 'v1')?.label).toBe('Sex');

    useVelocityStore.getState().updateValueLabel('v1', 1, 'Man');
    expect(useVelocityStore.getState().dataset?.variables.find((v) => v.id === 'v1')?.valueLabels[0]?.label).toBe(
      'Man',
    );
  });

  it('convertMultipleToGrid, reorderVariableSets, and bulkSetType mutate sets', () => {
    useVelocityStore.getState().convertMultipleToGrid('vs-grid');
    expect(useVelocityStore.getState().variableSets.find((s) => s.id === 'vs-grid')?.structure).toBe('grid');

    useVelocityStore.getState().reorderVariableSets('vs-single', 'vs-grid');
    const order = useVelocityStore.getState().variableSets.map((s) => s.id);
    expect(order[0]).toBe('vs-single');

    useVelocityStore.getState().bulkSetType(['vs-single'], 'ordered');
    expect(useVelocityStore.getState().variableSets.find((s) => s.id === 'vs-single')?.type).toBe('ordered');
  });

  it('toggleDiscreteMissingValue updates missing codes and clears cached stats', () => {
    useVelocityStore.setState({
      variableStats: { v1: mockStats },
      runAnalysis: vi.fn().mockResolvedValue(undefined),
    });

    useVelocityStore.getState().toggleDiscreteMissingValue('v1', 99, true);
    expect(useVelocityStore.getState().dataset?.variables.find((v) => v.id === 'v1')?.missingValues.discrete).toContain(
      99,
    );
    expect(useVelocityStore.getState().variableStats.v1).toBeUndefined();
  });
});
