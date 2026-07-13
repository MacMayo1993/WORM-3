// scripts/measureSpeedOdds.mjs
// Measures the SPEED bet's fast/slow split by running headless chaos rounds
// on a virtual clock (createChaosSim with an injected `now`). A round's SPEED
// duration is first death → last death, matching resolveBet's definition.
//
//   node scripts/measureSpeedOdds.mjs [roundsPerCell]
//
// Replicates the worker's scheduling (chain/Conway cadence from the sim) plus
// the disparity round's auto-unshuffle rotations (one every 1.5 s while the
// reverse-move queue drains — 10/20/30 moves for short/medium/long games).

import { createChaosSim } from '../src/game/chaosSim.js';
import { makeCubies } from '../src/game/cubeState.js';
import { DISPARITY_GAME_LENGTHS } from '../src/utils/economyConstants.js';

const ROUNDS = Number(process.argv[2]) || 200;
const SIZE = 3;
const THRESHOLD_S = 60;
const MAX_VIRTUAL_MS = 4 * 60 * 60 * 1000; // 4 virtual hours safety cap
const MOVE_INTERVAL_MS = 1500; // App.jsx startSolveSequence pace

const runRound = ({ level, flipCap, unshuffleMoves }) => {
  let vnow = 0;
  const sim = createChaosSim({
    cubies: makeCubies(SIZE),
    size: SIZE,
    chaosLevel: level,
    flipCap,
    now: () => vnow,
  });

  let firstDeath = null;
  let lastDeath = null;
  let movesLeft = unshuffleMoves;
  let nextChain = sim.chainPeriod();
  let nextConway = sim.conwayPeriod();
  let nextRotate = MOVE_INTERVAL_MS;
  let lastChainAt = 0;

  const absorb = (p) => {
    if (!p?.deaths?.length) return;
    for (const d of p.deaths) {
      if (firstDeath === null) firstDeath = d.timestamp;
      lastDeath = d.timestamp;
    }
  };

  while (vnow < MAX_VIRTUAL_MS && !sim.isFinished()) {
    const step = Math.min(nextChain, nextConway, movesLeft > 0 ? nextRotate : Infinity);
    vnow += step;
    nextChain -= step;
    nextConway -= step;
    nextRotate -= step;

    if (movesLeft > 0 && nextRotate <= 0) {
      sim.rotateSlice({
        axis: ['row', 'col', 'depth'][Math.floor(Math.random() * 3)],
        sliceIndex: Math.floor(Math.random() * SIZE),
        dir: Math.random() < 0.5 ? 1 : -1,
      });
      movesLeft--;
      nextRotate = MOVE_INTERVAL_MS;
    }
    if (nextChain <= 0) {
      const dt = vnow - lastChainAt;
      lastChainAt = vnow;
      absorb(sim.chainTick(dt));
      nextChain = sim.chainPeriod();
    }
    if (nextConway <= 0) {
      absorb(sim.conwayTick());
      nextConway = sim.conwayPeriod();
    }
  }

  return {
    finished: sim.isFinished(),
    speedSeconds: firstDeath !== null && lastDeath !== null ? (lastDeath - firstDeath) / 1000 : null,
    totalSeconds: vnow / 1000,
  };
};

const pct = (n, d) => ((100 * n) / d).toFixed(1).padStart(5);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

console.log(`SPEED bet split — ${ROUNDS} rounds/cell, ${SIZE}×${SIZE}, threshold ${THRESHOLD_S}s (first→last death)\n`);
console.log('level  flipCap  game    fast%  slow%   p50s   p90s  unfinished');

for (const flipCap of [15, 25]) {
  for (const [lengthName, moves] of Object.entries(DISPARITY_GAME_LENGTHS)) {
    for (let level = 1; level <= 5; level++) {
      let fast = 0;
      let slow = 0;
      let unfinished = 0;
      const durations = [];
      for (let i = 0; i < ROUNDS; i++) {
        const r = runRound({ level, flipCap, unshuffleMoves: moves });
        if (!r.finished || r.speedSeconds === null) {
          unfinished++;
          continue;
        }
        durations.push(r.speedSeconds);
        if (r.speedSeconds < THRESHOLD_S) fast++;
        else slow++;
      }
      durations.sort((a, b) => a - b);
      const total = fast + slow;
      console.log(
        `  L${level}     ${String(flipCap).padEnd(3)}    ${lengthName.padEnd(6)}` +
        ` ${pct(fast, total)}  ${pct(slow, total)}` +
        `  ${quantile(durations, 0.5).toFixed(0).padStart(5)}  ${quantile(durations, 0.9).toFixed(0).padStart(5)}` +
        `  ${unfinished}`
      );
    }
    console.log('');
  }
}
