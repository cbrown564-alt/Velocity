
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';
import type { WorkerRequest, WorkerResponse } from '../../types/worker';
import { mockDataset, mockNominalVariable } from '../fixtures/variables';

describe('Integration: Store <-> Worker Analysis Flow', () => {

    beforeEach(() => {
        useVelocityStore.setState({
            worker: null,
            dataset: null,
            variableSets: [],
            isDbReady: false,
            queryResult: [],
            isQuerying: false,
            tableConfig: { rowVars: [], colVar: null }
        });
        vi.clearAllMocks();
    });

    it('should trigger runCrosstab and update results when TableConfig changes', async () => {
        // 1. Setup: Init Worker and Load Fake Data
        // We'll skip the real init handshake and just set the worker directly 
        // because we are testing the Analysis flow, not Init again.

        // However, the worker has to be a valid EventTarget for dispatchEvent to work
        const mockWorker = new Worker('mock key');
        useVelocityStore.setState({
            worker: mockWorker,
            dataset: mockDataset,
            variableSets: [{
                id: mockNominalVariable.id,
                name: mockNominalVariable.label,
                variableIds: [mockNominalVariable.id],
                structure: 'single',
                type: 'nominal'
            }]
        });

        const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

        // 2. Action: Set Table Config
        // This should trigger runAnalysis() automatically due to the slice implementation invoking get().runAnalysis()
        useVelocityStore.getState().setTableConfig({
            rowVars: [mockNominalVariable.id],
            colVar: null
        });

        // 3. Verify Request
        // Wait for potential async state updates, though setTableConfig calls runAnalysis synchronously-ish (it's async void)
        // runAnalysis is async, so we might need a microtask wait if we want to catch the "isQuerying" state before it finishes?
        // But we are spying on postMessage.

        expect(useVelocityStore.getState().isQuerying).toBe(true);
        expect(postMessageSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'runCrosstab',
            options: expect.objectContaining({
                rowVars: [mockNominalVariable.id]
            }),
            analysisSettings: expect.objectContaining({
                comparisonMethod: 'cell_vs_rest',
                correctionType: 'none',
                significanceLevel: 0.95,
            }),
        }));

        // 4. Simulate Response
        const mockResult = [
            {
                rowKey_0: 'Male',
                colKey: 'Total',
                count: 50,
                percentage: 50,
                validCount: 50
            },
            {
                rowKey_0: 'Female',
                colKey: 'Total',
                count: 50,
                percentage: 50,
                validCount: 50
            }
        ];

        const responseEvent = new MessageEvent('message', {
            data: {
                type: 'queryResult',
                requestId: postMessageSpy.mock.calls[postMessageSpy.mock.calls.length - 1][0].requestId,
                data: mockResult,
                durationMs: 50
            } as WorkerResponse
        });

        // We need to await the promise that runAnalysis created. 
        // But runAnalysis returns void (Promise<void>), and we didn't capture that promise.
        // However, the store relies on the 'message' event to resolve.

        mockWorker.dispatchEvent(responseEvent);

        // Wait for state update (dispatchEvent is synchronous, but the react/zustand update might be batched? No, vanilla zustand is sync usually)
        // But runAnalysis awaits the promise inside.

        // We need to wait for the event loop to turn so runAnalysis execution continues after await initPromise
        await new Promise(resolve => setTimeout(resolve, 0));

        // 5. Assert Final State
        const finalState = useVelocityStore.getState();
        expect(finalState.isQuerying).toBe(false);
        expect(finalState.queryResult).toHaveLength(2);
        expect(finalState.queryResult[0]).toEqual(expect.objectContaining({
            rowKeys: ['Male'],
            count: 50
        }));
    });
});
