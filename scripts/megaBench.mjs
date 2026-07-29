#!/usr/bin/env node
//
// megaBench — the CPU half of the Mega Worm measurement harness.
//
//   node scripts/megaBench.mjs
//
// Phase 0 of the Mega Worm plan asks for repeatable numbers BEFORE the
// production architecture is chosen, so the renderer work is sized by
// measurement rather than by guesswork. This covers the part that can be
// measured without a browser: cube construction, slice discovery, rotation
// commits, the manifold rebuild, and worm-sim throughput, at the standard
// ceiling (7) against the Mega size (15).
//
// The GPU half — draw calls, triangles, frame time — comes from the in-app perf
// HUD (src/dev/PerfHud.jsx) behind ?megaworm=1, because those numbers only exist
// once there is a real renderer and a real device.
//
// Deterministic: every random draw comes from a seeded generator, so two runs on
// the same machine are comparable and a regression is a regression.

import { performance } from 'node:perf_hooks';

import { makeCubies } from '../src/game/cubeState.js';
import { rotateSliceCubies } from '../src/game/cubeRotation.js';
import { forEachSliceCoordinate, getSliceLinearIndices, MEGA_SIZE } from '../src/game/sliceIndex.js';
import { normalizeWave, applyWaveToCubies } from '../src/game/rotationWave.js';
import { buildManifoldGridMap } from '../src/game/manifoldLogic.js';
import { applyWaveToSim } from '../src/worm/healerWorm/wormSim.js';
import { generateScrambleWaves } from '../src/worm/healerWorm/waveScramble.js';
import {
  makeWormCtx,
  makeWormSimFor,
  makeWormRunner,
  makeSeededRand,
} from '../src/__tests__/helpers/wormHarness.js';

const SIZES = [7, MEGA_SIZE];
const AXES = ['col', 'row', 'depth'];

// ── Timing ───────────────────────────────────────────────────────────────────

/**
 * Time `fn` over enough iterations to get past timer noise.
 *
 * Runs a short warm-up first so JIT compilation lands in the warm-up rather than
 * in the measurement — without it the first size measured looks 3–10× slower
 * than the second purely from being first.
 */
function bench(fn, iterations) {
  const warm = Math.max(1, Math.min(iterations, Math.ceil(iterations / 10)));
  for (let i = 0; i < warm; i++) fn(i);
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - t0;
  return { msPerOp: elapsed / iterations, opsPerSec: (iterations / elapsed) * 1000, iterations };
}

const rows = [];
function record(task, size, result, note = '') {
  rows.push({ task, size, ...result, note });
}

function printTable() {
  const head = ['task', 'size', 'ms/op', 'ops/sec', 'iters', 'note'];
  const body = rows.map(r => [
    r.task,
    String(r.size),
    r.msPerOp < 0.01 ? r.msPerOp.toFixed(4) : r.msPerOp.toFixed(3),
    r.opsPerSec >= 1000 ? Math.round(r.opsPerSec).toLocaleString() : r.opsPerSec.toFixed(1),
    String(r.iterations),
    r.note,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map(b => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log('\n' + line(head));
  console.log(widths.map(w => '─'.repeat(w)).join('  '));
  let lastTask = null;
  for (const b of body) {
    if (lastTask !== null && b[0] !== lastTask) console.log('');
    lastTask = b[0];
    console.log(line(b));
  }
}

// Report how much worse Mega is than the standard ceiling for each task — the
// single number that says whether a subsystem needs rearchitecting or just needs
// to be left alone.
function printRatios() {
  const byTask = new Map();
  for (const r of rows) {
    if (!byTask.has(r.task)) byTask.set(r.task, {});
    byTask.get(r.task)[r.size] = r.msPerOp;
  }
  console.log('\n15³ cost relative to 7³ (cells scale 9.8×, surface 4.6×):');
  for (const [task, bySize] of byTask) {
    const a = bySize[7];
    const b = bySize[MEGA_SIZE];
    if (a === undefined || b === undefined) continue;
    console.log(`  ${task.padEnd(28)} ${(b / a).toFixed(1)}×`);
  }
}

// ── Benchmarks ───────────────────────────────────────────────────────────────

function benchConstruction(size) {
  record('makeCubies', size, bench(() => makeCubies(size, { allowMega: true }), 200));
}

function benchSliceDiscovery(size) {
  // What the code used to do: walk the whole lattice and keep the hits.
  record('sliceScan (old, size³)', size, bench(() => {
    const out = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (y === 2) out.push(x * size * size + y * size + z);
        }
      }
    }
    return out;
  }, 20000));

  // What it does now, uncached (the cost of a cache miss).
  record('sliceGen (new, size²)', size, bench(() => {
    const out = [];
    forEachSliceCoordinate(size, 'row', 2, (x, y, z) => out.push(x * size * size + y * size + z));
    return out;
  }, 20000));

  // What a frame loop actually pays: a cache hit.
  record('sliceIndices (cached)', size, bench(() => getSliceLinearIndices(size, 'row', 2), 200000));
}

