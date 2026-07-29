import { describe, it, expect } from 'vitest';
import { randomUnflippedTile, getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { makeCubies } from '../game/cubeState.js';
import { FLIP_CAP, ANTIPODAL_COLOR } from '../utils/constants.js';

const SIZE = 3;

/** Flip a single tile `n` times in place, exactly as flipStickerPair would. */
const flipTimes = (cubies, { x, y, z, dirKey }, n) => {
  const st = cubies[x][y][z].stickers[dirKey];
  for (let i = 0; i < n; i++) {
    st.curr = ANTIPODAL_COLOR[st.curr];
    st.flips = Math.min(FLIP_CAP, (st.flips ?? 0) + 1);
  }
  return cubies;
};

describe('wormhole spawn tile selection', () => {
  it('picks a pristine surface tile on a fresh cube', () => {
    const cubies = makeCubies(SIZE);
    const tile = randomUnflippedTile(cubies, SIZE);
    expect(tile).toBeTruthy();
    const st = cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey];
    expect(st.curr).toBe(st.orig);
    expect(st.flips).toBe(0);
  });

  it('never picks a tile that is currently flipped', () => {
    const cubies = makeCubies(SIZE);
    const all = getAllSurfaceTiles(SIZE);
    for (const t of all) flipTimes(cubies, t, 1);
    expect(randomUnflippedTile(cubies, SIZE)).toBeNull();
  });

  it('never picks a DEAD tile, even though it is showing its original colour', () => {
    // This is the one that mattered. FLIP_CAP is even, so a tile at the cap has
    // toggled back to its own colour: a curr === orig test alone says "unflipped"
    // and hands the spawner a tile that flipStickerPair then refuses to touch —
    // burning the whole spawn interval and producing no wormhole at all.
    const cubies = makeCubies(SIZE);
    const all = getAllSurfaceTiles(SIZE);
    const dead = all[0];
    flipTimes(cubies, dead, FLIP_CAP);
    const st = cubies[dead.x][dead.y][dead.z].stickers[dead.dirKey];
    expect(st.curr).toBe(st.orig);      // looks untouched…
    expect(st.flips).toBe(FLIP_CAP);    // …but is dead

    for (let i = 0; i < 400; i++) {
      const pick = randomUnflippedTile(cubies, SIZE);
      expect(`${pick.x},${pick.y},${pick.z},${pick.dirKey}`)
        .not.toBe(`${dead.x},${dead.y},${dead.z},${dead.dirKey}`);
    }
  });

  it('never picks a tile carrying an even, non-zero flip count', () => {
    // Same trap short of the cap: curr === orig again, but the tile has history.
    // Choosing it walks its flip count toward the cap, which is how tiles died.
    const cubies = makeCubies(SIZE);
    const all = getAllSurfaceTiles(SIZE);
    const used = all[5];
    flipTimes(cubies, used, 2);
    for (let i = 0; i < 400; i++) {
      const pick = randomUnflippedTile(cubies, SIZE);
      expect(`${pick.x},${pick.y},${pick.z},${pick.dirKey}`)
        .not.toBe(`${used.x},${used.y},${used.z},${used.dirKey}`);
    }
  });

  it('honours the exclusion list (the worm\'s own tile)', () => {
    const cubies = makeCubies(SIZE);
    const here = { x: 1, y: 1, z: 2, dirKey: 'PZ' };
    for (let i = 0; i < 200; i++) {
      const pick = randomUnflippedTile(cubies, SIZE, [here]);
      expect(`${pick.x},${pick.y},${pick.z},${pick.dirKey}`)
        .not.toBe(`${here.x},${here.y},${here.z},${here.dirKey}`);
    }
  });

  it('returns null rather than flipping something it should not', () => {
    // A saturated board must skip the interval, not fall back to any tile at all.
    // The old fallback did exactly that, which is how already-flipped and dead
    // tiles got picked up again.
    const cubies = makeCubies(SIZE);
    for (const t of getAllSurfaceTiles(SIZE)) flipTimes(cubies, t, FLIP_CAP);
    expect(randomUnflippedTile(cubies, SIZE)).toBeNull();
  });

  it('covers every surface tile of a 7×7 and nothing interior', () => {
    const tiles = getAllSurfaceTiles(7);
    expect(tiles).toHaveLength(6 * 49);
    const cubies = makeCubies(7);
    for (const t of tiles) {
      expect(cubies[t.x][t.y][t.z].stickers[t.dirKey]).toBeTruthy();
    }
  });
});
