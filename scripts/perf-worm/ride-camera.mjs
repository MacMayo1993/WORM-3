// Films the camera through a real tunnel ride: per frame it records the sim
// phase and progress, the lens pose, the head and the frame's CPU cost, then
// reports the frames where the lens jumps (position or direction), rolls, or
// loses the head. See README.md ("Tunnel ride camera trace").
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
  preview: { host: '127.0.0.1', port: 4181 } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, ...(args.mobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {}) });
  const errors = [];
  page.on('pageerror', e => { if (!/\.hdr/.test(e.message)) errors.push(e.message); });
  await page.addInitScript({ path: path.join(root, 'scripts/perf-worm/instrument.js') });
  await page.addInitScript(() => {
    window.__perf.noDraw = true; localStorage.setItem('worm3_mode_gate', 'gated');
    let seed = 71;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/WORM-3/?unlockall=1`);
  await page.getByRole('button', { name: 'Skip intro and enter game' }).click({ timeout: 60000 });
  await page.waitForFunction(() => window.__store);
  await page.evaluate(size => {
    const store = window.__store;
    store.setState({ showMainMenu: false });
    store.getState().setSize(size);
    store.getState().initWormMode(9999, 0, .5, 10, 30, null, false, false, 1);
  }, +(args.size || 5));
  // Ride only once the run is live, so the scramble's own warm-up is not counted.
  await page.waitForFunction(() => window.__wormSimRef?.current && window.__store.getState().wormGamePhase === 'active', null, { timeout: 120000 });
  await page.evaluate(() => {
    const store = window.__store, size = store.getState().size, sim = window.__wormSimRef.current, pos = sim.pos;
    const { buildManifoldGridMap, flipStickerPair } = window.__perfTopology;
    let cubies = window.__perfMakeCubies(size);
    cubies = flipStickerPair(cubies, size, pos.x, pos.y, pos.z, pos.dirKey, buildManifoldGridMap(cubies, size));
    store.setState({ cubies, wormStoryStarted: true, wormPaused: true, wormPowerups: [], wormSpecials: [] });
  });
  await page.waitForTimeout(2500);
  if (args.attrib) {
    await page.evaluate(`(${fs.readFileSync(path.join(root, 'scripts/perf-worm/inpage.js'), 'utf8')})()`);
    await page.evaluate(() => {
      window.__perfAttrib = true;
      const gl = window.__perf.gl, compile = gl.compile;
      window.__compiles = [];
      gl.compile = function (...a) {
        const t0 = performance.now(), out = compile.apply(this, a);
        window.__compiles.push({ phase: window.__wormSimRef.current.phase, ms: +(performance.now() - t0).toFixed(1),
          rt: !!gl.getRenderTarget(), stack: new Error().stack.split('\n').slice(2, 6).map(l => l.trim()).join(' < ') });
        return out;
      };
    });
  }
  await page.evaluate(() => {
    const sim = window.__wormSimRef.current, pos = sim.pos;
    const camera = window.__perf.roots.r3f.containerInfo.getState().camera;
    window.__beginTunnelTransition(sim, window.__store.getState().size, window.__wormCtxRef.current,
      pos.x, pos.y, pos.z, pos.dirKey, true, true);
    window.__store.setState({ wormPaused: false });
    const W = window.__perf; W.frames = []; W.linkLog = [];
    if (window.__perfAttrib) W.attrib = true;
    const st = window.__perf.roots.r3f.containerInfo.getState();
    W.keys = [];
    W.sample = () => {
      const g = st.gl, sc = st.scene, z = window.__store.getState();
      const key = [sc.environment?.uuid, sc.environment?.version, sc.fog ? 'f' : 'none', g.shadowMap.enabled, g.shadowMap.type, z.perfReducedFX, z.wormCharacter, z.wormSkin, g.toneMapping, g.outputColorSpace].join('|');
      if (W.keys.at(-1)?.key !== key) W.keys.push({ key, phase: window.__wormSimRef.current.phase });
      const s = window.__wormSimRef.current, h = s.headInterpPos;
      return { phase: s.phase, tp: s.tunnelProgress, cam: camera.position.toArray(), q: camera.quaternion.toArray(),
        fov: camera.fov, head: h ? h.toArray() : null };
    };
  });
  if (args.shots) {
    // --shots=dir: freeze the ride at each listed phase:progress and film it with
    // real draws (--shot-list=windout:0.2,windout:0.5,...).
    fs.mkdirSync(args.shots, { recursive: true });
    const list = String(args['shot-list'] || 'exiting:0.9,windout:0.15,windout:0.3,windout:0.4,windout:0.5,windout:0.65,windout:0.85,crawling:0').split(',');
    for (const [n, item] of list.entries()) {
      const [phase, progress] = item.split(':');
      await page.waitForFunction(([phase, p]) => {
        const sim = window.__wormSimRef.current; return sim.phase === phase && sim.tunnelProgress >= +p;
      }, [phase, progress], { timeout: 120000, polling: 'raf' });
      await page.evaluate(() => { window.__store.setState({ wormPaused: true }); window.__perf.noDraw = false; window.__perf.roots.r3f.containerInfo.getState().setDpr(0.5); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: path.join(args.shots, `${String(n).padStart(2, '0')}-${phase}-${progress}.png`), timeout: 240000 });
      await page.evaluate(() => { window.__perf.noDraw = true; window.__store.setState({ wormPaused: false }); });
    }
  }
  if (args.profile) {
    // CPU profile of the surface crawl that follows the ride.
    await page.waitForFunction(() => window.__wormSimRef.current.phase === 'crawling', null, { timeout: 120000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await page.waitForTimeout(+args.profile || 3000);
    const { profile } = await cdp.send('Profiler.stop');
    const self = {}, byId = new Map(profile.nodes.map(n => [n.id, n]));
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => {
      const n = byId.get(id), f = n.callFrame;
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
      self[key] = (self[key] || 0) + (dt[i] || 0) / 1000;
    });
    // Inclusive time by function, for the hot callers.
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const incl = {};
    profile.samples.forEach((id, i) => {
      const seen = new Set();
      for (let x = id; x; x = parent.get(x)) {
        const f = byId.get(x).callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
        if (seen.has(key)) continue; seen.add(key);
        incl[key] = (incl[key] || 0) + (dt[i] || 0) / 1000;
      }
    });
    console.log('self ms'); for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v.toFixed(0), k);
    console.log('inclusive ms'); for (const [k, v] of Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(v.toFixed(0), k);
  }
  await page.waitForFunction(() => {
    const f = window.__perf.frames, s = window.__wormSimRef.current;
    return s.phase === 'crawling' && f.length && f.at(-1).s?.phase === 'crawling' && f.filter(r => r.s?.phase === 'crawling').length > 60;
  }, null, { timeout: 120000 });
  const frames = await page.evaluate(() => window.__perf.frames.filter(f => f.s).map(f => ({ ts: f.ts, script: f.script, link: f.link,
    tex: f.tex, texSub: f.texSub, bufKB: Math.round(f.bufBytes / 1024), cDom: f.cDom, ...f.s })));
  const longtasks = await page.evaluate(() => window.__perf.longtasks);
  if (args.longtasks) {
    for (const lt of longtasks) {
      const frame = frames.find(f => f.ts >= lt.start);
      if (frame && frame.phase) console.log('longtask', frame.phase, Math.round(lt.dur), 'ms');
    }
  }
  if (args.raw) fs.writeFileSync(args.raw, JSON.stringify(frames));
  const links = await page.evaluate(() => window.__perf.linkLog.map(l => ({ owner: l.owner, phase: l.s?.phase })));
  // Each change to these renderer-wide program inputs during a ride relinks the scene.
  console.log('program key inputs', JSON.stringify(await page.evaluate(() => window.__perf.keys), null, 1));
  for (const c of await page.evaluate(() => window.__compiles || [])) if (c.ms > 5) console.log('compile', JSON.stringify(c));
  if (links.length) {
    const byOwner = {};
    for (const l of links) byOwner[`${l.phase} ${l.owner}`] = (byOwner[`${l.phase} ${l.owner}`] || 0) + 1;
    console.log('shader links'); for (const [k, n] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) console.log(n, k);
  }
  // Analyse: per-frame lens speed and turn rate, roll against the previous frame.
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const len = a => Math.hypot(...a);
  const rot = (q, v) => {
    const [x, y, z, w] = q, [vx, vy, vz] = v;
    const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  };
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
  const rows = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i], dt = Math.max(1e-3, (b.ts - a.ts) / 1000);
    const fa = rot(a.q, [0, 0, -1]), fb = rot(b.q, [0, 0, -1]), ua = rot(a.q, [0, 1, 0]), ub = rot(b.q, [0, 1, 0]);
    const toHead = b.head ? sub(b.head, b.cam) : null;
    rows.push({ i, phase: b.phase, tp: +b.tp.toFixed(3), dtMs: +(dt * 1000).toFixed(1), script: +b.script.toFixed(1), link: b.link,
      move: +len(sub(b.cam, a.cam)).toFixed(4), turnDeg: +ang(fa, fb).toFixed(2), rollDeg: +ang(ua, ub).toFixed(2),
      headOffAxisDeg: toHead ? +ang(fb, toHead.map(v => v / len(toHead))).toFixed(1) : null,
      headDist: toHead ? +len(toHead).toFixed(3) : null, fov: +b.fov.toFixed(1) });
  }
  fs.writeFileSync(args.out || '/tmp/ride-camera.json', JSON.stringify(rows, null, 1));
  const byPhase = {};
  for (const r of rows) {
    const p = (byPhase[r.phase] ||= { frames: 0, maxMove: 0, maxTurn: 0, maxRoll: 0, maxOffAxis: 0, maxScript: 0, links: 0 });
    p.frames++; p.maxMove = Math.max(p.maxMove, r.move); p.maxTurn = Math.max(p.maxTurn, r.turnDeg);
    p.maxRoll = Math.max(p.maxRoll, r.rollDeg); p.maxOffAxis = Math.max(p.maxOffAxis, r.headOffAxisDeg ?? 0);
    p.maxScript = Math.max(p.maxScript, r.script); p.links += r.link;
  }
  console.log(JSON.stringify(byPhase, null, 1));
  if (errors.length) console.log('errors', errors);
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
