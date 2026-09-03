import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // The daily challenge's par is a proven optimum from an exhaustive search
    // (levels/parSolver.js), so a handful of tests legitimately spend seconds
    // rather than milliseconds. The 5s default left them a hair of headroom on a
    // developer machine and none on a slower CI runner, where they timed out
    // while testing nothing but their own patience.
    testTimeout: 30000,
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
