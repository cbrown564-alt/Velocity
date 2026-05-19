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
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

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
        it('preserves active dataset value labels while compacting workspace copies', () => {
            const mockState = {
                dataset: {
                    id: 'ds1',
                    name: 'test.sav',
                    rowCount: 100,
                    source: 'sav' as const,
                    variables: [{
                        id: 'v1',
                        name: 'v1',
                        label: 'Var 1',
                        type: 'categorical',
                        valueLabels: [{ value: 1, label: 'Yes' }],
                        missingValues: {},
                    }],
                },
                workspace: {
                    datasets: [{
                        id: 'ds1',
                        name: 'test.sav',
                        fileName: 'test.sav',
                        rowCount: 100,
                        columnCount: 1,
                        fileSize: 1,
                        source: 'sav' as const,
                        createdAt: Date.now(),
                        lastOpenedAt: Date.now(),
                        lastModifiedAt: Date.now(),
                        starred: false,
                        variables: [{
                            id: 'v1',
                            name: 'v1',
                            label: 'Var 1',
                            type: 'categorical',
                            valueLabels: [{ value: 1, label: 'Yes' }],
                            missingValues: {},
                        }],
                    }],
                    projects: [],
                    storageUsed: 0,
                    storageQuota: 0,
                },
                variableSets: [],
                folders: [],
                transformLog: [],
                appMode: 'analysis' as const,
                activeFolderId: null,
                tableConfig: { rowVars: [], colVar: null },
                activeFilters: [],
                activeDatasetId: null,
                isWorkspaceMode: true,
                harmonization: { session: null },
            } as unknown as VelocityState;

            const persisted = partialize(mockState);
            expect(persisted.dataset?.variables[0].valueLabels).toHaveLength(1);
            expect(persisted.workspace.datasets[0].variables?.[0].valueLabels).toEqual([]);
        });

        it('preserves workspace dataset session metadata needed for source rebuilds', () => {
            const mockState = {
                dataset: null,
                variableSets: [],
                folders: [],
                transformLog: [],
                appMode: 'analysis' as const,
                activeFolderId: null,
                tableConfig: { rowVars: [], colVar: null },
                activeFilters: [],
                activeDatasetId: 'ds1',
                isWorkspaceMode: true,
                harmonization: { session: null },
                workspace: {
                    datasets: [{
                        id: 'ds1',
                        name: 'test.sav',
                        fileName: 'test.sav',
                        rowCount: 100,
                        columnCount: 2,
                        fileSize: 1,
                        source: 'sav' as const,
                        createdAt: Date.now(),
                        lastOpenedAt: Date.now(),
                        lastModifiedAt: Date.now(),
                        starred: false,
                        variables: [],
                        variableSets: [{
                            id: 'grid-1',
                            name: 'Brand Ratings',
                            variableIds: ['q1_a', 'q1_b'],
                            structure: 'grid' as const,
                            type: 'ordered' as const,
                        }],
                        folders: [{ id: 'folder-1', name: 'Brands', order: 0 }],
                        sessionState: {
                            tableConfig: { rowVars: ['q1_recode'], colVar: null },
                            activeFilters: [],
                            transformLog: [{
                                type: 'recode',
                                sourceColId: 'q1',
                                newColId: 'q1_recode',
                                label: 'Q1 Recode',
                                config: { mode: 'categorical', mappings: { 1: 'Top box' } },
                                createdAt: 123,
                            }],
                        },
                    }],
                    projects: [],
                    storageUsed: 0,
                    storageQuota: 0,
                },
            } as unknown as VelocityState;

            const persisted = partialize(mockState);
            const stored = persisted.workspace.datasets[0] as any;
            expect(stored.variableSets).toHaveLength(1);
            expect(stored.folders).toEqual([{ id: 'folder-1', name: 'Brands', order: 0 }]);
            expect(stored.sessionState.transformLog).toEqual(mockState.workspace.datasets[0].sessionState.transformLog);
        });

        it('should include persistable state fields', () => {
            const mockState = {
                // DataSlice
                dataset: { id: 'ds1', name: 'test.sav', rowCount: 100, variables: [], source: 'sav' as const },
                variableSets: [{ id: 'vs1', name: 'Test', variableIds: ['v1'], structure: 'single' as const }],
                folders: [{ id: 'f1', name: 'Demographics', order: 0 }],
                engineProxy: null,
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

                // SlidesSlice
                slides: [{
                    id: 'slide-1',
                    title: 'Analysis 1',
                    subtitle: '',
                    analysisState: {
                        rowVars: ['v1'],
                        colVar: 'v2',
                        filters: [],
                        weightVar: null,
                    },
                    visualizationType: 'table' as const,
                    layoutMode: 'focus' as const,
                    cells: [{ id: 'cell-1', content: { type: 'table' as const } }],
                    createdAt: 1,
                    updatedAt: 1,
                }],
                sections: [{ id: 'section-1', title: 'Intro' }],
                activeSlideId: 'slide-1',
                activeCellId: 'cell-1',

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
            expect(persisted.activeFolderId).toBe('f1');
            expect(persisted.tableConfig).toEqual({ rowVars: ['v1'], colVar: 'v2' });
            expect(persisted.activeFilters).toHaveLength(1);
            expect(persisted.slides).toHaveLength(1);
            expect(persisted.sections).toHaveLength(1);
            expect(persisted.activeSlideId).toBe('slide-1');
            expect(persisted.activeCellId).toBe('cell-1');
        });

        it('should NOT include ephemeral state fields', () => {
            const mockState = {
                dataset: null,
                variableSets: [],
                folders: [],
                engineProxy: null,
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
                slides: [],
                sections: [],
                activeSlideId: null,
                activeCellId: null,
                queryResult: [{ rowKeys: ['A'], colKey: 'B', count: 10 }],
                isQuerying: true,
                drillDown: { isOpen: true, title: 'Test', data: [], loading: false, totalCount: 0, currentPage: 1, pageSize: 50, rowFilters: [], colFilter: null },
            } as unknown as VelocityState;

            const persisted = partialize(mockState);
            const keys = Object.keys(persisted);

            // Should NOT include ephemeral fields
            expect(keys).not.toContain('engineProxy');
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
