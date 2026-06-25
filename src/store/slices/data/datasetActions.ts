/**
 * Dataset loading and workspace open actions.
 */

import { enrichVariablesWithSemantic } from '../../../core/semantic/respondentIdentifier';
import type { AggregatedRow } from '../../../types';
import type { Filter } from '../../../types/analysis';
import type { VariableStatsResult } from '../../../types/worker';
import {
    openWorkspaceDatasetLifecycle,
} from '../../workspaceDatasetLifecycle';
import { sessionStateToStorePatch } from '../../datasetSessionCoordinator';
import type { Variable, VariableSet } from '../../../types/dataset';
import type { DataSlice, WorkspaceDatasetOpenInput } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { getRunAnalysis as resolveRunAnalysis } from './sliceContext';
import { normalizeVariable, normalizeVariableSet } from './variableNormalization';

function postLoadAnalysisReset() {
    return {
        tableConfig: { rowVars: [] as string[], colVar: null as string | null },
        queryResult: [] as AggregatedRow[],
        activeFilters: [] as Filter[],
    };
}

function clearVariableStatsCache() {
    return {
        variableStats: {} as Record<string, VariableStatsResult>,
        variableStatsLoading: {} as Record<string, boolean>,
    };
}

export function createDatasetActions(
    set: DataSliceSet,
    get: DataSliceGet,
): Pick<
    DataSlice,
    'loadCSV' | 'loadSAV' | 'loadSAVMetadata' | 'loadSAVSample' | 'openWorkspaceDataset'
