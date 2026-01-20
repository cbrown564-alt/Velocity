import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';
import { STORAGE_KEY, partialize } from './persistConfig';
import type { VelocityState } from './index';

// Mock localStorage for testing
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Store: Persistence', () => {
    beforeEach(() => {
        localStorageMock.clear();
        // Reset store state
        const { result } = renderHook(() => useVelocityStore());
        act(() => {
            result.current.reset();
        });
    });

    afterEach(() => {
        localStorageMock.clear();
    });

    describe('partialize function', () => {
        it('should include persistable state fields', () => {
            const mockState = {
                // DataSlice
                dataset: { id: 'ds1', name: 'test.sav', rowCount: 100, variables: [], source: 'sav' as const },
                variableSets: [{ id: 'vs1', name: 'Test', variableIds: ['v1'], structure: 'single' as const }],
                folders: [{ id: 'f1', name: 'Demographics', order: 0 }],
                worker: {} as Worker,
                isDbReady: true,
                initError: null,

                // UISlice
                appMode: 'analysis' as const,
                viewMode: 'table' as const,
                activeFolderId: 'f1',
                draggingId: 'v1',
                searchQuery: 'test',
                recodeModal: { isOpen: true, variable: null },
                filterModal: { isOpen: false },
                selectedVariableSetIds: ['vs1'],
                lastSelectedId: 'vs1',

                // AnalysisSlice
                tableConfig: { rowVars: ['v1'], colVar: 'v2' },
                activeFilters: [{ id: 'f1', variableId: 'v1', operator: 'eq' as const, value: 1 }],
                queryResult: [{ rowKeys: ['A'], colKey: 'B', count: 10 }],
                isQuerying: true,

                // DrillDownSlice
                drillDown: {
                    isOpen: true,
                    title: 'Test',
                    data: [{ col1: 'val' }],
                    loading: false,
                    totalCount: 1,
                    currentPage: 1,
                    pageSize: 50,
                    rowFilters: [],
                    colFilter: null,
                },
            } as unknown as VelocityState;

            const persisted = partialize(mockState);

            // Should include persistable fields
            expect(persisted.dataset).toBeDefined();
            expect(persisted.variableSets).toHaveLength(1);
            expect(persisted.folders).toHaveLength(1);
            expect(persisted.appMode).toBe('analysis');
            expect(persisted.viewMode).toBe('table');
            expect(persisted.activeFolderId).toBe('f1');
            expect(persisted.tableConfig).toEqual({ rowVars: ['v1'], colVar: 'v2' });
            expect(persisted.activeFilters).toHaveLength(1);
        });

        it('should NOT include ephemeral state fields', () => {
            const mockState = {
                dataset: null,
                variableSets: [],
                folders: [],
                worker: {} as Worker,
                isDbReady: true,
                initError: 'Some error',
                appMode: 'analysis' as const,
                viewMode: 'table' as const,
                activeFolderId: null,
                draggingId: 'v1',
                searchQuery: 'test',
                recodeModal: { isOpen: true, variable: null },
                filterModal: { isOpen: true },
                selectedVariableSetIds: ['vs1', 'vs2'],
                lastSelectedId: 'vs2',
                tableConfig: { rowVars: [], colVar: null },
                activeFilters: [],
                queryResult: [{ rowKeys: ['A'], colKey: 'B', count: 10 }],
                isQuerying: true,
                drillDown: { isOpen: true, title: 'Test', data: [], loading: false, totalCount: 0, currentPage: 1, pageSize: 50, rowFilters: [], colFilter: null },
            } as unknown as VelocityState;

            const persisted = partialize(mockState);
            const keys = Object.keys(persisted);

            // Should NOT include ephemeral fields
            expect(keys).not.toContain('worker');
            expect(keys).not.toContain('isDbReady');
            expect(keys).not.toContain('initError');
            expect(keys).not.toContain('draggingId');
            expect(keys).not.toContain('searchQuery');
            expect(keys).not.toContain('recodeModal');
            expect(keys).not.toContain('filterModal');
            expect(keys).not.toContain('selectedVariableSetIds');
            expect(keys).not.toContain('lastSelectedId');
            expect(keys).not.toContain('queryResult');
            expect(keys).not.toContain('isQuerying');
            expect(keys).not.toContain('drillDown');
        });
    });

    describe('storage configuration', () => {
        it('should use the correct storage key', () => {
            expect(STORAGE_KEY).toBe('velocity-state');
        });

        it('should export VERSION for future migrations', async () => {
            const { STORAGE_VERSION } = await import('./persistConfig');
            expect(STORAGE_VERSION).toBe(1);
        });
    });
});
