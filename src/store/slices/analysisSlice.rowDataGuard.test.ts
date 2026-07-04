import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVelocityStore } from '../index';

describe('analysisSlice row-data guard', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: null },
      dataset: {
        id: 'ds1',
        name: 'demo.sav',
        rowCount: 100,
        variables: [{ id: 'gender', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} }],
        source: 'sav',
        opfsFileKey: 'demo.sav',
      },
      variableSets: [{ id: 'gender', name: 'Gender', variableIds: ['gender'], structure: 'single', type: 'categorical' }],
      browserEngine: {
        ping: vi.fn().mockResolvedValue({ hasData: false }),
        runAnalysis: vi.fn(),
      } as never,
      isQuerying: false,
      queryError: null,
    });
  });

  it('does not query DuckDB when the main table is missing', async () => {
    await useVelocityStore.getState().runAnalysis();

    expect(useVelocityStore.getState().browserEngine?.ping).toHaveBeenCalled();
    expect(useVelocityStore.getState().browserEngine?.runAnalysis).not.toHaveBeenCalled();
    expect(useVelocityStore.getState().queryError).toMatch(/Row data is not loaded yet/i);
    expect(useVelocityStore.getState().isQuerying).toBe(false);
  });
});