> {
    return {
        loadCSV: async (fileName: string, content: string) => {
            const { browserEngine } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const buffer = new TextEncoder().encode(content).buffer;
            const { loaded } = await browserEngine.loadBuffer(fileName, buffer, 'csv');
            if (loaded.type !== 'engine.csvLoaded') {
                throw new Error('Unexpected loadBuffer response for CSV');
            }
            const response = loaded;

            const variableSets: VariableSet[] = response.schema.map((col) => {
                const id = col.name;
                const label = col.name.replace(/_/g, ' ');
                const type = col.type === 'VARCHAR' ? 'categorical' : 'numeric';
                return {
                    id: crypto.randomUUID(),
                    name: label || id,
                    variableIds: [id],
                    structure: 'single' as const,
                    type,
                };
            });

            const variables: Variable[] = enrichVariablesWithSemantic(
                response.schema.map((col) => ({
                    id: col.name,
                    name: col.name,
                    label: col.name.replace(/_/g, ' '),
                    type: col.type === 'VARCHAR' ? 'categorical' : 'numeric',
                    valueLabels: [],
                    missingValues: {},
                })),
                variableSets,
            );

            set({
                dataset: {
                    id: crypto.randomUUID(),
                    name: fileName,
                    rowCount: response.rowCount,
                    variables,
                    source: 'csv',
                },
                variableSets,
                transformLog: [],
                ...clearVariableStatsCache(),
                ...postLoadAnalysisReset(),
            });

            const datasetId = get().dataset?.id;
            if (datasetId) {
                void browserEngine.updatePersistenceMetadata({
                    datasetId,
                    datasetName: fileName,
                    rowCount: response.rowCount,
                    columnCount: variables.length,
                    schemaVersion: 1,
                    lastModified: Date.now(),
                });
            }

            void get().flushPersistedData();
        },

        loadSAV: async (fileName: string, buffer: ArrayBuffer, options?: { datasetId?: string; opfsFileKey?: string }) => {
            const targetDatasetId = options?.datasetId;
            const currentDataset = get().dataset;

            if (targetDatasetId && currentDataset?.id !== targetDatasetId) {
                if (currentDataset) {
                    await get().flushPersistedData().catch(() => {});
                }
                await get().respawnWorker(false, targetDatasetId);
            }

            const { browserEngine } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const { loaded } = await browserEngine.loadBuffer(fileName, buffer, 'sav');
            if (loaded.type !== 'engine.savLoaded') {
                throw new Error('Unexpected loadBuffer response for SAV');
            }
            const response = loaded;

            const datasetId = targetDatasetId || crypto.randomUUID();
            const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
            const variables: Variable[] = response.variables.map(normalizeVariable);

            const gridSets = variableSets.filter(vs => vs.structure === 'grid');
            const multipleSets = variableSets.filter(vs => vs.structure === 'multiple');
            if (gridSets.length > 0 || multipleSets.length > 0) {
                console.log(`📊 [DataSlice] Detected ${gridSets.length} grid sets, ${multipleSets.length} multi-response sets`);
            }

            set({
                dataset: {
                    id: datasetId,
                    name: fileName,
                    rowCount: response.rowCount,
                    variables,
                    source: 'sav',
                    opfsFileKey: options?.opfsFileKey,
                    metadataOnly: false,
                    loadDiagnostics: undefined,
                },
                variableSets,
                transformLog: [],
                ...clearVariableStatsCache(),
                ...postLoadAnalysisReset(),
            });

            console.log(`📊 [DataSlice] SAV loaded: ${response.rowCount} rows, ${variables.length} variables, ${variableSets.length} variable sets in ${response.durationMs.toFixed(2)}ms`);
            if (datasetId) {
                void browserEngine.updatePersistenceMetadata({
                    datasetId,
                    datasetName: fileName,
                    rowCount: response.rowCount,
                    columnCount: variables.length,
                    schemaVersion: 1,
                    lastModified: Date.now(),
                });
            }
            void get().flushPersistedData();
        },

        loadSAVMetadata: async (fileName: string, buffer: ArrayBuffer) => {
            const { browserEngine } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const response = await browserEngine.loadSAVMetadata(buffer);
            const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
            const variables: Variable[] = response.variables.map(normalizeVariable);

            set({
                dataset: {
                    id: crypto.randomUUID(),
                    name: fileName,
                    rowCount: response.rowCount,
                    variables,
                    source: 'sav',
                    metadataOnly: true,
                    loadDiagnostics: {
                        isPartial: true,
                        reason: 'metadata_only',
                        message: 'Loaded metadata only. Full row data is not available until you load from source.',
                        createdAt: Date.now(),
                    },
                },
                variableSets,
                ...clearVariableStatsCache(),
                ...postLoadAnalysisReset(),
            });

            console.log(`📊 [DataSlice] SAV metadata loaded: ${response.rowCount} rows, ${variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
        },

        loadSAVSample: async (fileName: string, buffer: ArrayBuffer, rowLimit: number, strategy: 'sequential' | 'spread' = 'spread') => {
            const { browserEngine } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const response = await browserEngine.loadSAVSample(buffer, rowLimit, strategy);
            const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
            const variables: Variable[] = response.variables.map(normalizeVariable);

            set({
                dataset: {
                    id: crypto.randomUUID(),
                    name: fileName,
                    rowCount: response.rowCount,
                    variables,
                    source: 'sav',
                    metadataOnly: true,
                    sampleRowCount: response.sampleRowCount,
                    sampleStrategy: response.sampleStrategy,
                    loadDiagnostics: {
                        isPartial: true,
                        reason: 'sampling',
                        message: 'Loaded using sampled metadata to reduce memory risk. Value labels may be incomplete until full load.',
                        createdAt: Date.now(),
                    },
                },
                variableSets,
                ...clearVariableStatsCache(),
                ...postLoadAnalysisReset(),
            });

            console.log(`📊 [DataSlice] SAV sample loaded: ${response.sampleRowCount}/${response.rowCount} rows (${response.sampleStrategy}), ${variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
        },

        openWorkspaceDataset: async (stored: WorkspaceDatasetOpenInput) => {
            const { browserEngine, dataset: currentDataset } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const runAnalysis = resolveRunAnalysis(get);

            await openWorkspaceDatasetLifecycle(stored, {
                currentDataset,
                runAnalysis,
                flushPersistedData: () => get().flushPersistedData(),
                respawnWorker: (cleanStart, datasetId) => get().respawnWorker(cleanStart, datasetId),
                getBrowserEngine: () => get().browserEngine,
                applyOpenPatch: (patch) => {
                    const sessionPatch = sessionStateToStorePatch({
                        tableConfig: patch.tableConfig,
                        activeFilters: patch.activeFilters,
                        transformLog: patch.transformLog,
                    });
                    set({
                        dataset: patch.dataset,
                        variableSets: patch.variableSets,
                        folders: patch.folders,
                        transformLog: sessionPatch.transformLog,
                        variableStats: {},
                        variableStatsLoading: {},
                        tableConfig: sessionPatch.tableConfig,
                        activeFilters: sessionPatch.activeFilters,
                        queryResult: [],
                        tableStats: null,
                        persistenceState: 'checking',
                        persistedDataInfo: null,
                        persistenceError: null,
                    });
                },
                applySameDatasetSession: (sessionState) => {
                    if (!sessionState) return;
                    set(sessionStateToStorePatch(sessionState));
                },
                rehydrateFromOpfs: (options) => get().rehydrateDatasetFromOpfs(options),
            });
        },
    };
}
