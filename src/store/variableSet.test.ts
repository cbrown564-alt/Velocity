import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVelocityStore } from './index';

// Mock the worker since we are testing store logic
vi.mock('../services/analysisWorker', () => ({
    default: class MockWorker {
        postMessage() { }
        addEventListener() { }
        removeEventListener() { }
    }
}));

// Mock worker in store
const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

global.Worker = class MockWorker {
    postMessage = mockPostMessage;
    addEventListener = mockAddEventListener;
    removeEventListener = mockRemoveEventListener;
    terminate() { }
    onmessage = null;
    onerror = null;
    dispatchEvent() { return true; }
} as any;


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
                    { id: 'v3', name: 'Q3', label: 'Question 3', type: 'scale', valueLabels: [], missingValues: {} }
                ],
                source: 'sav'
            },
            variableSets: [
                { id: 's1', name: 'Question 1', variableIds: ['v1'], structure: 'single', type: 'nominal' },
                { id: 's2', name: 'Question 2', variableIds: ['v2'], structure: 'single', type: 'nominal' },
                { id: 's3', name: 'Question 3', variableIds: ['v3'], structure: 'single', type: 'scale' }
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
        // We need to initialize worker for this test as recodeVariable checks it
        await useVelocityStore.getState().initWorker();

        const { recodeVariable } = useVelocityStore.getState();

        // Determine the promise we want to intercept, but recodeVariable waits for worker response.
        // We'll mimic worker response. 
        // However, since we can't easily trigger the worker's onmessage from here without complexity,
        // we'll mainly check if postMessage was called with correct data.

        // We start the promise but don't await it strictly or we'll hang, unless we fire the event back.
        const promise = recodeVariable('v3', 'v3_binned', {
            mode: 'binning',
            rules: [{ min: 0, max: 10, label: 'Low' }]
        });

        // Simulate worker response
        const handler = mockAddEventListener.mock.calls.find(call => call[0] === 'message')[1];
        handler({ data: { type: 'recodeComplete', newColName: 'v3_binned' } });

        await promise;

        // Check postMessage calls
        // 1st was init, 2nd should be recode
        const calls = mockPostMessage.mock.calls;
        const recodeCall = calls.find(c => c[0].type === 'recodeVariable');
        expect(recodeCall).toBeDefined();
        expect(recodeCall[0].config.mode).toBe('binning');
        expect(recodeCall[0].config.rules[0].label).toBe('Low');
    });
});
