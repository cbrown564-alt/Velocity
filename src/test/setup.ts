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
class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;

    constructor(public url: string) { }

    postMessage(data: unknown) {
        // In tests, we'll mock specific worker behavior
        console.log('[MockWorker] postMessage:', data);
    }

    terminate() {
        // Cleanup
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
