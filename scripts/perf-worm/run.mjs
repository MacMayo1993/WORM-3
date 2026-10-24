// Drives a real WORM free-play run in headless Chromium and measures it.
// See scripts/perf-worm/README.md for setup; findings from the first run are in
// docs/worm-mode-performance-audit-2026-09-27.md.
//
//   node scripts/perf-worm/run.mjs --mode=frames    [--ms=45000] [--profile]
//   node scripts/perf-worm/run.mjs --mode=attribute [--ms=20000]
//   node scripts/perf-worm/run.mjs --mode=react     [--ms=20000]
//   node scripts/perf-worm/run.mjs --mode=ab        [--seq=base,A,B,AB] [--ms=4000]
//
// Common flags: --url=http://localhost:5173/WORM-3/  --size=5  --mobile
//               --throttle=4 (CDP CPU throttling)     --draw (keep real draw calls)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const MODE = args.mode || 'frames';
const URL = args.url || 'http://localhost:5173/WORM-3/';
const MS = +(args.ms || (MODE === 'ab' ? 4000 : 30000));
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

// ── Stats ────────────────────────────────────────────────────────────────────
const quantile = (xs, p) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const r1 = (x) => Math.round(x * 10) / 10;
function summarize(all) {
  const f = all.filter((r) => r.cbs > 0);
  const gaps = f.slice(1).map((r, i) => r.ts - f[i].ts);
  const col = (k) => f.map((r) => r[k]);
  const sum = (k) => col(k).reduce((a, b) => a + b, 0);
  return {
    frames: f.length,
    fps: r1(1000 / mean(gaps)),
    scriptMs: { p50: r1(quantile(col('script'), 0.5)), p95: r1(quantile(col('script'), 0.95)), mean: r1(mean(col('script'))), max: r1(Math.max(...col('script'))) },
    perFrame: {
      draws: quantile(col('draw'), 0.5), instancedDraws: quantile(col('inst'), 0.5), triangles: Math.round(quantile(col('tris'), 0.5)),
      programSwitches: quantile(col('prog'), 0.5), uniformCalls: quantile(col('uni'), 0.5), uploadKB: r1(quantile(col('bufBytes'), 0.5) / 1024)
    },
    shaderLinks: sum('link'),
    textureUploads: sum('tex') + sum('texSub'),
    framesOver: { '16.7ms': `${Math.round((100 * f.filter((r) => r.script > 16.7).length) / f.length)}%`, '33.3ms': `${Math.round((100 * f.filter((r) => r.script > 33.3).length) / f.length)}%` }
  };
}
function commitCost(frames) {
  const f = frames.filter((r) => r.cbs > 0 && r.link === 0);
  const pick = (fn) => f.filter(fn).map((r) => r.script);
  const secs = (f[f.length - 1].ts - f[0].ts) / 1000;
  const none = pick((r) => !r.cR3f && !r.cDom), dom = pick((r) => !r.cR3f && r.cDom), r3f = pick((r) => r.cR3f);
  return {
    domCommitFramesPerSec: r1(dom.length / secs), r3fCommitFramesPerSec: r1(r3f.length / secs),
    meanScriptMs: { noCommit: r1(mean(none)), domCommit: r1(mean(dom)), r3fCommit: r1(mean(r3f)) }
  };
}
// The slowest frames, with what they carried: links are compile hitches, commits React work.
const worst = (frames, n = 8) => [...frames].filter((r) => r.cbs > 0).sort((a, b) => b.script - a.script).slice(0, n)
  .map((r) => `${r1(r.script).toFixed(1).padStart(7)} ms  links ${r.link}  r3f commits ${r.cR3f}  dom commits ${r.cDom}  draws ${r.draw}  ${r.s ?? ''}`).join('\n');
const top = (obj, n, fmt) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(fmt).join('\n');

