import { describe, it, expect } from 'vitest';
import { createChaosSim } from '../game/chaosSim.js';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { ANTIPODAL_COLOR, FACE_COLORS } from '../utils/constants.js';

// Drive a sim to completion on a virtual clock, replicating the worker's
// scheduling (chain and Conway ticks at the sim's own cadence). Returns the
// accumulated event streams plus the virtual duration.
const runRound = ({ level = 3, size = 3, flipCap = 3, maxVirtualMs = 60 * 60 * 1000, rotateEveryMs = 0 } = {}) => {
  let vnow = 0;
  const sim = createChaosSim({
    cubies: makeCubies(size),
    size,
    chaosLevel: level,
    flipCap,
    now: () => vnow,
  });

  const deaths = [];
  const eliminated = [];
  let winner = null;
  let nextChain = sim.chainPeriod();
  let nextConway = sim.conwayPeriod();
  let nextRotate = rotateEveryMs || Infinity;
  let lastChainAt = 0;

  while (vnow < maxVirtualMs && !sim.isFinished()) {
    const step = Math.min(nextChain, nextConway, nextRotate);
    vnow += step;
    nextChain -= step;
    nextConway -= step;
    nextRotate -= step;

    if (nextRotate <= 0) {
      sim.rotateSlice({
        axis: ['row', 'col', 'depth'][Math.floor(Math.random() * 3)],
        sliceIndex: Math.floor(Math.random() * size),
        dir: Math.random() < 0.5 ? 1 : -1,
      });
      nextRotate = rotateEveryMs;
    }
    if (nextChain <= 0) {
      const dt = vnow - lastChainAt;
      lastChainAt = vnow;
      const p = sim.chainTick(dt);
      if (p) {
        deaths.push(...p.deaths);
        eliminated.push(...p.eliminatedFaces);
        if (p.winner) winner = p.winner;
      }
      nextChain = sim.chainPeriod();
    }
    if (nextConway <= 0) {
      const p = sim.conwayTick();
      if (p) {
        deaths.push(...p.deaths);
        eliminated.push(...p.eliminatedFaces);
      }
      nextConway = sim.conwayPeriod();
    }
  }

  return { sim, deaths, eliminated, winner, durationMs: vnow };
};

const faceOf = (gridId) => parseInt(gridId.slice(1).split('-')[0], 10);
const idxOf = (gridId) => gridId.split('-')[1];

