/**
 * Transform actions: recode, fill missing, delete grouped variables, split group values.
 */

import type { RecodeConfig } from '../../../types';
import type { Variable } from '../../../types/dataset';
import type { DataSlice } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { getRunAnalysis as resolveRunAnalysis } from './sliceContext';

export function createTransformActions(
    set: DataSliceSet,
    get: DataSliceGet,
): Pick<
    DataSlice,
    'recodeVariable' | 'fillSystemMissing' | 'deleteGroupedVariable' | 'splitGroupValue'
> {
    return {
        recodeVariable: async (sourceColId: string, newColName: string, config: RecodeConfig): Promise<string> => {
            const { browserEngine, dataset } = get();
            if (!browserEngine) throw new Error('Engine not initialized');

            const envelope = await browserEngine.recode(sourceColId, {
                ...config,
                targetVariableName: newColName,
            });
            const newColId = envelope.data.column;

            if (dataset) {
                const createdAt = Date.now();
                const newVariable: Variable = {
                    id: newColId,
                    name: newColId,
                    label: newColName,
                    type: 'categorical',
                    valueLabels: [],
                    missingValues: {},
                };
                const updatedDataset = {
                    ...dataset,
                    variables: [...dataset.variables, newVariable],
                };
                set((state) => ({
                    dataset: updatedDataset,
                    variableSets: [...state.variableSets, {
                        id: crypto.randomUUID(),
                        name: newColName,
                        variableIds: [newColId],
                        structure: 'single',
                        type: 'categorical',
                    }],
                    transformLog: [
                        ...state.transformLog,
                        {
                            type: 'recode',
                            sourceColId,
                            newColId,
                            label: newColName,
                            config,
                            createdAt,
                        },
                    ],
                }));

                void browserEngine.updatePersistenceMetadata({
                    datasetId: updatedDataset.id,
                    datasetName: updatedDataset.name,
                    rowCount: updatedDataset.rowCount,
                    columnCount: updatedDataset.variables.length,
                    schemaVersion: 1,
                    lastModified: createdAt,
                });
            }
            void get().flushPersistedData();
            return newColId;
        },

        fillSystemMissing: async (variableId: string, replacementCode: number, replacementLabel: string): Promise<void> => {
            const { browserEngine, dataset } = get();
            if (!browserEngine) throw new Error('Engine not initialized');
            if (!dataset) throw new Error('No dataset loaded');

            const variable = dataset.variables.find(v => v.id === variableId);
            if (!variable) throw new Error(`Variable not found: ${variableId}`);

            if (variable.missingValues.range) {
                const low = Math.min(variable.missingValues.range.low, variable.missingValues.range.high);
                const high = Math.max(variable.missingValues.range.low, variable.missingValues.range.high);
                if (replacementCode >= low && replacementCode <= high) {
                    throw new Error(`Replacement code ${replacementCode} falls within missing range ${low}-${high}`);
                }
            }

            await browserEngine.fillSystemMissing(variableId, replacementCode);

            set((state) => {
                if (!state.dataset) return state;
                return {
                    dataset: {
                        ...state.dataset,
                        variables: state.dataset.variables.map(v => {
                            if (v.id !== variableId) return v;
                            const existingLabel = v.valueLabels.find(vl => vl.value === replacementCode);
                            const valueLabels = existingLabel
                                ? v.valueLabels.map(vl => vl.value === replacementCode ? { ...vl, label: replacementLabel } : vl)
                                : [...v.valueLabels, { value: replacementCode, label: replacementLabel }];
                            const discrete = (v.missingValues.discrete || []).filter(code => code !== replacementCode);
                            return { ...v, valueLabels, missingValues: { ...v.missingValues, discrete } };
                        }),
                    },
                    variableStats: Object.fromEntries(
                        Object.entries(state.variableStats).filter(([key]) => key !== variableId)
                    ),
                    variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
                };
            });

            void get().getVariableStats(variableId);
        },

        deleteGroupedVariable: async (varId: string): Promise<void> => {
            const { browserEngine, dataset, variableSets, transformLog } = get();
            if (!browserEngine || !dataset) return;

            const transform = transformLog.find(t => t.newColId === varId);
            if (!transform) return;

            await browserEngine.dropColumn(varId);

            set((state) => {
                const newVariables = state.dataset
                    ? state.dataset.variables.filter(v => v.id !== varId)
                    : (state.dataset?.variables ?? []);
                const newVariableSets = state.variableSets.filter(
                    vs => !vs.variableIds.includes(varId)
                );
                const newTransformLog = state.transformLog.filter(t => t.newColId !== varId);

                return {
                    dataset: state.dataset ? { ...state.dataset, variables: newVariables } : state.dataset,
                    variableSets: newVariableSets,
                    transformLog: newTransformLog,
                    variableStats: Object.fromEntries(
                        Object.entries(state.variableStats).filter(([key]) => key !== varId)
                    ),
                };
            });

            const { tableConfig, setTableConfig } = get();
            if (tableConfig) {
                const newRowVars = tableConfig.rowVars.map(id => id === varId ? transform.sourceColId : id);
                const newColVar = tableConfig.colVar === varId ? transform.sourceColId : tableConfig.colVar;
                setTableConfig({ rowVars: newRowVars, colVar: newColVar });
            }

            const { setSelectedVariableId } = get();
            if (typeof setSelectedVariableId === 'function') {
                setSelectedVariableId(transform.sourceColId);
            }

            void get().flushPersistedData();
        },

        splitGroupValue: async (varId: string, groupValue: string): Promise<void> => {
            const { browserEngine, dataset, transformLog } = get();
            if (!browserEngine || !dataset) return;

            const transform = transformLog.find(t => t.newColId === varId);
            if (!transform || transform.config.mode !== 'categorical' || !transform.config.mappings) return;

            const sourceVar = dataset.variables.find(v => v.id === transform.sourceColId);

            const newMappings: Record<string, string> = {};
            for (const [key, val] of Object.entries(transform.config.mappings)) {
                if (val === groupValue) {
                    const originalLabel = sourceVar?.valueLabels.find(
                        vl => String(vl.value) === key
                    )?.label ?? key;
                    newMappings[key] = originalLabel;
                } else {
                    newMappings[key] = val;
                }
            }

            const newConfig: RecodeConfig = { ...transform.config, mappings: newMappings };

            await browserEngine.updateColumn(transform.sourceColId, varId, newConfig);

            set((state) => ({
                transformLog: state.transformLog.map(t =>
                    t.newColId === varId ? { ...t, config: newConfig } : t
                ),
                variableStats: Object.fromEntries(
                    Object.entries(state.variableStats).filter(([key]) => key !== varId)
                ),
                variableStatsLoading: { ...state.variableStatsLoading, [varId]: false },
            }));

            void get().getVariableStats(varId);
            const runAnalysis = resolveRunAnalysis(get);
            if (runAnalysis) {
                void runAnalysis().catch((error) => {
                    console.warn('[DataSlice] Analysis refresh failed after splitGroupValue:', error);
                });
            }
        },
    };
}
