import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVelocityStore } from './index';

describe('Variable Logic', () => {
    beforeEach(() => {
        useVelocityStore.getState().reset();
        useVelocityStore.setState({
            dataset: {
                id: 'test-dataset',
                name: 'test.sav',
                rowCount: 100,
                variables: [
                    { id: 'v1', name: 'Q1', label: 'Question 1', type: 'nominal', valueLabels: [], missingValues: {} },
                    { id: 'v2', name: 'Q2', label: 'Question 2', type: 'nominal', valueLabels: [], missingValues: {} },
                    { id: 'v3', name: 'Q3', label: 'Question 3', type: 'numeric', valueLabels: [], missingValues: {} }
                ],
                source: 'sav'
            },
            variableSets: [
                { id: 's1', name: 'Question 1', variableIds: ['v1'], structure: 'single', type: 'nominal' },
                { id: 's2', name: 'Question 2', variableIds: ['v2'], structure: 'single', type: 'nominal' },
                { id: 's3', name: 'Question 3', variableIds: ['v3'], structure: 'single', type: 'numeric' }
            ]
        });
        vi.clearAllMocks();
    });

    it('should create a combined variable set', () => {
        const { createVariableSet } = useVelocityStore.getState();
        const initialSetsLength = useVelocityStore.getState().variableSets.length;

        createVariableSet('Combined Set', ['v1', 'v2']);

        const { variableSets } = useVelocityStore.getState();
        expect(variableSets.length).toBe(initialSetsLength - 1); // 3 - 2 + 1 = 2

        const newSet = variableSets.find(s => s.name === 'Combined Set');
        expect(newSet).toBeDefined();
        expect(newSet?.variableIds).toEqual(['v1', 'v2']);
        expect(newSet?.structure).toBe('multiple');
    });

    it('should dispatch recodeVariable action correctly for binning', async () => {
        // Mock browserEngine
        const mockRecodeVariable = vi.fn().mockResolvedValue({ newColName: 'v3_binned' });
        const mockEngineProxy = {
            recodeVariable: mockRecodeVariable,
            init: vi.fn().mockResolvedValue({ opfsAvailable: false }),
            checkPersistedData: vi.fn().mockResolvedValue({ type: 'engine.noPersistedData' }),
            updatePersistenceMetadata: vi.fn(),
        } as any;

        useVelocityStore.setState({
            browserEngine: mockEngineProxy,
            isDbReady: true,
        });

        const { recodeVariable } = useVelocityStore.getState();

        await recodeVariable('v3', 'v3_binned', {
            mode: 'binning',
            rules: [{ min: 0, max: 10, label: 'Low' }]
        });

        // Check that browserEngine.recodeVariable was called with correct args
        expect(mockRecodeVariable).toHaveBeenCalledWith(
            'v3',
            'v3_binned',
            expect.objectContaining({
                mode: 'binning',
                rules: [{ min: 0, max: 10, label: 'Low' }],
            })
        );
    });
});
