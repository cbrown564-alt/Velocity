import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';

describe('Store: reorderRowVars', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useVelocityStore());
        act(() => {
            result.current.reset();
        });
    });

    it('should update rowVars with new order', () => {
        const { result } = renderHook(() => useVelocityStore());

        // Set initial row vars
        act(() => {
            result.current.setTableConfig({ rowVars: ['var1', 'var2', 'var3'] });
        });

        expect(result.current.tableConfig.rowVars).toEqual(['var1', 'var2', 'var3']);

        // Reorder: move var3 to first position
        act(() => {
            result.current.reorderRowVars(['var3', 'var1', 'var2']);
        });

        expect(result.current.tableConfig.rowVars).toEqual(['var3', 'var1', 'var2']);
    });

    it('should trigger runAnalysis after reordering', async () => {
        const { result } = renderHook(() => useVelocityStore());

        // Mock engineProxy to avoid actual query execution
        const mockEnvelope = (data: unknown) => ({
            data,
            operation: 'test',
            inputs: {},
            durationMs: 10,
            warnings: [],
            metadata: { datasetName: 'test.sav', rowCount: 0, filtersApplied: 0, isWeighted: false, engineVersion: 'browser-wasm' },
        });

        const mockRunCrosstab = vi.fn().mockResolvedValue(mockEnvelope({ rows: [], tableStats: null }));
        const mockEngineProxy = {
            runCrosstab: mockRunCrosstab,
            getVariableStats: vi.fn().mockResolvedValue(mockEnvelope({})),
        } as any;

        act(() => {
            result.current.engineProxy = mockEngineProxy;
            result.current.isDbReady = true;
            result.current.dataset = {
                id: 'ds1',
                name: 'test.sav',
                rowCount: 100,
                variables: [],
                source: 'sav',
            } as any;
        });

        // Set initial row vars
        act(() => {
            result.current.setTableConfig({ rowVars: ['var1', 'var2'] });
        });

        // Clear previous calls
        mockRunCrosstab.mockClear();

        // Reorder
        act(() => {
            result.current.reorderRowVars(['var2', 'var1']);
        });

        // Verify that runCrosstab was called (runAnalysis was triggered)
        expect(mockRunCrosstab).toHaveBeenCalled();
    });

    it('should preserve column variable when reordering rows', () => {
        const { result } = renderHook(() => useVelocityStore());

        act(() => {
            result.current.setTableConfig({
                rowVars: ['var1', 'var2'],
                colVar: 'colVar1'
            });
        });

        act(() => {
            result.current.reorderRowVars(['var2', 'var1']);
        });

        expect(result.current.tableConfig.rowVars).toEqual(['var2', 'var1']);
        expect(result.current.tableConfig.colVar).toBe('colVar1');
    });

    it('should handle empty reorder gracefully', () => {
        const { result } = renderHook(() => useVelocityStore());

        act(() => {
            result.current.setTableConfig({ rowVars: ['var1'] });
        });

        act(() => {
            result.current.reorderRowVars([]);
        });

        expect(result.current.tableConfig.rowVars).toEqual([]);
    });
});
