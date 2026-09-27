// Production build for scripts/perf-worm/run.mjs: the deployed config, unminified
// (function names survive into CPU profiles; React stays in production mode) and
// with the game store exposed as window.__store so the runner can read phases.
// Never used by the deploy: build with
//   npx vite build --config scripts/perf-worm/vite.perf.config.mjs
//   npx vite preview --config scripts/perf-worm/vite.perf.config.mjs --port 4173
import base from '../../vite.config.js';

export default {
  ...base,
  plugins: [
    ...base.plugins,
    {
      name: 'perf-expose-store',
      transform(code, id) {
        if (!id.endsWith('/src/hooks/useGameStore.js')) return null;
        return `${code}\nif (typeof window !== 'undefined') window.__store = useGameStore;\n`;
      }
    }
  ],
  build: { ...base.build, outDir: 'dist-perf', emptyOutDir: true, minify: false }
};
