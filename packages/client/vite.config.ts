import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev proxies /api + /ws to the Fastify server (same-origin in prod via Caddy).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Split Three.js into its own long-cached chunk — it dominates the bundle and rarely
    // changes, so the app chunk stays small and cache-fresh across deploys (perf pass §4).
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
