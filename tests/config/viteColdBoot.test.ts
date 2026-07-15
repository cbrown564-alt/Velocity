import { describe, expect, it } from 'vitest';
import createViteConfig from '../../vite.config';

describe('Vite cold worker boot contract', () => {
  it('pre-optimizes worker-only DuckDB dependencies before the first engine intent', () => {
    const config = createViteConfig({
      command: 'serve',
      mode: 'test',
      isSsrBuild: false,
      isPreview: false,
    });

    expect(config.optimizeDeps?.include).toEqual(expect.arrayContaining(['@duckdb/duckdb-wasm', 'apache-arrow']));
  });
});