// ── Browser + navigation ─────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
const context = await browser.newContext(args.mobile
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await context.addInitScript({ path: path.join(here, 'instrument.js') });
if (args.seed) await context.addInitScript(seed => {
  let value = Number(seed) >>> 0;
  Math.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}, args.seed);
if (!args.draw) await context.addInitScript(() => { window.__perf.noDraw = true; });
const page = await context.newPage();
const shaderErrors = [];
page.on('console', message => {
  if (message.type() === 'error' && /THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) {
    shaderErrors.push(message.text()); console.error(message.text());
  }
});
page.on('pageerror', (e) => { if (!/\.hdr/.test(e.message)) console.error('pageerror:', e.message.slice(0, 160)); });

const click = async (re, timeout = 30000) => {
  const b = page.locator('button:visible', { hasText: re }).first();
  await b.waitFor({ state: 'visible', timeout });
  await b.click();
};
// A brand-new save goes from the intro straight into Story level 1, and a
// production build locks the board sizes and modes behind progress: start from
// the menu with everything open, as e2e/helpers.js does.
await page.addInitScript(() => { if (!localStorage.getItem('worm3_mode_gate')) localStorage.setItem('worm3_mode_gate', 'gated'); });
await page.goto(`${URL}${URL.includes('?') ? '&' : '?'}unlockall=1`, { waitUntil: 'load' });
await page.getByRole('button', { name: /skip intro/i }).click({ timeout: 60000 });
await click(/^\s*play\b/i);
await click(/play worm/i);
await page.getByRole('combobox', { name: 'Worm mode section', exact: true }).selectOption('free');
const wizard = page.getByRole('dialog', { name: 'WORM setup', exact: true });
for (const category of ['Character', 'Scene', 'Colors', 'Style', 'Gameplay']) {
  const panel = wizard.getByRole('region', { name: category, exact: true });
  await panel.waitFor({ state: 'visible', timeout: 30000 });
  if (category === 'Gameplay' && args.size) {
    await page.getByRole('button', { name: `${args.size} by ${args.size}`, exact: true }).first().click();
  }
  await wizard.locator('.mode-wizard-primary').click();
}
// --style=eyeball (every face) or --style=eyeball,marble,… (faces 1–6, cycled):
// the wizard has already applied its own styles, and the scramble's warm-up runs
// after Mobi's skip, so this lands before anything is compiled for the run.
if (args.style) await page.evaluate((list) => {
  const styles = String(list).split(',');
  const manifoldStyles = Object.fromEntries([1, 2, 3, 4, 5, 6].map((face, i) => [face, styles[i % styles.length]]));
  window.__store.setState(s => ({ settings: { ...s.settings, manifoldStyles } }));
}, args.style);
await click(/^\s*skip\s*$/i); // Mobi's intro
await page.evaluate(async (base) => {
  if (window.__store) return;
  window.__store = (await import(`${base}src/hooks/useGameStore.js`)).useGameStore;
}, new globalThis.URL(URL).pathname);
await page.evaluate(() => {
  window.__perf.sample = () => {
    const s = window.__store.getState();
    return `${s.wormGamePhase}|${s.wormPhase}|${s.animState ? 'turning' : '-'}|${s.wormElementalTheme || '-'}|${s.perfReducedFX ? 'reducedFX' : 'fullFX'}`;
  };
  // Time every renderer.compile from here on: the run's warm-up happens while the
  // board scrambles, before any measurement window, and is a frame of its own.
  const W = window.__perf;
  W.warmups = [];
  const install = () => {
    const gl = W.roots.r3f?.containerInfo?.getState?.().gl;
    if (!gl) { setTimeout(install, 100); return; }
    if (gl.__warmupTimed) return;
    gl.__warmupTimed = true;
    const compile = gl.compile;
    gl.compile = function (...a) {
      const links = W.c.link, t0 = performance.now();
      try { return compile.apply(this, a); } finally {
        const ms = performance.now() - t0;
        if (ms >= 2) W.warmups.push({ ms: Math.round(ms), links: W.c.link - links, s: W.sample?.() ?? null });
      }
    };
  };
  install();
});
const t0 = Date.now();
// --probe-arrival: during the portal arrival, check its skip hint, tap once and
// time how long the arrival takes to hand over control (or let it run, with =off).
const arrival = { tapped: false, hint: false, spawnAt: 0, activeAt: 0 };
while ((await page.evaluate(() => window.__store.getState().wormGamePhase)) !== 'active') {
  if (Date.now() - t0 > 240000) throw new Error('WORM run never reached the active phase');
  if (args['probe-arrival']) {
    const s = await page.evaluate(() => { const st = window.__store.getState();
      return { phase: st.wormGamePhase, step: st.wormCountdownStep, hint: document.body.innerText.includes('Tap to skip') }; });
    if (s.phase === 'spawning' && !arrival.spawnAt) arrival.spawnAt = Date.now();
    if (s.phase === 'spawning' && s.step !== arrival.lastStep) { (arrival.steps ||= []).push(`${s.step}@${Date.now() - arrival.spawnAt}`); arrival.lastStep = s.step; }
    if (s.phase === 'spawning' && typeof s.step === 'number') {
      arrival.hint ||= s.hint;
      if (!arrival.tapped && args['probe-arrival'] !== 'off') { arrival.tapped = true; await page.mouse.click(640, 400); }
    }
    await page.waitForTimeout(50);
  } else await page.waitForTimeout(1000);
}
if (args['probe-arrival']) {
  arrival.activeAt = Date.now();
  console.log(`arrival: hint shown ${arrival.hint}, tapped ${arrival.tapped}, spawning to active ${arrival.spawnAt ? arrival.activeAt - arrival.spawnAt : '?'} ms, steps ${(arrival.steps || []).join(' ')}`);
}
if (args.freeze || MODE === 'batching' || MODE === 'events') await page.evaluate(() => window.__store.setState({ wormPaused: true }));
const cdp = await context.newCDPSession(page);
if (args.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +args.throttle });
await page.waitForTimeout(2000);

