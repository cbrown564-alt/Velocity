
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';
import { mockDataset } from '../fixtures/variables';

describe('Integration: SAV Ingestion Flow', () => {

    beforeEach(() => {
        useVelocityStore.setState({
            browserEngine: null,
            dataset: null,
            variableSets: [],
            isDbReady: false,
        });
        vi.clearAllMocks();
    });

    it('should load SAV via browserEngine and update store on success', async () => {
        const variables = mockDataset.variables;
        const variableSets = mockDataset.variables.map(v => ({
            id: v.id,
            name: v.label,
            variableIds: [v.id],
            structure: 'single' as const,
            type: v.type
        }));

        // Mock browserEngine with loadSAV returning expected response
        const mockEngineProxy = {
            loadBuffer: vi.fn().mockResolvedValue({
                loaded: {
                    type: 'engine.savLoaded',
                    variables,
                    variableSets,
                    rowCount: 500,
                    durationMs: 125,
                },
                envelope: {
                    data: {
                        datasetName: 'test_survey.sav',
                        rowCount: 500,
                        variableCount: variables.length,
                        variableSetCount: variableSets.length,
                        source: 'sav',
                    },
                    operation: 'loadBuffer',
                    inputs: {},
                    durationMs: 125,
                    warnings: [],
                    metadata: {
                        datasetName: 'test_survey.sav',
                        rowCount: 500,
                        filtersApplied: 0,
                        isWeighted: false,
                        engineVersion: 'browser-wasm',
                    },
                },
            }),
            checkPersistedData: vi.fn().mockResolvedValue({ type: 'engine.noPersistedData' }),
            init: vi.fn().mockResolvedValue({ opfsAvailable: false }),
            updatePersistenceMetadata: vi.fn(),
            setDatasetContext: vi.fn(),
        } as any;

        useVelocityStore.setState({
            browserEngine: mockEngineProxy,
            isDbReady: true,
        });

        // Load SAV File
        const fileName = 'test_survey.sav';
        const buffer = new ArrayBuffer(100);

        await useVelocityStore.getState().loadSAV(fileName, buffer);

        // Verify browserEngine.loadBuffer was called
        expect(mockEngineProxy.loadBuffer).toHaveBeenCalledWith(
            fileName,
            expect.any(ArrayBuffer),
            'sav',
        );

        // Assert final state
        const finalState = useVelocityStore.getState();
        expect(finalState.dataset).not.toBeNull();
        expect(finalState.dataset?.name).toBe(fileName);
        expect(finalState.dataset?.rowCount).toBe(500);
        expect(finalState.dataset?.variables).toHaveLength(variables.length);
        expect(finalState.variableSets).toHaveLength(variableSets.length);
    });
});
