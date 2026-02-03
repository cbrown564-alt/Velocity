
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';
import type { WorkerRequest, WorkerResponse } from '../../types/worker';
import { mockDataset } from '../fixtures/variables';

// Mock the global Worker if setup.ts hasn't already (it has, but we want to control it closely)
// We rely on the store exposing the worker instance to interact with it.

describe('Integration: SAV Ingestion Flow', () => {

    beforeEach(() => {
        useVelocityStore.setState({
            worker: null,
            dataset: null,
            variableSets: [],
            isDbReady: false,
            // Reset other slices if needed
        });
        vi.clearAllMocks();
    });

    it('should initialize worker, send SAV buffer, and update store on success', async () => {
        const store = useVelocityStore.getState();

        // 1. Initialize Worker
        // Create a promise to wait for the init message
        const initPromise = store.initWorker();

        const worker = useVelocityStore.getState().worker;
        expect(worker).toBeTruthy();

        // Mock the postMessage to intercept calls
        const postMessageSpy = vi.spyOn(worker!, 'postMessage');

        // Simulate 'ready' response from worker
        // We need to wait for the store to attach the event listener, which happens in initWorker
        // Since initWorker awaits the 'ready' message, we must simulate it asynchronously

        // Manually trigger the message event on the worker instance
        // accessing the onmessage handler that the store attached
        // The store uses addEventListener, so 'onmessage' property might be null if strictly using addEventListener
        // 'happy-dom' or 'jsdom' usually supports dispatchEvent.

        // Let's rely on the fact that our setup.ts MockWorker might use a simple property or we need to dispatch a MessageEvent.
        // If setup.ts uses a class with connection to addEventListener, we can DispatchEvent.

        setTimeout(() => {
            const readyEvent = new MessageEvent('message', {
                data: { type: 'ready', opfsAvailable: false } as WorkerResponse
            });
            worker!.dispatchEvent(readyEvent);
        }, 10);

        await initPromise;

        expect(useVelocityStore.getState().isDbReady).toBe(true);

        // 2. Load SAV File
        const fileName = 'test_survey.sav';
        const buffer = new ArrayBuffer(100);

        // Start the load action
        const loadPromise = useVelocityStore.getState().loadSAV(fileName, buffer);

        // Verify postMessage was called with correct data (includes transfer list as second arg)
        expect(postMessageSpy).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: 'loadSAV',
                buffer: buffer
            }),
            [buffer]
        );

        // 3. Simulate Worker Processing & Response
        const variables = mockDataset.variables;
        const variableSets = mockDataset.variables.map(v => ({
            id: v.id,
            name: v.label,
            variableIds: [v.id],
            structure: 'single' as const,
            type: v.type
        }));

        const responseData: WorkerResponse = {
            type: 'savLoaded',
            variables,
            variableSets,
            rowCount: 500,
            durationMs: 125
        };

        const loadEvent = new MessageEvent('message', {
            data: responseData
        });

        // Dispatch response
        worker!.dispatchEvent(loadEvent);

        // 4. Await completion and Assert State
        await loadPromise;

        const finalState = useVelocityStore.getState();

        expect(finalState.dataset).not.toBeNull();
        expect(finalState.dataset?.name).toBe(fileName);
        expect(finalState.dataset?.rowCount).toBe(500);
        expect(finalState.dataset?.variables).toHaveLength(variables.length);
        expect(finalState.variableSets).toHaveLength(variableSets.length);
    });
});