let deaths = 0;
const playFor = async (ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.waitForTimeout(1000);
    if (args.freeze || (await page.evaluate(() => window.__store.getState().wormAlive))) continue;
    deaths++;
    await page.waitForTimeout(2500);
    const retry = page.locator('button:visible', { hasText: /retry|again/i });
    if (await retry.count()) await retry.first().click();
  }
};
const phases = (frames) => frames.reduce((acc, f) => ((acc[f.s] = (acc[f.s] || 0) + 1), acc), {});
const inpage = fs.readFileSync(path.join(here, 'inpage.js'), 'utf8').replace(/^(\/\/.*\n)+/, '');
const measuredState = await page.evaluate(() => {
  const s = window.__store.getState();
  return { size: s.size, orbs: s.wormPowerups?.length, theme: s.wormElementalTheme, reducedFX: s.perfReducedFX };
});
if (args.size && +args.size !== measuredState.size) throw Error(`Requested size ${args.size}, launched ${measuredState.size}`);
const warmups = await page.evaluate(() => window.__perf.warmups ?? []);
console.log(`warm-up compiles before play: ${warmups.length} calls, ${warmups.reduce((n, w) => n + w.ms, 0)} ms in all, longest ${Math.max(0, ...warmups.map(w => w.ms))} ms, ${warmups.reduce((n, w) => n + w.links, 0)} links`);
for (const w of warmups) console.log(`  ${String(w.ms).padStart(5)} ms  ${w.links} links  ${w.s ?? ''}`);
const out = { mode: MODE, url: URL, ms: MS, size: measuredState.size, scene: measuredState, warmups, freeze: !!args.freeze || MODE === 'batching' || MODE === 'events', seed: args.seed,
  mobile: !!args.mobile, throttle: +(args.throttle || 1), draws: args.draw ? 'real' : 'suppressed' };

if (MODE === 'events') {
  await page.evaluate(`(${inpage})()`);
  const setup = fs.readFileSync(path.join(here, 'events.js'), 'utf8').replace(/^(\/\/.*\n)+/, '');
  out.fixture = await page.evaluate(`(${setup})()`);
  console.log('events:', JSON.stringify(out.fixture));
  await page.waitForTimeout(1800);
  out.events = [];
  for (let cycle = 0; cycle < +(args.cycles || 5); cycle++) {
    for (const event of ['pickup', 'wormhole', 'clear', 'hide-worm', 'show-worm']) {
      await page.evaluate(event => {
        const W = window.__perf; W.frames = []; W.linkLog = []; W.eventStart = performance.now(); W.effectEvent(event);
      }, event);
      await page.waitForTimeout(MS);
      const result = await page.evaluate(() => {
        const W = window.__perf;
        return { frames: W.frames.filter(f => f.ts >= W.eventStart), links: W.linkLog, programs: W.gl.info.programs.length, ...W.gl.info.memory };
      });
      const row = { cycle, event, ...summarize(result.frames), shaderLinks: result.links.length, links: result.links,
        resources: { programs: result.programs, geometries: result.geometries, textures: result.textures } };
      if (args['program-keys']) row.programKeys = await page.evaluate(() => window.__perf.gl.info.programs.map(p => ({ name: p.name, key: p.cacheKey, owners: p.usedTimes })));
      out.events.push(row); console.log(JSON.stringify(row));
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    (out.heap ||= []).push({ cycle, ...heap });
    console.log('heap:', JSON.stringify({ cycle, ...heap }));
  }
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true });
    await page.evaluate(() => {
      const W = window.__perf, root = W.roots.r3f.containerInfo, state = root.getState();
      W.attrib = false; clearInterval(W.patchTimer);
      state.clock.getDelta = () => { state.clock.elapsedTime += .02; return .02; };
      state.internal.subscribe({ current: () => {
        const n = window.__store.getState().size, camera = state.camera;
        camera.up.set(0, 1, 0); camera.fov = 50;
        camera.position.set(n, n * .85, n * 1.35); camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      } }, -.245, root);
      W.effectEvent('wormhole');
    });
    await page.waitForTimeout(1000);
    for (const pose of ['wormhole', 'pickup', 'exploded']) {
      await page.evaluate(pose => {
        const W = window.__perf, state = W.roots.r3f.containerInfo.getState();
        if (pose === 'pickup') W.effectEvent('pickup');
        window.__wormExpansion.amount = pose === 'exploded' ? .35 : 0;
        W.noDraw = false; state.setFrameloop('always');
      }, pose);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
      await page.evaluate(() => {
        const state = window.__perf.roots.r3f.containerInfo.getState();
        state.setFrameloop('never'); state.gl.getContext().finish();
      });
      await page.screenshot({ path: path.join(args.shots, `${pose}.png`), timeout: 60000 });
    }
  }
}

