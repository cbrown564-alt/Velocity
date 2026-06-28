import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config for Stryker mutation testing on src/core/.
 * Keeps path aliases aligned with vite.config.ts and limits the test pool
 * to suites that exercise portable core logic (co-located + golden/parity).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@velocity/readstat-wasm': path.resolve(__dirname, 'packages/readstat-wasm/ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/core/**/*.test.{ts,tsx}', 'tests/golden/**/*.test.ts', 'tests/parity/**/*.test.ts'],
    pool: 'threads',
  },
});
