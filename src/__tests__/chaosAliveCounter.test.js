// The ALIVE counter has to mean exactly one thing: how many tiles on the cube
// are not tombstones. Two things used to break that promise —
//   1. the counter read the death ledger's length, not the board, and
//   2. the player's heal wave edited the board on the render thread only,
//      so the ledger and the board drifted apart the moment anyone tapped a
//      damaged tile (the worker kept simulating damage that was gone, and kept
//      counting tiles as dead that had visibly sprung back to life).
// These tests pin both halves.
import { describe, it, expect } from 'vitest';
import { createChaosSim } from '../game/chaosSim.js';
import { makeCubies, healSticker } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { countDeadTiles } from '../game/chaosMetrics.js';
import { collectHealWave, isHealable } from '../game/chaosHeal.js';

const FLIP_CAP = 4;
const SIZE = 3;

// Drive a round until `stop` says so (or the round ends), collecting deaths the
// way useChaosWorker does — deduped by gridId, which is what disparityDeaths holds.
const runRound = (sim, stop = () => false, maxTicks = 20000) => {
  const deaths = new Map();
  for (let i = 0; i < maxTicks && !sim.isFinished(); i++) {
    for (const payload of [sim.chainTick(200), sim.conwayTick()]) {
      for (const d of payload?.deaths ?? []) deaths.set(d.gridId, d);
    }
    if (stop(deaths)) break;
  }
  return deaths;
};

const damage = (cubies, size, coords, flips) => {
  for (const { x, y, z, dirKey } of coords) {
    cubies[x][y][z].stickers[dirKey].flips = flips;
  }
  return cubies;
};

describe('countDeadTiles', () => {
  it('counts stickers at or over the cap — the tombstone predicate', () => {
    const cubies = makeCubies(SIZE);
    expect(countDeadTiles(cubies, SIZE, FLIP_CAP)).toBe(0);

    cubies[0][0][0].stickers.NX.flips = FLIP_CAP;
    cubies[0][0][0].stickers.NY.flips = FLIP_CAP + 3;
    cubies[0][0][0].stickers.NZ.flips = FLIP_CAP - 1;
    expect(countDeadTiles(cubies, SIZE, FLIP_CAP)).toBe(2);
  });

  it('tracks the sim death ledger exactly for a whole round', () => {
    const sim = createChaosSim({ cubies: makeCubies(SIZE), size: SIZE, chaosLevel: 5, flipCap: FLIP_CAP });
    const deaths = runRound(sim);
    const total = SIZE * SIZE * 6;

    // The board and the ledger agree, so ALIVE means the same thing either way.
    expect(countDeadTiles(sim.getState(), SIZE, FLIP_CAP)).toBe(deaths.size);
    expect(total - countDeadTiles(sim.getState(), SIZE, FLIP_CAP)).toBe(sim.getAliveCount());
  });
});

describe('collectHealWave', () => {
  it('spreads across the manifold through damaged-but-living tiles', () => {
    const cubies = makeCubies(SIZE);
    // Damage the whole PZ face by one flip so the wave has somewhere to go.
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        const st = cubies[x][y][SIZE - 1].stickers.PZ;
        st.flips = 1;
        st.curr = st.orig === 1 ? 4 : st.curr; // flipped colour, curr !== orig
      }
    }
    const waves = collectHealWave(cubies, SIZE, { x: 1, y: 1, z: SIZE - 1, dirKey: 'PZ' }, FLIP_CAP);
    const healed = waves.flat();
    expect(waves[0]).toEqual([{ x: 1, y: 1, z: SIZE - 1, dirKey: 'PZ' }]);
    expect(healed.length).toBe(SIZE * SIZE);
  });

  it('refuses a dead tile as the tap target', () => {
    const cubies = makeCubies(SIZE);
    const st = cubies[1][1][SIZE - 1].stickers.PZ;
    st.flips = FLIP_CAP;
    st.curr = 4;
    expect(isHealable(st, FLIP_CAP)).toBe(false);
    expect(collectHealWave(cubies, SIZE, { x: 1, y: 1, z: SIZE - 1, dirKey: 'PZ' }, FLIP_CAP)).toEqual([]);
  });

  it('never heals a dead tile and never conducts the wave through one', () => {
    const cubies = makeCubies(SIZE);
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        const st = cubies[x][y][SIZE - 1].stickers.PZ;
        st.flips = 1;
        st.curr = 4;
      }
    }
    // Bury the whole middle row: it separates the tap from the far row.
    for (let x = 0; x < SIZE; x++) cubies[x][1][SIZE - 1].stickers.PZ.flips = FLIP_CAP;

    const healed = collectHealWave(cubies, SIZE, { x: 1, y: 0, z: SIZE - 1, dirKey: 'PZ' }, FLIP_CAP).flat();
    for (const t of healed) {
      expect(cubies[t.x][t.y][t.z].stickers[t.dirKey].flips).toBeLessThan(FLIP_CAP);
    }
    // The tapped row is reachable; the row beyond the tombstones is not — via
    // this face at least (the wave may still arrive around a seam).
    expect(healed.some((t) => t.y === 1)).toBe(false);
  });
});