if (MODE === 'frames' || MODE === 'react') {
  await page.evaluate((react) => { const W = window.__perf; W.frames = []; W.renders = {}; W.reactOn = react; }, MODE === 'react');
  if (args.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const heap0 = await cdp.send('Runtime.getHeapUsage');
  await playFor(MS);
  const heap1 = await cdp.send('Runtime.getHeapUsage');
  const { frames, renders } = await page.evaluate(() => ({ frames: window.__perf.frames, renders: window.__perf.renders }));
  Object.assign(out, summarize(frames), { reactCommits: commitCost(frames), phases: phases(frames), deaths, heapMB: [r1(heap0.usedSize / 1e6), r1(heap1.usedSize / 1e6)] });
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nSlowest frames:\n${worst(frames)}`);
  if (MODE === 'react') console.log(`\nComponent renders in ${MS / 1000}s:\n${top(renders, 40, ([k, v]) => `${String(v).padStart(6)}  ${k}`)}`);
  if (args.profile) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map();
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0)));
    const byFn = {};
    for (const n of profile.nodes) {
      const cf = n.callFrame;
      const k = `${cf.functionName || '(anonymous)'} ${cf.url.replace(/^.*\/WORM-3\//, '').replace(/\?.*$/, '')}:${cf.lineNumber + 1}`;
      byFn[k] = (byFn[k] || 0) + (self.get(n.id) || 0) / 1000;
    }
    console.log(`\nCPU self time (ms over ${MS / 1000}s):\n${top(byFn, 40, ([k, v]) => `${v.toFixed(0).padStart(7)}  ${k}`)}`);
    // --callers=<function>: that function's time (its own and below it), by the
    // nearest caller that is not itself, to find who drives a hot routine.
    if (args.callers) {
      const parent = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
      for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
      const total = new Map();
      const sum = id => { if (total.has(id)) return total.get(id); const n = byId.get(id);
        const t = (self.get(id) || 0) + (n.children || []).reduce((a, c) => a + sum(c), 0); total.set(id, t); return t; };
      const byCaller = {}, name = n => `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.replace(/^.*\//, '').replace(/\?.*$/, '')}:${n.callFrame.lineNumber + 1}`;
      for (const n of profile.nodes) {
        if (n.callFrame.functionName !== args.callers) continue;
        const up = byId.get(parent.get(n.id));
        if (!up || up.callFrame.functionName === args.callers) continue;
        byCaller[name(up)] = (byCaller[name(up)] || 0) + sum(n.id) / 1000;
      }
      console.log(`\n${args.callers} by caller (ms over ${MS / 1000}s, inclusive):\n${top(byCaller, 25, ([k, v]) => `${v.toFixed(0).padStart(7)}  ${k}`)}`);
    }
    // --lines=<url part>: the same samples by source line, for functions in matching files.
    if (args.lines) {
      const byLine = {}, tickMs = (profile.endTime - profile.startTime) / 1000 / Math.max(1, profile.samples.length);
      for (const n of profile.nodes) {
        if (!n.callFrame.url.includes(args.lines)) continue;
        const file = n.callFrame.url.replace(/^.*\//, '').replace(/\?.*$/, '');
        for (const { line, ticks } of n.positionTicks || []) {
          const k = `${file}:${line} ${n.callFrame.functionName || '(anonymous)'}`;
          byLine[k] = (byLine[k] || 0) + ticks * tickMs;
        }
      }
      console.log(`\nBy line in *${args.lines}* (ms over ${MS / 1000}s):\n${top(byLine, 40, ([k, v]) => `${v.toFixed(0).padStart(7)}  ${k}`)}`);
    }
  }
}

if (MODE === 'attribute') {
  console.log('renderer:', JSON.stringify(await page.evaluate(`(${inpage})()`)));
  await page.evaluate(() => {
    const W = window.__perf;
    W.frames = []; W.byOwner = {}; W.passes = {}; W.uploads = {}; W.churn = {}; W.linkLog = []; W.compileLog = [];
    W.trackUploads(false);
    // Links outside a draw come from renderer.compile (warm-ups): name the caller.
    if (!W.gl.__compileLogged) {
      const compile = W.gl.compile;
      W.gl.compile = function (...a) {
        const links = W.c.link, t0 = performance.now();
        try { return compile.apply(this, a); } finally {
          if (W.attrib && W.c.link > links) W.compileLog.push({ links: W.c.link - links, ms: Math.round(performance.now() - t0),
            s: W.sample?.() ?? null, caller: (new Error().stack || '').split('\n').slice(2, 5).map(l => l.trim().replace(/\(?http[^)]*\/assets\//, '(')).join(' < ') });
        }
      };
      W.gl.__compileLogged = true;
    }
    W.attrib = true; W.churnOn = true;
    W.ownerTimer = setInterval(() => W.buildOwners(), 1000);
    const loop = () => { if (!W.attrib) return; W.trackUploads(true); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await playFor(MS);
  const r = await page.evaluate(() => {
    const W = window.__perf;
    W.attrib = false; W.churnOn = false; clearInterval(W.ownerTimer);
    return { n: W.frames.length, byOwner: W.byOwner, passes: W.passes, uploads: W.uploads, churn: W.churn, links: W.linkLog, frames: W.frames, compiles: W.compileLog };
  });
  const per = (x) => x / r.n;
  Object.assign(out, summarize(r.frames), { phases: phases(r.frames), deaths });
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nSlowest frames:\n${worst(r.frames)}`);
  console.log(`\nRender passes per frame:\n${top(r.passes, 10, ([k, v]) => `${per(v).toFixed(2).padStart(7)}  ${k}`)}`);
  const owners = Object.fromEntries(Object.entries(r.byOwner).map(([k, v]) => [k, v.draws]));
  console.log(`\nDraws per frame by owner (triangles/frame):\n${top(owners, 30, ([k, v]) => `${per(v).toFixed(1).padStart(7)} ${String(Math.round(per(r.byOwner[k].tris))).padStart(8)}  ${k}`)}`);
  const uploads = Object.fromEntries(Object.entries(r.uploads).map(([k, v]) => [k, v.bytes]));
  console.log(`\nUploads, KB per frame:\n${top(uploads, 20, ([k, v]) => `${(per(v) / 1024).toFixed(1).padStart(7)}  ${k}`)}`);
  console.log(`\nProgram re-selection per frame (material state that sends three.js back through getProgram):\n${top(r.churn, 20, ([k, v]) => `${per(v).toFixed(2).padStart(7)}  ${k}`)}`);
  const links = r.links.reduce((acc, l) => ((acc[l.owner] = (acc[l.owner] || 0) + 1), acc), {});
  if (r.compiles.length) console.log(`\nrenderer.compile calls that linked programs:\n${r.compiles.map(c => `${String(c.links).padStart(5)} links ${String(c.ms).padStart(5)} ms  ${c.s ?? ''}  ${c.caller}`).join('\n')}`);
  console.log(`\nShader program links in ${MS / 1000}s by the draw that triggered them (${r.links.length} total):\n${top(links, 25, ([k, v]) => `${String(v).padStart(5)}  ${k}`)}`);
}

// The scene graph three.js walks every frame: updateMatrixWorld visits every
// object, projectObject every object under a visible chain. Per owning component.
if (MODE === 'census') {
  await page.evaluate(`(${inpage})()`);
  const census = await page.evaluate(() => {
    const W = window.__perf, rows = {};
    let total = 0, shown = 0, autoUpdate = 0, meshes = 0, shownMeshes = 0;
    const walk = (o, chainVisible) => {
      const vis = chainVisible && o.visible;
      total++; if (vis) shown++; if (o.matrixAutoUpdate) autoUpdate++;
      const mesh = o.isMesh || o.isLine || o.isPoints || o.isSprite;
      if (mesh) { meshes++; if (vis) shownMeshes++; }
      const row = (rows[W.ownerOf(o)] ||= { objects: 0, shown: 0, meshes: 0, shownMeshes: 0 });
      row.objects++; if (vis) row.shown++; if (mesh) { row.meshes++; if (vis) row.shownMeshes++; }
      for (const c of o.children) walk(c, vis);
    };
    walk(W.scene, true);
    // How many materials renderer.compile meets, and how few programs they need.
    const materials = new Set(), sources = new Set();
    W.scene.traverse(o => { for (const m of [o.material].flat()) if (m) materials.add(m); });
    for (const m of materials) sources.add(m.isShaderMaterial ? `${m.vertexShader}|${m.fragmentShader}` : m.uuid);
    return { total, shown, autoUpdate, meshes, shownMeshes, materials: materials.size, shaderSourcesOrBuiltins: sources.size, rows };
  });
  const { rows, ...totals } = census;
  Object.assign(out, totals);
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nObjects by owner (objects / under a visible chain / meshes / visible meshes):\n${top(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.objects])), 40,
    ([k]) => `${String(rows[k].objects).padStart(7)} ${String(rows[k].shown).padStart(7)} ${String(rows[k].meshes).padStart(7)} ${String(rows[k].shownMeshes).padStart(7)}  ${k}`)}`);
}

// A flipped tile mounts its subtree and a cleared (healed) one goes back to rest:
// counts the objects StickerPlane owns after each step of the events fixture.
if (MODE === 'restcheck') {
  await page.evaluate(`(${inpage})()`);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const setup = fs.readFileSync(path.join(here, 'events.js'), 'utf8').replace(/^(\/\/.*\n)+/, '');
  await page.evaluate(`(${setup})()`);
  const count = () => page.evaluate(() => {
    const W = window.__perf; W.buildOwners();
    let tiles = 0;
    W.scene.traverse(o => { if (W.ownerOf(o).includes('StickerPlane')) tiles++; });
    return tiles;
  });
  out.steps = [];
  for (let cycle = 0; cycle < +(args.cycles || 3); cycle++) {
    for (const event of ['wormhole', 'clear']) {
      await page.evaluate(event => window.__perf.effectEvent(event), event);
      await page.waitForTimeout(250);
      const soon = await count();
      await page.waitForTimeout(+(args.settle || 3000));
      const settled = await count();
      out.steps.push({ cycle, event, soon, settled });
      console.log(`cycle ${cycle} ${event.padEnd(8)} StickerPlane objects after 0.25 s: ${soon}, settled: ${settled}`);
    }
  }
  console.log(`page errors: ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
}

// Batch-4 checks on a live run: Mobi's first flip-pad line, and the Motion
// setting's CSS rule (an animated probe outside and inside the loading cover).
if (MODE === 'firsts') {
  await page.waitForTimeout(+(args.settle || 4000));
  const r = await page.evaluate(() => {
    const st = window.__store.getState();
    const probe = (inCover) => {
      const host = document.createElement('div');
      if (inCover) host.className = 'wl-root';
      const el = document.createElement('div');
      el.style.animation = 'spin 2s linear infinite';
      el.style.transition = 'opacity 1s';
      host.append(el); document.body.append(host);
      const cs = getComputedStyle(el), out = [cs.animationDuration, cs.animationIterationCount, cs.transitionDuration].join(' ');
      host.remove(); return out;
    };
    const plain = probe(false);
    document.documentElement.setAttribute('data-reduced-motion', '');
    const reduced = probe(false), cover = probe(true);
    document.documentElement.removeAttribute('data-reduced-motion');
    return { pairs: st.wormOpenPairs, line: st.wormMobiLine, milestones: Object.keys(st.playerProgress.milestones).filter(k => k.startsWith('first:mobi')), plain, reduced, cover };
  });
  console.log(JSON.stringify(r, null, 2));
}

// One resting tile's subtree, so the per-tile object count can be read part by part.
if (MODE === 'tiletree') {
  await page.evaluate(`(${inpage})()`);
  const dump = await page.evaluate((n) => {
    const W = window.__perf, roots = [];
    W.scene.traverse(o => { if (W.ownerOf(o).includes('StickerPlane') && !W.ownerOf(o.parent || {}).includes('StickerPlane')) roots.push(o); });
    const lines = [`${roots.length} StickerPlane roots`];
    const walk = (o, d) => {
      lines.push(`${'  '.repeat(d)}${o.type}${o.name ? ' "' + o.name + '"' : ''}${o.visible ? '' : ' (hidden)'}${o.matrixAutoUpdate ? '' : ' [noAuto]'}  <${W.ownerOf(o)}>`);
      for (const c of o.children) walk(c, d + 1);
    };
    for (const r of roots.slice(0, n)) { lines.push('---'); walk(r.parent, 0); }
    return lines.join('\n');
  }, +(args.tiles || 2));
  console.log(dump);
}

// Whole-cube look changes mid-run: each view power re-renders every sticker and
// may meet programs the run never drew. The worst frame of each swap and back.
if (MODE === 'swaps') {
  await page.evaluate(`(${inpage})()`);
  await page.evaluate(() => { window.__perf.attrib = true; });
  out.swaps = [];
  const views = String(args.views || 'view-classic,view-grid,view-sudokube,view-wireframe,view-glass,view-chrome,view-neon,view-gap,view-lego').split(',');
  for (const view of [...views.flatMap(v => [v, null]), ...views.flatMap(v => [v, null])]) {
    await page.evaluate(() => { const W = window.__perf; W.frames = []; W.linkLog = []; });
    await page.evaluate(v => window.__store.setState({ wormViewPower: v }), view);
    await page.waitForTimeout(+(args.settle || 1500));
    const r = await page.evaluate(() => {
      const f = window.__perf.frames.filter(x => x.cbs > 0), worst = f.reduce((a, b) => (b.script > a.script ? b : a), f[0] || { script: 0 });
      return { frames: f.length, worstMs: Math.round(worst.script), worstLinks: worst.link, links: f.reduce((n, x) => n + x.link, 0),
        commitsR3f: f.reduce((n, x) => n + x.cR3f, 0), owners: [...new Set(window.__perf.linkLog.map(l => l.owner))].slice(0, 6) };
    });
    out.swaps.push({ view: view ?? 'restore', ...r });
    console.log(`${String(view ?? '  → restore').padEnd(16)} worst ${String(r.worstMs).padStart(5)} ms  links in worst ${r.worstLinks}  links ${r.links}  r3f commits ${r.commitsR3f}  ${r.owners.join(' | ')}`);
  }
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
}

// The run's warm-up again on a board whose programs are all linked: what is left
// is three.js walking the scene for program keys, the cost a retry pays. Bumps the
// run id and steps the frozen board back into the scrambling phase for a frame.
if (MODE === 'rewarm') {
  out.rewarms = [];
  if (args.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
  for (let i = 0; i < +(args.cycles || 5); i++) {
    await page.evaluate(() => { window.__perf.warmups = []; const s = window.__store.getState();
      window.__store.setState({ wormRunId: s.wormRunId + 1, wormGamePhase: 'scrambling' }); });
    await page.waitForTimeout(600);
    const calls = await page.evaluate(() => { window.__store.setState({ wormGamePhase: 'active' }); return window.__perf.warmups; });
    out.rewarms.push(calls);
    console.log(`rewarm ${i}: ${calls.map(c => `${c.ms} ms/${c.links} links`).join(', ')}`);
  }
  if (args.profile) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), byFn = {};
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0)));
    for (const n of profile.nodes) {
      const cf = n.callFrame;
      const k = `${cf.functionName || '(anonymous)'} ${cf.url.replace(/^.*\/WORM-3\//, '').replace(/\?.*$/, '')}:${cf.lineNumber + 1}`;
      byFn[k] = (byFn[k] || 0) + (self.get(n.id) || 0) / 1000;
    }
    console.log(`\nCPU self time over the rewarms (ms):\n${top(byFn, 30, ([k, v]) => `${v.toFixed(0).padStart(7)}  ${k}`)}`);
  }
}

// Visual check of a slice turn: waits for a live turn, pauses GSAP once the layer
// is part-way round (every turn is a GSAP tween), then films that frozen frame
// with real draws, from the player's camera and from a fixed overview.
if (MODE === 'turnshots') {
  fs.mkdirSync(args.shots || '/tmp/turnshots', { recursive: true });
  const dir = args.shots || '/tmp/turnshots';
  await page.evaluate((minAngle) => {
    window.__turnFrozen = null;
    const watch = () => {
      const live = window.__liveRotation;
      if (live?.active && Math.abs(live.angle) >= minAngle) {
        window.__gsap.globalTimeline.pause();
        window.__store.setState({ wormPaused: true });
        window.__turnFrozen = { axis: live.axis, layers: [...live.sliceIndices], angle: live.angle };
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }, +(args.angle || 0.5));
  // --turn=col:0 starts that turn now (layer index; 0 and size-1 are faces)
  // instead of waiting for a hazard turn.
  // --turn=face turns the face the worm's head is on; --turn=head:col (or row,
  // depth) the layer through the head.
  if (args.turn) await page.evaluate((turn) => {
    let [axis, layer, dir = '1'] = String(turn).split(':');
    const pos = window.__wormSimRef?.current?.pos, n = window.__store.getState().size;
    if (axis === 'face' && pos) {
      const faces = { PX: ['col', n - 1], NX: ['col', 0], PY: ['row', n - 1], NY: ['row', 0], PZ: ['depth', n - 1], NZ: ['depth', 0] };
      [axis, layer] = faces[pos.dirKey];
    } else if (axis === 'head' && pos) {
      axis = layer; layer = { col: pos.x, row: pos.y, depth: pos.z }[axis];
    }
    const move = { axis, dir: +dir, sliceIndex: +layer, sliceIndices: null, sliceDirs: null, t: 0 };
    window.__store.setState({ animState: move, pendingMove: { ...move } });
  }, args.turn);
  const t1 = Date.now();
  let frozen = null;
  while (!(frozen = await page.evaluate(() => window.__turnFrozen))) {
    if (Date.now() - t1 > +(args.ms || 120000)) throw Error('No slice turn within the window');
    await page.waitForTimeout(250);
  }
  out.turn = frozen;
  console.log('frozen turn:', JSON.stringify(frozen));
  for (const pose of ['chase', 'overview']) {
    await page.evaluate((pose) => {
      const W = window.__perf, state = W.roots.r3f.containerInfo.getState();
      W.noDraw = false;
      state.setFrameloop('never');
      if (pose === 'overview') {
        // Re-aim after the chase rig (-0.25) and before the batches cull (0), as the
        // events shots do, so one frame is culled and drawn from this fixed view.
        const root = W.roots.r3f.containerInfo;
        const n = window.__store.getState().size, at = window.__turnView ?? [n * 0.9, n * 0.8, n * 1.3];
        state.internal.subscribe({ current: () => {
          const camera = state.camera;
          camera.up.set(0, 1, 0); camera.position.set(...at); camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        } }, -0.245, root);
      }
      state.advance(performance.now());
      state.gl.getContext().finish();
    }, pose);
    await page.screenshot({ path: path.join(dir, `${args.size || 'n'}-${(args.style || 'default').split(',')[0]}-${pose}.png`), timeout: 180000 });
  }
}

if (MODE === 'ab') {
  console.log('renderer:', JSON.stringify(await page.evaluate(`(${inpage})()`)));
  // Freeze the run so every window renders the same scene: patches are then the
  // only variable. Rendering and every useFrame keep running while paused.
  await page.evaluate(() => window.__store.setState({ wormPaused: true }));
  await page.waitForTimeout(1500);
  out.windows = [];
  for (const set of String(args.seq || 'base,A,B,AB,base,A,B,AB').split(',')) {
    await page.evaluate((s) => {
      const W = window.__perf;
      for (const k of ['A', 'B', 'C', 'D']) W.patch[k] = s.includes(k);
      W.applyPatches();
    }, set);
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__perf.frames = []; });
    await page.waitForTimeout(MS);
    const s = summarize(await page.evaluate(() => window.__perf.frames));
    out.windows.push({ set, ...s });
    console.log(`${set.padEnd(6)} script mean ${String(s.scriptMs.mean).padStart(5)} ms  p50 ${String(s.scriptMs.p50).padStart(5)}  p95 ${String(s.scriptMs.p95).padStart(5)}  draws ${s.perFrame.draws}  tris ${s.perFrame.triangles}  program switches ${s.perFrame.programSwitches}  upload ${s.perFrame.uploadKB} KB`);
  }
}

if (MODE === 'batching') {
  await page.evaluate(`(${inpage})()`);
  const setup = fs.readFileSync(path.join(here, 'batching.js'), 'utf8').replace(/^(\/\/.*\n)+/, '');
  console.log('reference:', JSON.stringify(await page.evaluate(`(${setup})()`)));
  await page.waitForTimeout(2000);
  out.windows = [];
  for (const reference of [true, false, true, false]) {
    await page.evaluate(on => window.__perf.batchReference(on), reference);
    await page.waitForTimeout(500);
    await page.evaluate(() => { const W = window.__perf; W.frames = []; W.byOwner = {}; W.attrib = true; });
    await page.waitForTimeout(MS);
    const measured = summarize(await page.evaluate(() => window.__perf.frames));
    const owners = await page.evaluate(() => {
      const W = window.__perf; W.attrib = false;
      return Object.fromEntries(Object.entries(W.byOwner).map(([k, v]) => [k, { draws: v.draws / W.frames.length, triangles: v.tris / W.frames.length }]));
    });
    measured.owners = owners;
    measured.quality = await page.evaluate(() => ({ reducedFX: window.__store.getState().perfReducedFX,
      dpr: window.__perf.roots.r3f.containerInfo.getState().viewport.dpr }));
    out.windows.push({ reference, ...measured });
    console.log(JSON.stringify({ reference, ...measured, owners: undefined }));
  }
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true });
    await page.evaluate(dpr => { window.__perf.batchDpr = dpr; }, +(args['shot-dpr'] || 1));
    for (const pose of String(args.poses || 'overview,exploded,glass,inside').split(',')) {
      await page.evaluate(pose => {
        const W = window.__perf;
        W.batchPose = pose;
        window.__wormExpansion.amount = pose === 'exploded' ? .35 : 0;
        window.__store.setState({ wormViewPower: pose === 'glass' ? 'view-glass' : null });
        W.noDraw = false;
      }, pose);
      await page.waitForTimeout(1500);
      for (const reference of [true, false]) {
        await page.evaluate(on => {
          const W = window.__perf, state = W.roots.r3f.containerInfo.getState();
          state.setFrameloop('always'); state.clock.elapsedTime = W.batchTime;
          W.batchReference(on);
        }, reference);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        // Let software WebGL finish the captured frame without queuing more
        // multi-million-triangle frames while Playwright reads the compositor.
        await page.evaluate(() => {
          const state = window.__perf.roots.r3f.containerInfo.getState();
          state.setFrameloop('never'); state.gl.getContext().finish();
        });
        await page.screenshot({ path: path.join(args.shots, `${pose}-${reference ? 'reference' : 'batched'}.png`), timeout: 60000 });
      }
    }
  }
}
if (shaderErrors.length) { await browser.close(); throw Error(`${shaderErrors.length} WebGL shader errors`); }
if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
if (args.screenshot) {
  // Visual QA is outside the measurement window and always uses real draws.
  await page.evaluate(() => { window.__store.setState({ wormPaused: true }); window.__perf.noDraw = false; });
  await page.waitForTimeout(2500);
  // Hold the last drawn frame: software WebGL cannot keep a live loop going
  // while the compositor is read, and the capture timed out on large boards.
  await page.evaluate(() => {
    const state = window.__perf.roots.r3f.containerInfo.getState();
    state.setFrameloop('never'); state.gl.getContext().finish();
  });
  await page.screenshot({ path: args.screenshot, timeout: 120000 });
}
await browser.close();
