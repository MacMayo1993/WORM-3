// The first strike: the player picks where chaos ignites, the sim starts there
// (found by grid id, so the unshuffle turns cannot move it off target), and every
// hop after it still rolls fresh randomness — the same pick never replays the
// same round.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { createChaosSim } from '../game/chaosSim.js';
import { chaosStormEvents } from '../game/chaosStormEvents.js';
import { ignitionTileAt, ignitionCandidates, randomIgnitionTile } from '../game/chaosIgnition.js';
import { makeRng } from '../levels/antipodalRandomizer.js';

const SIZE = 3;
const CAP = 8;

afterEach(() => vi.restoreAllMocks());

describe('ignition tiles', () => {
  it('names a tile by slot and grid id, and refuses a face with no sticker', () => {
    const cubies = makeCubies(SIZE);
    const tile = ignitionTileAt(cubies, SIZE, 1, 1, 2, 'PZ');
    expect(tile).toEqual({ x: 1, y: 1, z: 2, dirKey: 'PZ', gridId: getManifoldGridId(cubies[1][1][2].stickers.PZ, SIZE) });
    expect(ignitionTileAt(cubies, SIZE, 1, 1, 1, 'PZ')).toBeNull();
  });

  it('offers every live sticker, and never a spent one', () => {
    const cubies = makeCubies(SIZE);
    expect(ignitionCandidates(cubies, SIZE, CAP)).toHaveLength(SIZE * SIZE * 6);
    cubies[1][1][2].stickers.PZ.flips = CAP;
    const live = ignitionCandidates(cubies, SIZE, CAP);
    expect(live).toHaveLength(SIZE * SIZE * 6 - 1);
    expect(live.some((t) => t.x === 1 && t.y === 1 && t.z === 2 && t.dirKey === 'PZ')).toBe(false);
  });

  it('"Surprise me" draws across the whole cube', () => {
    const cubies = makeCubies(SIZE);
    const rand = makeRng('surprise');
    const faces = new Set();
    for (let i = 0; i < 200; i++) faces.add(randomIgnitionTile(cubies, SIZE, CAP, rand).dirKey);
    expect(faces.size).toBe(6);
    expect(randomIgnitionTile([], SIZE, CAP)).toBeNull();
  });
});

// Run the sim to a fixed number of chain ticks and record the flips it made.
const history = (sim, ticks = 40) => {
  const flips = [];
  for (let i = 0; i < ticks && !sim.isFinished(); i++) {
    for (const p of [sim.chainTick(200), sim.conwayTick()]) for (const f of p?.flips ?? []) flips.push(f.join(','));
  }
  return flips;
};

describe('chaos sim ignition', () => {
  it('flips the picked tile first, and says so for the hero strike', () => {
    const cubies = makeCubies(SIZE);
    const tile = ignitionTileAt(cubies, SIZE, 0, 2, 2, 'PZ');
    const sim = createChaosSim({ cubies, size: SIZE, chaosLevel: 3, flipCap: CAP, ignition: tile });
    const first = sim.chainTick(200);
    expect(first.ignition).toEqual([0, 2, 2, 'PZ']);
    expect(first.flips[0]).toEqual([0, 2, 2, 'PZ']);
    // Its antipodal twin flips with it — they are one point.
    const state = sim.getState();
    const twin = findAntipodalStickerByGrid(buildManifoldGridMap(state, SIZE), state[0][2][2].stickers.PZ, SIZE);
    expect(state[0][2][2].stickers.PZ.flips).toBeGreaterThan(0);
    expect(twin.sticker.flips).toBeGreaterThan(0);
    // Consumed once.
    expect(sim.chainTick(200)?.ignition ?? null).toBeNull();
  });

  it('finds the pick by grid id after the unshuffle turns move it', () => {
    const cubies = makeCubies(SIZE);
    const tile = ignitionTileAt(cubies, SIZE, 2, 2, 2, 'PZ');
    const sim = createChaosSim({ cubies, size: SIZE, chaosLevel: 3, flipCap: CAP, ignition: tile });
    sim.rotateSlice({ axis: 'col', sliceIndex: 2, dir: 1 });
    const first = sim.chainTick(200);
    const [x, y, z, dirKey] = first.ignition;
    expect(`${x},${y},${z},${dirKey}`).not.toBe('2,2,2,PZ');
    expect(getManifoldGridId(sim.getState()[x][y][z].stickers[dirKey], SIZE)).toBe(tile.gridId);
  });

  it('ignites as it always has when the pick is spent or unknown', () => {
    const cubies = makeCubies(SIZE);
    const sim = createChaosSim({ cubies, size: SIZE, chaosLevel: 3, flipCap: CAP, ignition: { gridId: 'M9-999' } });
    const first = sim.chainTick(200);
    expect(first.ignition).toBeNull();
    expect(first.flips.length).toBeGreaterThan(0);
  });

  it('the same pick plays out differently round to round', () => {
    const run = (seed) => {
      vi.spyOn(Math, 'random').mockImplementation(makeRng(seed));
      const cubies = rotateSliceCubies(makeCubies(SIZE), SIZE, 'row', 1, 1);
      const sim = createChaosSim({ cubies, size: SIZE, chaosLevel: 4, flipCap: CAP, ignition: ignitionTileAt(cubies, SIZE, 1, 1, 2, 'PZ') });
      const out = history(sim);
      vi.restoreAllMocks();
      return out;
    };
    const a = run('round-a');
    const b = run('round-b');
    // Both open on the pick…
    expect(a[0]).toBe('1,1,2,PZ');
    expect(b[0]).toBe('1,1,2,PZ');
    // …and diverge from there.
    expect(a).not.toEqual(b);
  });
});

describe('storm events', () => {
  it('turns the landing into a hero strike on the live tile', () => {
    const cubies = makeCubies(SIZE);
    const map = buildManifoldGridMap(cubies, SIZE);
    const { events } = chaosStormEvents({ ignition: [0, 2, 2, 'PZ'], flips: [[0, 2, 2, 'PZ']] }, cubies, SIZE, map, CAP);
    expect(events[0]).toMatchObject({ type: 'ignition', to: { x: 0, y: 2, z: 2, dirKey: 'PZ' } });
    expect(events[1]).toMatchObject({ type: 'charge', kind: 'birth' });
  });
});