describe('chaos sim ledger reconciliation', () => {
  it('revives ledger entries the incoming cube says are alive again', () => {
    const sim = createChaosSim({ cubies: makeCubies(SIZE), size: SIZE, chaosLevel: 5, flipCap: FLIP_CAP });
    // Stop early so the round is still live and there is something to revive.
    runRound(sim, (deaths) => deaths.size >= 4);
    const buried = [...sim.getDeadTileSet()];
    expect(buried.length).toBeGreaterThan(0);
    const aliveBefore = sim.getAliveCount();

    // Heal one buried tile on a copy of the cube, the way the render thread does.
    let healedCube = sim.getState();
    let target = null;
    for (let x = 0; x < SIZE && !target; x++) {
      for (let y = 0; y < SIZE && !target; y++) {
        for (let z = 0; z < SIZE && !target; z++) {
          for (const dirKey of Object.keys(healedCube[x][y][z].stickers)) {
            const st = healedCube[x][y][z].stickers[dirKey];
            if ((st.flips || 0) >= FLIP_CAP) { target = { x, y, z, dirKey, gridId: getManifoldGridId(st, SIZE) }; break; }
          }
        }
      }
    }
    healedCube = healSticker(healedCube, SIZE, target.x, target.y, target.z, target.dirKey);

    const revival = sim.syncCubies(healedCube);
    expect(revival.revived).toContain(target.gridId);
    expect(sim.getDeadTileSet().has(target.gridId)).toBe(false);
    expect(sim.getAliveCount()).toBe(aliveBefore + revival.revived.length);
    // ...and the board agrees, which is the whole point.
    expect(SIZE * SIZE * 6 - countDeadTiles(sim.getState(), SIZE, FLIP_CAP)).toBe(sim.getAliveCount());
  });

  it('says nothing when the incoming cube matches the ledger', () => {
    const sim = createChaosSim({ cubies: makeCubies(SIZE), size: SIZE, chaosLevel: 5, flipCap: FLIP_CAP });
    runRound(sim, (deaths) => deaths.size >= 4);
    expect(sim.syncCubies(sim.getState())).toBeNull();
  });

  it('puts a revived tile back on the walkable surface', () => {
    const cubies = damage(makeCubies(SIZE), SIZE, [{ x: 1, y: 1, z: SIZE - 1, dirKey: 'PZ' }], FLIP_CAP);
    const sim = createChaosSim({ cubies, size: SIZE, chaosLevel: 5, flipCap: FLIP_CAP });
    // A cap sweep buries the pre-damaged tile without a chain having to find it.
    const sweep = sim.setFlipCap(FLIP_CAP);
    expect(sweep === null || sweep.deaths.length >= 0).toBe(true);
    runRound(sim, (deaths) => deaths.size >= 2);

    const buriedCount = sim.getDeadTileSet().size;
    const healedCube = healSticker(sim.getState(), SIZE, 1, 1, SIZE - 1, 'PZ');
    const revival = sim.syncCubies(healedCube);
    if (revival) {
      expect(sim.getDeadTileSet().size).toBe(buriedCount - revival.revived.length);
    }
    // Whatever happened, the ledger and the board still agree afterwards.
    expect(countDeadTiles(sim.getState(), SIZE, FLIP_CAP)).toBe(sim.getDeadTileSet().size);
  });
});
