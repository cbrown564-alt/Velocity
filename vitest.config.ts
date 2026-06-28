import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'mcp-server/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: false,
      exclude: [
        'node_modules/',
        'src/test/',
        // Test/spec files are scaffolding, not measured code — their un-called
        // helpers/factories otherwise pollute (especially function) coverage.
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'scripts/',
        'cli/',
        'docs/',
        'mcp-server/index.ts',
        'packages/readstat-wasm/dist/',
        'packages/readstat-wasm/scripts/',
        'packages/readstat-wasm/ts/index.ts',
        'playwright.config.ts',
        'vite.config.ts',
        'vitest.config.ts',
        '*.config.{js,cjs,mjs,ts}',
        'test_*.{js,mjs,ts}',
        'src/components/charts/',
        'src/components/overlays/',
        'src/engine/webr/',
        'src/core/export/chartBuilder.ts',
        'src/core/export/resolveThemeColors.ts',
        'src/core/export/types.ts',
        'src/features/',
        'src/hooks/',
        'src/services/EngineProxy.ts',
        'src/services/duckDbArrow.ts',
        'src/services/duckdbBundles.ts',
        // Store slices are being ratcheted into coverage one at a time as
        // characterization tests land. dataSlice.ts is fully covered and is
        // measured (not listed below); the rest stay excluded for now.
        'src/store/slices/index.ts',
        'src/store/slices/data/',
        'src/store/slices/analysisSlice.ts',
        'src/store/slices/drillDownSlice.ts',
        'src/store/slices/harmonizationSlice.ts',
        'src/store/slices/slidesSlice.ts',
        'src/store/slices/uiSlice.ts',
        'src/store/slices/webrSlice.ts',
        'src/store/slices/workspaceSlice.ts',
        '**/*.d.ts',
        'dist/',
      ],
      // Ratchet floor: set to true source coverage after excluding test files
      // (the previous 80% "pass" was inflated by measuring test files and was in
      // fact failing). Raise these as characterization tests land — never lower.
      thresholds: {
        branches: 79,
        functions: 78,
        lines: 80,
        statements: 80,
      },
    },
  },
});
