/**
 * vite.config.js
 * ------------------------------------------------------------
 * Vite configuration for the React SPA. Defines the dev server
 * port and a proxy so API calls to /api hit the local backend
 * during development (avoids CORS issues in dev).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
