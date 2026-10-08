import { defineConfig, devices } from '@playwright/test';

// Browser-level smoke tests (e2e/*.e2e.js). The unit suite is jsdom, so it cannot
// see a blank canvas, a thumbnail that never draws, or a page that dies on load;
// these run the production build in real Chromium and check exactly those things.
//
//   npm run build && npm run e2e
//
// They run against `vite preview` (what ships), not the dev server. WebGL is
// software-rendered, so frame rates mean nothing here: the tests assert that
// things appear and nothing throws, never how fast.
//
// Set CHROMIUM=/path/to/chrome to use an installed browser instead of
// Playwright's own (the same variable scripts/perf-worm uses).

const PORT = Number(process.env.E2E_PORT || 4173);
const base = `http://127.0.0.1:${PORT}/WORM-3/`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.js',
  // Software-rendered WebGL makes every click wait on slow frames, so these budgets are
  // generous on purpose: a test that needs more than four minutes is genuinely stuck.
  timeout: 240_000,
  expect: { timeout: 45_000 },
  // One browser at a time: software GL on a shared runner is what makes these slow,
  // and parallel workers would only make every test slower and flakier.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: base,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM || undefined,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    }
  },
  projects: [
    // Device pixel ratio 1 and modest viewports: the page is software-rendered, so pixels are the cost.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 700 }, deviceScaleFactor: 1 }, grepInvert: /@phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'], deviceScaleFactor: 1 }, grep: /@phone/ }
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
