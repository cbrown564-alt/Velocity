import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVelocityStore } from '../../index';
import type { VariableStatsResult } from '../../../types/worker';

const mockStats: VariableStatsResult = {
    column: 'v1',
    frequencies: [{ value: 1, count: 50 }],
    totalCount: 100,
    missingCount: 0,
};

const mockEnvelope = (data: VariableStatsResult) => ({
    data,
    operation: 'getVariableStats',
    inputs: {},
    durationMs: 1,
    warnings: [],
    metadata: {},
});

describe('variableCatalogActions.getVariableStats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useVelocityStore.getState().reset();
    });

    it('calls browserEngine.runAnalysis with variable metadata', async () => {
        const runAnalysis = vi.fn().mockResolvedValue(mockEnvelope(mockStats));
        const missingValues = { discrete: [99] };

        useVelocityStore.setState({
            browserEngine: { runAnalysis } as never,
            dataset: {
                id: 'ds-1',
                name: 'test.sav',
                rowCount: 100,
                source: 'sav',
                variables: [{
                    id: 'v1',
                    name: 'Q1',
                    label: 'Question 1',
                    type: 'ordered',
                    orderedScoring: 'allow_numeric_stats',
                    valueLabels: [],
                    missingValues,
                }],
            },
        });

        const result = await useVelocityStore.getState().getVariableStats('v1');

        expect(runAnalysis).toHaveBeenCalledWith('variableStats', {
            column: 'v1',
            variableType: 'ordered',
            orderedScoring: 'allow_numeric_stats',
            missingValues,
        });
        expect(result).toEqual(mockStats);
        expect(useVelocityStore.getState().variableStats.v1).toEqual(mockStats);
        expect(useVelocityStore.getState().variableStatsLoading.v1).toBe(false);
    });

    it('returns cached stats without calling runAnalysis', async () => {
        const runAnalysis = vi.fn().mockResolvedValue(mockEnvelope(mockStats));

        useVelocityStore.setState({
            browserEngine: { runAnalysis } as never,
            dataset: {
                id: 'ds-1',
                name: 'test.sav',
                rowCount: 100,
                source: 'sav',
                variables: [{
                    id: 'v1',
                    name: 'Q1',
                    label: 'Question 1',
                    type: 'nominal',
                    valueLabels: [],
                    missingValues: {},
                }],
            },
            variableStats: { v1: mockStats },
        });

        const result = await useVelocityStore.getState().getVariableStats('v1');

        expect(runAnalysis).not.toHaveBeenCalled();
        expect(result).toEqual(mockStats);
    });

    it('returns null while a fetch is already in progress', async () => {
        const runAnalysis = vi.fn().mockImplementation(
            () => new Promise(() => { /* never resolves */ }),
        );

        useVelocityStore.setState({
            browserEngine: { runAnalysis } as never,
            variableStats: {},
            dataset: {
                id: 'ds-1',
                name: 'test.sav',
                rowCount: 100,
                source: 'sav',
                variables: [{
                    id: 'v1',
                    name: 'Q1',
                    label: 'Question 1',
                    type: 'nominal',
                    valueLabels: [],
                    missingValues: {},
                }],
            },
            variableStatsLoading: { v1: true },
        });

        const result = await useVelocityStore.getState().getVariableStats('v1');

        expect(result).toBeNull();
        expect(runAnalysis).not.toHaveBeenCalled();
    });
});
