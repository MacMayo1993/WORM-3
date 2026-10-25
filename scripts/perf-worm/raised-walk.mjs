// Browser check: jump onto the raised piece straight ahead and crawl on over the cube
// edge onto its pad. The worm must stay on top of the piece. See README.md.
import path from 'node:path';
import { preview } from 'vite';
const root = '/home/user/WORM-3';
const { getNextSurfacePosition } = await import(`${root}/src/worm/wormLogic.js`);
const { cubieCenterInto } = await import(`${root}/src/game/cubeWorldGeometry.js`);
const { raisedWormExpansion } = await import(`${root}/src/game/raisedCubie.js`);
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const size = +(args.size || 3), shots = args.shots;
const { chromium } = await import(process.env.PLAYWRIGHT);
const server = await preview({ root, configFile: path.join(root, 'scripts/perf-worm/vite.perf.config.mjs'), preview: { host: '127.0.0.1', port: 4181 + size } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', e => { if (!/\.hdr/.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && /WebGLProgram|shader error|Error/i.test(m.text()) && !/hdr|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript({ path: path.join(root, 'scripts/perf-worm/instrument.js') });
  await page.addInitScript(() => { localStorage.setItem('worm3_mode_gate', 'gated'); let seed = 71;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/WORM-3/?unlockall=1`);
  await page.getByRole('button', { name: 'Skip intro and enter game' }).click({ timeout: 60000 });
  await page.waitForFunction(() => window.__store);
  await page.evaluate(size => {
    const store = window.__store;
    store.setState({ showMainMenu: false });
    store.getState().setSize(size);
    store.getState().initWormMode(9999, 0, .5, 10, 30, null, false, false, 1);
  }, size);
  await page.waitForFunction(() => window.__wormSimRef?.current && window.__store.getState().wormStoryReady, null, { timeout: 60000 });
  const { pos, moveDir } = await page.evaluate(() => { const s = window.__wormSimRef.current; return { pos: { ...s.pos }, moveDir: s.moveDir }; });
  const ahead = getNextSurfacePosition(pos, moveDir, size);
  const target = { x: ahead.x, y: ahead.y, z: ahead.z, dirKey: ahead.dirKey };
  // Flip the piece's face over the cube edge straight ahead, so the landing face is an
  // ordinary platform (no dive) and walking on steps over the edge onto the pad.
  const over = getNextSurfacePosition(target, ahead.moveDir ?? moveDir, size);
  if (over.x !== target.x || over.y !== target.y || over.z !== target.z) throw Error('The piece ahead has no face over the edge; pick another start');
  const pad = { x: over.x, y: over.y, z: over.z, dirKey: over.dirKey };
  await page.evaluate(({ size, pad }) => {
    const store = window.__store;
    const { buildManifoldGridMap, flipStickerPair } = window.__perfTopology;
    let cubies = window.__perfMakeCubies(size);
    cubies = flipStickerPair(cubies, size, pad.x, pad.y, pad.z, pad.dirKey, buildManifoldGridMap(cubies, size));
    store.setState({ cubies, wormStoryStarted: true, wormPaused: true, wormPowerups: [], wormSpecials: [], wormGamePhase: 'active' });
    window.__perf.noDraw = true;
  }, { size, pad });
  await page.waitForTimeout(1500);
  const samples = await page.evaluate(async () => {
    const sim = window.__wormSimRef.current, out = [];
    window.__store.setState({ wormPaused: false });
    window.__queueWormTurn(sim, 'jump');
    const t0 = performance.now();
    while (performance.now() - t0 < 120000 && out.length < 1500) {
      await new Promise(r => requestAnimationFrame(r));
      const h = sim.headInterpPos;
      out.push({ t: Math.round(performance.now() - t0), pos: `${sim.pos.x}${sim.pos.y}${sim.pos.z}${sim.pos.dirKey}`, raised: sim.onRaisedPlatform, dep: sim.raisedDeparture,
        flight: !!sim.padFlight, phase: sim.phase, rescue: !!sim.cautionRescue, alive: sim.alive, h: [h.x, h.y, h.z] });
      if (!sim.alive || sim.cautionRescue) break;
      // Stop part-way over the edge onto the pad face, for the screenshot.
      if (out.at(-1).raised && out.at(-1).pos.slice(3) !== out[0].pos.slice(3) && sim.interpT > 0.6) { window.__store.setState({ wormPaused: true }); break; }
    }
    return out;
  });
  if (shots) {
    await page.evaluate(() => { window.__perf.noDraw = false; });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.screenshot({ path: `${shots}/raised-edge-${size}.png`, timeout: 120000 });
  }
  const c = cubieCenterInto([0, 0, 0], target.x, target.y, target.z, size, raisedWormExpansion(0, size));
  const inside = samples.filter(s => s.phase === 'crawling' && !s.flight && s.h.every((v, i) => Math.abs(v - c[i]) < 0.49));
  const route = []; for (const s of samples) { const k = `${s.pos}${s.raised ? '·raised' : ''}${s.flight ? '·flight' : ''}${s.dep ? '·off' : ''}`; if (route.at(-1) !== k) route.push(k); }
  console.log(JSON.stringify({ size, start: pos, moveDir, target, pad, frames: samples.length, insidePieceFrames: inside.length, last: samples.at(-1), route, errors }, null, 1));
} finally { await browser?.close(); await new Promise(r => server.httpServer.close(r)); }
