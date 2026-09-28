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
if (!args.draw) await context.addInitScript(() => { window.__perf.noDraw = true; });
const page = await context.newPage();
page.on('pageerror', (e) => { if (!/\.hdr/.test(e.message)) console.error('pageerror:', e.message.slice(0, 160)); });

const click = async (re, timeout = 30000) => {
  const b = page.locator('button:visible', { hasText: re }).first();
  await b.waitFor({ state: 'visible', timeout });
  await b.click();
};
await page.goto(URL, { waitUntil: 'load' });
await page.getByRole('button', { name: 'Skip intro and enter game' }).click({ timeout: 60000 });
await click(/^\s*play\s*→?\s*$/i);
await click(/play worm/i);
await page.getByRole('button', { name: 'Free Play', exact: true }).click();
await click(/continue/i);
let sized = !args.size;
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(600);
  if (!sized) {
    const size = page.getByRole('button', { name: `${args.size} by ${args.size}`, exact: true });
    if (await size.count()) { await size.first().click(); sized = true; }
  }
  const play = page.locator('button:visible', { hasText: /^\s*play\s*→?\s*$/i });
  if (await play.count()) { await play.first().click(); break; }
  await click(/next/i);
}
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
});
const t0 = Date.now();
while ((await page.evaluate(() => window.__store.getState().wormGamePhase)) !== 'active') {
  if (Date.now() - t0 > 240000) throw new Error('WORM run never reached the active phase');
  await page.waitForTimeout(1000);
}
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
const out = { mode: MODE, url: URL, ms: MS, size: args.size || 3, mobile: !!args.mobile, throttle: +(args.throttle || 1), draws: args.draw ? 'real' : 'suppressed' };

if (MODE === 'frames' || MODE === 'react') {
  await page.evaluate((react) => { const W = window.__perf; W.frames = []; W.renders = {}; W.reactOn = react; }, MODE === 'react');
  if (args.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const heap0 = await cdp.send('Runtime.getHeapUsage');
  await playFor(MS);
  const heap1 = await cdp.send('Runtime.getHeapUsage');
  const { frames, renders } = await page.evaluate(() => ({ frames: window.__perf.frames, renders: window.__perf.renders }));
  Object.assign(out, summarize(frames), { reactCommits: commitCost(frames), phases: phases(frames), deaths, heapMB: [r1(heap0.usedSize / 1e6), r1(heap1.usedSize / 1e6)] });
  console.log(JSON.stringify(out, null, 2));
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
  }
}

if (MODE === 'attribute') {
  console.log('renderer:', JSON.stringify(await page.evaluate(`(${inpage})()`)));
  await page.evaluate(() => {
    const W = window.__perf;
    W.frames = []; W.byOwner = {}; W.passes = {}; W.uploads = {}; W.churn = {}; W.linkLog = [];
    W.trackUploads(false);
    W.attrib = true; W.churnOn = true;
    W.ownerTimer = setInterval(() => W.buildOwners(), 1000);
    const loop = () => { if (!W.attrib) return; W.trackUploads(true); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await playFor(MS);
  const r = await page.evaluate(() => {
    const W = window.__perf;
    W.attrib = false; W.churnOn = false; clearInterval(W.ownerTimer);
    return { n: W.frames.length, byOwner: W.byOwner, passes: W.passes, uploads: W.uploads, churn: W.churn, links: W.linkLog, frames: W.frames };
  });
  const per = (x) => x / r.n;
  Object.assign(out, summarize(r.frames), { phases: phases(r.frames), deaths });
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nRender passes per frame:\n${top(r.passes, 10, ([k, v]) => `${per(v).toFixed(2).padStart(7)}  ${k}`)}`);
  const owners = Object.fromEntries(Object.entries(r.byOwner).map(([k, v]) => [k, v.draws]));
  console.log(`\nDraws per frame by owner (triangles/frame):\n${top(owners, 30, ([k, v]) => `${per(v).toFixed(1).padStart(7)} ${String(Math.round(per(r.byOwner[k].tris))).padStart(8)}  ${k}`)}`);
  const uploads = Object.fromEntries(Object.entries(r.uploads).map(([k, v]) => [k, v.bytes]));
  console.log(`\nUploads, KB per frame:\n${top(uploads, 20, ([k, v]) => `${(per(v) / 1024).toFixed(1).padStart(7)}  ${k}`)}`);
  console.log(`\nProgram re-selection per frame (material state that sends three.js back through getProgram):\n${top(r.churn, 20, ([k, v]) => `${per(v).toFixed(2).padStart(7)}  ${k}`)}`);
  const links = r.links.reduce((acc, l) => ((acc[l.owner] = (acc[l.owner] || 0) + 1), acc), {});
  console.log(`\nShader program links in ${MS / 1000}s by the draw that triggered them (${r.links.length} total):\n${top(links, 25, ([k, v]) => `${String(v).padStart(5)}  ${k}`)}`);
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

if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
if (args.screenshot) {
  // Visual QA is outside the measurement window and always uses real draws.
  await page.evaluate(() => { window.__store.setState({ wormPaused: true }); window.__perf.noDraw = false; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: args.screenshot });
}
await browser.close();
