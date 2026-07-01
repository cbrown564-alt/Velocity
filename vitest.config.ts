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
        // STAB-CI-6: overlays/ stays excluded — tested modals still ~33% function coverage;
        // ConfirmModal.test.tsx + InputModal.test.tsx added for next ratchet step.
        'src/components/overlays/',
        'src/engine/webr/',
        'src/core/export/chartBuilder.ts',
        'src/core/export/resolveThemeColors.ts',
        'src/core/export/types.ts',
        // STAB-CI-6: features/ stays excluded — full removal drops all metrics below thresholds;
        // partial lib/onboarding inclusion also misses function threshold (81.12%).
        'src/features/',
        'src/hooks/',
        'src/services/EngineProxy.ts',
        'src/services/duckDbArrow.ts',
        'src/services/duckdbBundles.ts',
        // STAB-CI-6 ratchet: harmonizationSlice + uiSlice removed from exclusions
        // (characterization tests in harmonizationSlice.test.ts, uiSlice.focusMode.test.ts).
        // data/ submodules without tests stay excluded; variableCatalogActions.ts is measured.
        'src/store/slices/data/datasetActions.ts',
        'src/store/slices/data/engineActions.ts',
        'src/store/slices/data/transformActions.ts',
        'src/store/slices/data/persistenceActions.ts',
        'src/store/slices/data/loadProgress.ts',
        'src/store/slices/data/variableNormalization.ts',
        'src/store/slices/data/index.ts',
        'src/store/slices/index.ts',
        'src/store/slices/analysisSlice.ts',
        'src/store/slices/drillDownSlice.ts',
        'src/store/slices/slidesSlice.ts',
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
        functions: 82,
        lines: 81,
        statements: 81,
      },
    },
  },
});
