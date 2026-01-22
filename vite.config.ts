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
      exclude: ['@velocity/readstat-wasm'],
      include: [
        '@uwdata/vgplot',
        '@uwdata/mosaic-core',
        '@uwdata/mosaic-plot',
        '@uwdata/mosaic-sql',
      ]
    },
    worker: {
      format: 'es'
    }
  };
});
