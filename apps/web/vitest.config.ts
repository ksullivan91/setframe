/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    /* `e2e/` belongs to Playwright (story 67). Vitest would otherwise collect
       those specs, fail to resolve `@playwright/test`, and report the whole
       suite red for a reason unrelated to any component. */
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
