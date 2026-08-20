// Chaos worker — thin scheduling/postMessage adapter around the pure sim in
// src/game/chaosSim.js. ALL game rules (chain walks, Conway generations, the
// death ledger, winner detection) live in the sim so they can be unit-tested
// and driven headless; this file owns only timers and the message protocol.

import { createChaosSim } from '../game/chaosSim.js';

let sim = null;
let running = false;
let timerId = null;
let tickAcc = 0;
let conwayAcc = 0;
let last = 0;
// Generation stamp — set on START and on every full resync (SYNC_CUBIES). Echoed on
// every TICK so the main thread can drop flip batches computed from a superseded cube
// (e.g. TICKs already in flight when the player resets or shuffles the board).
let workerGen = 0;

const postTick = (payload) => self.postMessage({ type: 'TICK', payload: { ...payload, gen: workerGen } });

const schedule = () => {
  if (!running || !sim) return;
  const now = performance.now();
  const dt = now - last;
  last = now;
  tickAcc += dt;
  conwayAcc += dt;

  const chainPeriod = sim.chainPeriod();
  if (tickAcc >= chainPeriod) {
    // Pass accumulated real ms so chain cooldowns run in wall-clock time.
    const payload = sim.chainTick(tickAcc);
    if (payload && payload.didWork) {
      postTick(payload);
    }
    if (sim.isFinished()) running = false;
    tickAcc = 0;
  }

  // Conway generation runs on its own slower cadence — evaluates the full surface
  // and produces emergent birth/recovery patterns independent of chain walks.
  const conwayPeriod = sim.conwayPeriod();
  if (conwayAcc >= conwayPeriod) {
    const conwayPayload = sim.conwayTick();
    if (conwayPayload) {
      postTick({
        ...conwayPayload,
        // Winner detection stays with the chain tick, which re-evaluates the
        // alive count every cycle — at most one chain period behind a Conway kill.
        winner: null,
        // Reuse the last chain tick's metrics snapshot instead of a second
        // O(n) scan; Conway only mutates a capped handful of stickers.
        metrics: null,
        didWork: true,
      });
    }
    conwayAcc = 0;
  }

  if (running) {
    // Sleep until the next chain or Conway tick is actually due instead of
    // polling every 16 ms — all cooldowns are wall-clock (dtMs) based, so the
    // sim advances identically while idle wakeups drop by ~90%.
    const untilChain = Math.max(0, chainPeriod - tickAcc);
    const untilConway = Math.max(0, conwayPeriod - conwayAcc);
    timerId = setTimeout(schedule, Math.max(16, Math.min(untilChain, untilConway)));
  }
};

self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START': {
      workerGen = payload.gen ?? 0;
      sim = createChaosSim({
        cubies: payload.cubies,
        size: payload.size,
        chaosLevel: payload.chaosLevel,
        flipCap: payload.disparityFlipCap,
        explosionT: payload.explosionT ?? 0,
        animating: !!payload.animating,
      });
      tickAcc = 0;
      conwayAcc = 0;
      last = performance.now();
      running = true;
      // Immediate metrics snapshot so HUDs have data before the first
      // productive tick (replaces main-thread polling scans).
      self.postMessage({ type: 'METRICS', payload: { metrics: sim.getMetrics() } });
      if (timerId) clearTimeout(timerId);
      schedule();
      break;
    }

    case 'SYNC_CUBIES': {
      // Full resync (reset / shuffle / size change / loaded state / player heal):
      // the cube was replaced out from under the sim, so advance the generation —
      // any TICKs the main thread already has in flight carry the old gen and will
      // be dropped.
      if (payload.gen != null) workerGen = payload.gen;
      const revival = sim?.syncCubies(payload.cubies);
      // The incoming cube contradicted the death ledger (healed tiles the ledger
      // had buried). Report the revivals so the store's death list — and the
      // ALIVE counter derived from it — match the board again.
      if (revival) self.postMessage({ type: 'REVIVE', payload: { ...revival, gen: workerGen } });
      break;
    }

    case 'ROTATE_SLICE':
      // Lightweight counterpart to SYNC_CUBIES: replay a single-slice rotation
      // on the sim's own state instead of receiving a full structured-cloned
      // cubies array.
      sim?.rotateSlice(payload);
      break;

    case 'SET_FLIP_CAP': {
      // Lowering the cap sweeps newly-capped tiles into the death ledger; the
      // sim returns that sweep as a payload to forward.
      const sweep = sim?.setFlipCap(payload.disparityFlipCap);
      if (running && sweep) postTick(sweep);
      break;
    }

    case 'SET_CHAOS_LEVEL':
      sim?.setChaosLevel(payload.chaosLevel);
      break;

    case 'SET_EXPLOSION':
      sim?.setExplosion(payload.explosionT);
      break;

    case 'SET_ANIMATING':
      sim?.setAnimating(payload.animating);
      break;

    case 'STOP':
      running = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      break;
  }
};