describe('createChaosSim', () => {
  it('starts with clean metrics on a solved cube', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 3, flipCap: 10 });
    const m = sim.getMetrics();
    expect(m.edgeTotal).toBe(54);
    expect(m.disparity).toBe(0);
    expect(m.flipActive).toBe(0);
    expect(m.deadTiles).toBe(0);
    expect(sim.getAliveCount()).toBe(54);
    expect(sim.isFinished()).toBe(false);
  });

  it('chain ticks flip antipodal pairs together', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 3, flipCap: 10 });
    // Drive until the first flip lands (start + propagation are random).
    let flips = [];
    for (let i = 0; i < 200 && flips.length === 0; i++) {
      const p = sim.chainTick(250);
      if (p?.flips?.length) flips = p.flips;
    }
    expect(flips.length).toBeGreaterThan(0);

    // Every sticker with flips must have its antipodal partner flipped too —
    // the same-grid-index tile on the antipodal face.
    const state = sim.getState();
    const byGridId = new Map();
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          for (const st of Object.values(state[x][y][z].stickers))
            byGridId.set(getManifoldGridId(st, 3), st);

    for (const [gridId, st] of byGridId) {
      if ((st.flips || 0) === 0) continue;
      const antiId = `M${ANTIPODAL_COLOR[faceOf(gridId)]}-${idxOf(gridId)}`;
      const anti = byGridId.get(antiId);
      expect(anti, `antipodal ${antiId} of ${gridId} exists`).toBeDefined();
      expect(anti.flips || 0, `antipodal ${antiId} flipped with ${gridId}`).toBeGreaterThan(0);
    }
  });

  it('runs a full round to a two-tile antipodal winner with a complete death ledger', () => {
    const { sim, deaths, eliminated, winner } = runRound({ level: 3, flipCap: 3 });

    expect(sim.isFinished()).toBe(true);
    expect(winner).toHaveLength(2);

    // Winner tiles form one antipodal pair: same grid index, antipodal faces.
    const [a, b] = winner;
    expect(idxOf(a)).toBe(idxOf(b));
    expect(ANTIPODAL_COLOR[faceOf(a)]).toBe(faceOf(b));

    // Everyone else died exactly once, ranks are a clean 1..52 sequence.
    expect(deaths).toHaveLength(52);
    expect(new Set(deaths.map((d) => d.gridId)).size).toBe(52);
    expect(deaths.map((d) => d.rank).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 52 }, (_, i) => i + 1)
    );
    // The winner pair never appears in the death log.
    expect(deaths.some((d) => d.gridId === a || d.gridId === b)).toBe(false);

    // Exactly the four faces outside the winner pair were fully eliminated.
    const winnerFaces = new Set([faceOf(a), faceOf(b)]);
    const eliminatedSet = new Set(eliminated);
    expect(eliminatedSet.size).toBe(4);
    for (const f of Object.keys(FACE_COLORS).map(Number)) {
      expect(eliminatedSet.has(f)).toBe(!winnerFaces.has(f));
    }

    expect(sim.getAliveCount()).toBe(2);
    expect(sim.getMetrics().deadTiles).toBe(52);
  });

  it('emits an authoritative terminal snapshot containing only one live antipodal pair', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 5, flipCap: 2 });
    let terminal = null;

    for (let i = 0; i < 2000 && !terminal; i++) {
      const tick = sim.chainTick(250);
      if (tick?.winner) terminal = tick;
      sim.conwayTick();
    }

    expect(terminal?.winner).toHaveLength(2);
    expect(terminal?.finalState).toBe(sim.getState());

    const liveIds = [];
    for (const layer of terminal.finalState) {
      for (const row of layer) {
        for (const cubie of row) {
          for (const sticker of Object.values(cubie.stickers)) {
            if ((sticker.flips || 0) < 2) liveIds.push(getManifoldGridId(sticker, 3));
          }
        }
      }
    }
    expect(liveIds).toEqual(expect.arrayContaining(terminal.winner));
    expect(liveIds).toHaveLength(2);
  });

  it('survives mid-round rotations with the ledger intact', () => {
    const { sim, deaths, winner } = runRound({ level: 4, flipCap: 3, rotateEveryMs: 1500 });
    expect(sim.isFinished()).toBe(true);
    expect(winner).toHaveLength(2);
    expect(deaths).toHaveLength(52);
    expect(new Set(deaths.map((d) => d.gridId)).size).toBe(52);
  });

  it('death timestamps come from the injected clock', () => {
    const { deaths, durationMs } = runRound({ level: 5, flipCap: 2 });
    expect(deaths.length).toBeGreaterThan(0);
    for (const d of deaths) {
      expect(d.timestamp).toBeGreaterThanOrEqual(0);
      expect(d.timestamp).toBeLessThanOrEqual(durationMs);
    }
  });

  it('pauses while animating', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 3, flipCap: 10, animating: true });
    expect(sim.chainTick(1000)).toBeNull();
    expect(sim.conwayTick()).toBeNull();
    sim.setAnimating(false);
    // At least one of the next few ticks should do real work again.
    let woke = false;
    for (let i = 0; i < 50 && !woke; i++) woke = !!sim.chainTick(250)?.didWork;
    expect(woke).toBe(true);
  });

  it('returns null from further ticks once finished', () => {
    const { sim } = runRound({ level: 5, flipCap: 2 });
    expect(sim.isFinished()).toBe(true);
    expect(sim.chainTick(1000)).toBeNull();
    expect(sim.conwayTick()).toBeNull();
  });

  it('lowering the flip cap sweeps newly-capped tiles into the death ledger', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 5, flipCap: 10 });
    // Accumulate some damage first.
    for (let i = 0; i < 100; i++) sim.chainTick(250);
    const damaged = sim.getMetrics().flipActive;
    expect(damaged).toBeGreaterThan(0);

    // Dropping the cap to 1 makes every damaged tile dead (subject to the
    // "leave at least 2 alive" guard).
    const sweep = sim.setFlipCap(1);
    expect(sweep).not.toBeNull();
    expect(sweep.didWork).toBe(true);
    expect(sweep.deaths.length).toBeGreaterThan(0);
    expect(sweep.deaths.length).toBeLessThanOrEqual(52);
    expect(new Set(sweep.deaths.map((d) => d.gridId)).size).toBe(sweep.deaths.length);
    expect(sim.getMetrics().deadTiles).toBeGreaterThanOrEqual(sweep.deaths.length);
  });

  it('raising the flip cap never triggers a sweep', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 3, flipCap: 5 });
    for (let i = 0; i < 50; i++) sim.chainTick(250);
    expect(sim.setFlipCap(20)).toBeNull();
  });

  it('changing chaos level mid-round preserves the death ledger', () => {
    const sim = createChaosSim({ cubies: makeCubies(3), size: 3, chaosLevel: 5, flipCap: 2 });
    let deadBefore = 0;
    for (let i = 0; i < 500 && deadBefore < 10; i++) {
      sim.chainTick(250);
      deadBefore = sim.getMetrics().deadTiles;
    }
    expect(deadBefore).toBeGreaterThanOrEqual(10);

    sim.setChaosLevel(2);
    expect(sim.getMetrics().deadTiles).toBe(deadBefore);
    expect(sim.getAliveCount()).toBe(54 - sim.getDeadTileSet().size);
  });
});
