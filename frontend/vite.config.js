/**
 * vite.config.js
 * ------------------------------------------------------------
 * Vite configuration for the React SPA. Defines the dev server
 * port and a proxy so API calls to /api hit the local backend
 * during development (avoids CORS issues in dev).
 *
 * Production build optimizations:
 *  - Manual chunk splitting for vendor libraries (React, Chart.js,
 *    Socket.IO, etc.) so the initial bundle is small and each
 *    vendor chunk is separately cacheable.
 *  - Route-based code splitting is handled by React.lazy in App.jsx.
 *  - Tree-shaking enabled for production.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const apiUrl = mode === 'development'
    ? (process.env.VITE_API_URL || 'http://localhost:5000')
    : (process.env.VITE_API_URL || '');
  return defineConfig({
    plugins: [react()],
    server: {
      port: 5173,
      proxy: apiUrl
        ? {
            '/api': {
              target: apiUrl,
              changeOrigin: true,
            },
          }
        : {},
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'socket-vendor': ['socket.io-client'],
            'chart-vendor': ['chart.js', 'react-chartjs-2'],
            'motion-vendor': ['framer-motion'],
            'i18n-vendor': ['i18next', 'react-i18next'],
            'axios-vendor': ['axios'],
            'exceljs-vendor': ['exceljs', 'jspdf', 'docx'],
            'ui-vendor': ['@heroicons/react', 'react-toastify', 'react-router-dom'],
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      commonjsOptions: {
        include: [/node_modules/],
      },
      target: 'es2022',
      minify: 'esbuild',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 500,
    },
  });
});
