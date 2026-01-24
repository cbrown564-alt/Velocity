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

        // Mock worker to avoid actual query execution
        const mockWorker = {
            postMessage: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as any;

        act(() => {
            result.current.worker = mockWorker;
            result.current.isDbReady = true;
        });

        // Set initial row vars
        act(() => {
            result.current.setTableConfig({ rowVars: ['var1', 'var2'] });
        });

        // Clear previous postMessage calls
        mockWorker.postMessage.mockClear();

        // Reorder
        act(() => {
            result.current.reorderRowVars(['var2', 'var1']);
        });

        // Verify that a query was posted (runAnalysis was called)
        expect(mockWorker.postMessage).toHaveBeenCalled();
        const lastCall = mockWorker.postMessage.mock.calls[mockWorker.postMessage.mock.calls.length - 1];
        expect(lastCall[0].type).toBe('runCrosstab');
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
