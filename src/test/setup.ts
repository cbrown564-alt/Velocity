/**
 * Vitest Global Test Setup
 * 
 * Configures test environment, mocks, and global utilities.
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test for React Testing Library
afterEach(() => {
    cleanup();
});

// Mock Web Worker globally for Node environment
// Mock Web Worker globally for Node environment
class MockWorker extends EventTarget implements Worker {
    onmessage: ((this: Worker, event: MessageEvent) => any) | null = null;
    onmessageerror: ((this: Worker, event: MessageEvent) => any) | null = null;
    onerror: ((this: Worker, event: ErrorEvent) => any) | null = null;

    constructor(public url: string | URL) {
        super();
    }

    postMessage(data: any, transfer: Transferable[]): void;
    postMessage(data: any, options?: StructuredSerializeOptions): void;
    postMessage(data: any): void {
        // In tests, we'll mock specific worker behavior
        console.log('[MockWorker] postMessage:', data);
    }

    terminate() {
        // Cleanup
    }

    // Helper to simulate receiving a message from the worker
    // This calls the onmessage property AND dispatches the event
    dispatchMessage(data: any) {
        const event = new MessageEvent('message', { data });
        if (this.onmessage) {
            this.onmessage.call(this, event);
        }
        this.dispatchEvent(event);
    }
}

// Only mock if not in browser
if (typeof Worker === 'undefined') {
    vi.stubGlobal('Worker', MockWorker);
}

// Mock URL.createObjectURL for worker blob URLs
if (typeof URL.createObjectURL === 'undefined') {
    vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
    });
}
