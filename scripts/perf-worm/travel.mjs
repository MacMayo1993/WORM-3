// Real tunnel ride on the production perf build. Unlike run.mjs's surface
// workload, this deliberately enters a raised portal. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || true];
}));
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
const server = await preview({ root, configFile: path.join(root, 'scripts/perf-worm/vite.perf.config.mjs'),
  preview: { host: '127.0.0.1', port: 4180 } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => { if (!/\.hdr/.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && /THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript({ path: path.join(root, 'scripts/perf-worm/instrument.js') });
  await page.addInitScript(draw => {
    window.__perf.noDraw = !draw; localStorage.setItem('worm3_mode_gate', 'gated');
    let seed = 71;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }, !!args.draw);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/WORM-3/?unlockall=1`);
  await page.getByRole('button', { name: 'Skip intro and enter game' }).click({ timeout: 60000 });
  await page.waitForFunction(() => window.__store);
  await page.evaluate(size => {
    const store = window.__store;
    // A PerformanceMonitor callback can still hold the old setter while React
    // commits the replacement. Guard the store too, so both builds keep one tier.
    store.subscribe(state => { if (state.perfReducedFX) store.setState({ perfReducedFX: false }); });
    store.setState({ showMainMenu: false, perfReducedFX: false, setPerfReducedFX: () => {} });
    store.getState().setSize(size);
    store.getState().initWormMode(9999, 0, .5, 10, 30, null, false, false, 1);
  }, +(args.size || 3));
  await page.waitForFunction(() => window.__wormSimRef?.current && window.__store.getState().wormStoryReady, null, { timeout: 60000 });
  const fixture = await page.evaluate(({ pairs, patterns }) => {
    const store = window.__store, size = store.getState().size, pos = window.__wormSimRef.current.pos;
    const { buildManifoldGridMap, flipStickerPair } = window.__perfTopology;
    let cubies = window.__perfMakeCubies(size);
    cubies = flipStickerPair(cubies, size, pos.x, pos.y, pos.z, pos.dirKey, buildManifoldGridMap(cubies, size));
    let pairCount = 1;
    for (let x = 0; x < size && pairCount < pairs; x++) for (let y = 0; y < size && pairCount < pairs; y++) {
      if (cubies[x][y][size - 1].stickers.PZ.flips) continue;
      cubies = flipStickerPair(cubies, size, x, y, size - 1, 'PZ', buildManifoldGridMap(cubies, size));
      pairCount++;
    }
    const settings = store.getState().settings;
    store.setState({ settings: patterns ? { ...settings, manifoldStyles: { 1: 'checkerboard', 2: 'circuit', 3: 'wood', 4: 'polkaDots', 5: 'solid', 6: 'circuit' } } : settings,
      cubies, wormStoryStarted: true, wormPaused: true, wormPowerups: [], wormSpecials: [],
      perfReducedFX: false, setPerfReducedFX: () => {} });
    return { size, pos, pairCount, patterns, seed: 71, reducedFX: false };
  }, { pairs: +(args.pairs || 1), patterns: !!args.patterns });
  if (fixture.size !== +(args.size || 3)) throw Error(`Wrong board size: ${fixture.size}`);
  await page.waitForTimeout(1000);
  const inpage = fs.readFileSync(path.join(root, 'scripts/perf-worm/inpage.js'), 'utf8');
  await page.evaluate(`(${inpage})()`);
  const start = await page.evaluate(() => {
    const sim = window.__wormSimRef.current, pos = sim.pos;
    window.__beginTunnelTransition(sim, window.__store.getState().size, window.__wormCtxRef.current,
      pos.x, pos.y, pos.z, pos.dirKey, true, true);
    window.__store.setState({ wormPaused: false });
    const W = window.__perf; W.attrib = true; W.frames = [];
    W.qualityTiers = new Set();
    W.sample = () => {
      W.qualityTiers.add(window.__store.getState().perfReducedFX);
      return window.__wormSimRef.current.phase;
    };
    return sim.phase;
  });
  if (start !== 'windup') throw Error(`Portal fixture did not enter: ${start}`);
  if (args.shots) {
    await page.evaluate(dpr => { window.__shotDpr = dpr; }, +(args['shot-dpr'] || 1));
    fs.mkdirSync(args.shots, { recursive: true });
    for (const [phase, progress] of [['entering', .6], ['tunnel', .5], ['exiting', .4]]) {
      await page.waitForFunction(([phase, p]) => {
        const sim = window.__wormSimRef.current; return sim.phase === phase && sim.tunnelProgress >= p;
      }, [phase, progress], { timeout: 60000 });
      await page.evaluate(() => { window.__store.setState({ wormPaused: true }); window.__perf.noDraw = false; window.__perf.roots.r3f.containerInfo.getState().setDpr(+(window.__shotDpr || 1)); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
      await page.screenshot({ path: path.join(args.shots, `${phase}.png`), timeout: 60000 });
      await page.evaluate(draw => { window.__perf.noDraw = !draw; window.__store.setState({ wormPaused: false }); }, !!args.draw);
    }
  } else {
    await page.waitForFunction(() => window.__wormSimRef.current.phase === 'crawling', null, { timeout: 60000 });
  }
  const result = await page.evaluate(() => ({ frames: window.__perf.frames, passes: window.__perf.passes, links: window.__perf.linkLog, qualityTiers: [...window.__perf.qualityTiers],
    alive: window.__store.getState().wormAlive, phase: window.__wormSimRef.current.phase }));
  const quantile = (rows, key, p) => rows.map(row => row[key]).sort((a, b) => a - b)[Math.floor(rows.length * p)];
  const phases = {};
  for (const phase of ['windup', 'entering', 'tunnel', 'exiting', 'windout']) {
    const rows = result.frames.filter(f => f.s === phase && f.cbs > 0);
    if (!rows.length && !args.shots) throw Error(`No measured frames for ${phase}`);
    if (!rows.length) continue;
    phases[phase] = { frames: rows.length, scriptMsP50: quantile(rows, 'script', .5), scriptMsP95: quantile(rows, 'script', .95),
      drawsP50: quantile(rows, 'draw', .5), trianglesP50: quantile(rows, 'tris', .5),
      shaderLinks: rows.reduce((n, f) => n + f.link, 0) };
  }
  if (errors.length) throw Error(errors.join('\n'));
  if (!result.alive) throw Error('Worm died in the ride fixture');
  if (result.qualityTiers.length !== 1 || result.qualityTiers[0] !== false) throw Error('Adaptive FX changed during measurement');
  const output = { fixture, draws: args.draw ? 'real' : 'suppressed', screenshotRun: !!args.shots, phases, ...result };
  fs.writeFileSync(args.out || '/tmp/worm-travel.json', JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ fixture, phases, passes: result.passes }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
