import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@velocity/readstat-wasm': path.resolve(__dirname, 'packages/readstat-wasm/ts'),
      }
    },
    optimizeDeps: {
      exclude: ['@velocity/readstat-wasm', 'webr'],
      include: [
        '@uwdata/vgplot',
        '@uwdata/mosaic-core',
        '@uwdata/mosaic-plot',
        '@uwdata/mosaic-sql',
      ]
    },
    worker: {
      format: 'es'
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
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
            if (id.includes('webr')) {
              return 'webr-vendor';
            }
            if (id.includes('react') || id.includes('zustand') || id.includes('lucide-react')) {
              return 'ui-vendor';
            }
          },
        },
      },
    },
  };
});
