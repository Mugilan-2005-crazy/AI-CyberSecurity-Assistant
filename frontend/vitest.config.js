import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
    mockReset: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules/', 'src/main.jsx', 'src/App.jsx', 'src/i18n/**'],
    },
    include: ['src/tests/**/*.test.jsx', 'src/tests/**/*.test.js'],
    exclude: ['node_modules/', 'dist/'],
  },
});
