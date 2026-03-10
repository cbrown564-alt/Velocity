
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';
import { mockDataset } from '../fixtures/variables';

describe('Integration: SAV Ingestion Flow', () => {

    beforeEach(() => {
        useVelocityStore.setState({
            worker: null,
            engineProxy: null,
            dataset: null,
            variableSets: [],
            isDbReady: false,
        });
        vi.clearAllMocks();
    });

    it('should load SAV via engineProxy and update store on success', async () => {
        const variables = mockDataset.variables;
        const variableSets = mockDataset.variables.map(v => ({
            id: v.id,
            name: v.label,
            variableIds: [v.id],
            structure: 'single' as const,
            type: v.type
        }));

        // Mock engineProxy with loadSAV returning expected response
        const mockEngineProxy = {
            loadSAV: vi.fn().mockResolvedValue({
                type: 'engine.savLoaded',
                variables,
                variableSets,
                rowCount: 500,
                durationMs: 125,
            }),
            checkPersistedData: vi.fn().mockResolvedValue({ type: 'engine.noPersistedData' }),
            init: vi.fn().mockResolvedValue({ opfsAvailable: false }),
            updatePersistenceMetadata: vi.fn(),
        } as any;

        useVelocityStore.setState({
            engineProxy: mockEngineProxy,
            isDbReady: true,
        });

        // Load SAV File
        const fileName = 'test_survey.sav';
        const buffer = new ArrayBuffer(100);

        await useVelocityStore.getState().loadSAV(fileName, buffer);

        // Verify engineProxy.loadSAV was called
        expect(mockEngineProxy.loadSAV).toHaveBeenCalledWith(buffer);

        // Assert final state
        const finalState = useVelocityStore.getState();
        expect(finalState.dataset).not.toBeNull();
        expect(finalState.dataset?.name).toBe(fileName);
        expect(finalState.dataset?.rowCount).toBe(500);
        expect(finalState.dataset?.variables).toHaveLength(variables.length);
        expect(finalState.variableSets).toHaveLength(variableSets.length);
    });
});
