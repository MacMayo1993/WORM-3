import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // src/hooks/** is in scope deliberately: it is the orchestration layer
      // between the pure game logic and React, and every correctness bug found
      // in the 2026-08-12 review lived there while the suite stayed green —
      // precisely because the report could not see it.
      include: ['src/game/**/*.js', 'src/utils/**/*.js', 'src/levels/**/*.js', 'src/hooks/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/**/*.spec.js'],
    },
  },
});