function benchRotation(size) {
  const cubies = makeCubies(size, { allowMega: true });
  const rand = makeSeededRand(0xA11CE);

  record('rotateSliceCubies (1 plane)', size, bench(() => {
    rotateSliceCubies(cubies, size, AXES[Math.floor(rand() * 3)], Math.floor(rand() * size), 1);
  }, 2000));

  for (const planes of [1, 2, 3]) {
    const waves = [];
    for (let i = 0; i < 64; i++) {
      const slices = [];
      while (slices.length < planes) {
        const s = Math.floor(rand() * size);
        if (!slices.includes(s)) slices.push(s);
      }
      const { wave } = normalizeWave('row', slices.map(sliceIndex => ({ sliceIndex, dir: 1, numTurns: 1 })), size);
      if (wave) waves.push(wave);
    }
    record(`waveCommit (${planes} plane${planes > 1 ? 's' : ''})`, size, bench((i) => {
      applyWaveToCubies(cubies, size, waves[i % waves.length]);
    }, 2000));
  }
}

function benchManifold(size) {
  const cubies = makeCubies(size, { allowMega: true });
  // Runs once per rotation epoch, so a wave pays it once however many planes it
  // holds — but three staggered commits would pay it three times.
  record('buildManifoldGridMap', size, bench(() => buildManifoldGridMap(cubies, size), 200));
}

function benchSim(size) {
  const cubies = makeCubies(size, { allowMega: true });
  const ctx = makeWormCtx({ getCubies: () => cubies });
  const { runSteps } = makeWormRunner(size);
  const rand = makeSeededRand(0xD00D);

  const sim = makeWormSimFor(size, { orbCount: 12, wormholeInterval: 9999 });
  sim.rand = makeSeededRand(0xB0B);
  // 1,000 steps per op: a single step is far too fast to time individually.
  record('stepWormSim ×1000', size, bench(() => runSteps(sim, ctx, 1000), 20));

  const waves = [];
  for (let i = 0; i < 32; i++) {
    const slices = [];
    while (slices.length < 3) {
      const s = Math.floor(rand() * size);
      if (!slices.includes(s)) slices.push(s);
    }
    const { wave } = normalizeWave('col', slices.map(sliceIndex => ({ sliceIndex, dir: 1, numTurns: 1 })), size);
    if (wave) waves.push(wave);
  }
  record('applyWaveToSim (3 planes)', size, bench((i) => {
    applyWaveToSim(sim, size, ctx, waves[i % waves.length], { inOpeningScramble: false, paused: false });
  }, 2000));
}

function benchScramble(size) {
  const rand = makeSeededRand(0x5CA11E);
  record('generateScrambleWaves(15)', size, bench(() => generateScrambleWaves(size, 15, 3, rand), 2000));
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('WORM-3 Mega Worm CPU bench');
console.log(`node ${process.version} · ${new Date().toISOString()}`);

for (const size of SIZES) {
  benchConstruction(size);
  benchSliceDiscovery(size);
  benchRotation(size);
  benchManifold(size);
  benchSim(size);
  benchScramble(size);
}

// Group the table by task so the 7-vs-15 pair for each is adjacent, keeping the
// order the benchmarks were declared in rather than sorting alphabetically.
const taskOrder = [...new Set(rows.map(r => r.task))];
rows.sort((a, b) =>
  taskOrder.indexOf(a.task) - taskOrder.indexOf(b.task) || a.size - b.size);
printTable();
printRatios();

// The budget that this bench can actually speak to. Frame time and draw calls
// are the HUD's job; this one owns the commit.
const worstCommit = rows
  .filter(r => r.task.startsWith('waveCommit') && r.size === MEGA_SIZE)
  .reduce((m, r) => Math.max(m, r.msPerOp), 0);
console.log(`\nBudget check — logical wave commit at ${MEGA_SIZE}³: ${worstCommit.toFixed(2)} ms ` +
  `(desktop budget 12 ms, supported mobile 24 ms)`);
if (worstCommit > 12) console.log('  ⚠ over the desktop budget on this machine');
