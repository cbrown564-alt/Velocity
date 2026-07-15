import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

export default defineConfig(() => ({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@velocity/readstat-wasm': path.resolve(__dirname, 'packages/readstat-wasm/ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@velocity/readstat-wasm'],
    // These dependencies are first executed inside the analysis worker. If
    // Vite discovers them only after the first upload intent, a cold dev server
    // performs a full-page dependency-optimizer reload and destroys the
    // in-flight worker. CI always starts cold, so keep this list explicit.
    include: ['@duckdb/duckdb-wasm', 'apache-arrow'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) {
            return 'runtime-vendor';
          }

          if (!id.includes('node_modules')) return;

          if (id.includes('@duckdb/') || id.includes('apache-arrow')) {
            return 'duckdb-vendor';
          }
          if (id.includes('pptxgenjs') || id.includes('exceljs')) {
            return 'export-vendor';
          }
          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }
          if (id.includes('@dnd-kit/')) {
            return 'dnd-vendor';
          }
          if (id.includes('d3-')) {
            return 'd3-vendor';
          }
          if (id.includes('react') || id.includes('zustand') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
}));
