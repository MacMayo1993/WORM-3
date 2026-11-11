import { describe, it, expect } from 'vitest';
import { spreadCells, pickSpread } from '../worm/healerWorm/spawnSpread.js';
import { stageStory, routeCell, storyOrbCap } from '../worm/story/runtime.js';
import { storyElementTile } from '../worm/story/mastery.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { STORY_ORB_ROUTES } from '../worm/story/worlds.js';
import { makeCubies } from '../game/cubeState.js';

// A face's cells in the tile's own two axes.
const cellOf = tile => tile.dirKey.endsWith('X') ? [tile.y, tile.z] : tile.dirKey.endsWith('Y') ? [tile.x, tile.z] : [tile.x, tile.y];
// How many of a face's four quarters hold at least one of `cells`.
const quarters = (cells, size) => new Set(cells.map(([a, b]) => (a * 2 >= size ? 1 : 0) + (b * 2 >= size ? 2 : 0))).size;

describe('spreadCells', () => {
  it('orders every other cell of the face, each once', () => {
    const order = spreadCells(6, [[2, 2]]);
    expect(order).toHaveLength(35);
    expect(new Set(order.map(String)).size).toBe(35);
    expect(order.map(String)).not.toContain('2,2');
  });
  it('reaches all four quarters at once instead of running along one edge', () => {
    for (const size of [6, 8, 10, 15]) {
      const first = spreadCells(size, [[Math.floor(size / 2), Math.floor(size / 2)]]).slice(0, 4);
      expect(quarters(first, size), `size ${size}`).toBe(4);
      // The raster fill this replaced put its first cells on row 0.
      expect(first.every(([, b]) => b === 0)).toBe(false);
    }
  });
});

describe('pickSpread', () => {
  const row = Array.from({ length: 8 }, (_, x) => ({ x, y: 0, z: 7, dirKey: 'PZ' }));
  it('is the plain draw with nothing to avoid', () => {
    expect(pickSpread(row, [], () => 0.5)).toBe(row[4]);
    expect(pickSpread([], [row[0]])).toBeNull();
  });
  it('takes the drawn tile farthest from what is already down', () => {
    const draws = [0.05, 0.2, 0.95, 0.4, 0.3]; // tiles 0, 1, 7, 3, 2
    let i = 0;
    expect(pickSpread(row, [row[0], row[1]], () => draws[i++ % draws.length])).toBe(row[7]);
  });
  it('lays free-play orbs across all six faces of a big cube', () => {
    const sim = makeWormSim(10);
    for (let run = 0; run < 5; run++) {
      resetWormSim(sim, 10, { orbCount: 40, wormholeInterval: 10 });
      const faces = {};
      for (const orb of sim.powerups) faces[orb.dirKey] = (faces[orb.dirKey] ?? 0) + 1;
      expect(Object.keys(faces)).toHaveLength(6);
      // 40 orbs are about 7 a face: no face is left with a stray one or two.
      expect(Math.min(...Object.values(faces))).toBeGreaterThanOrEqual(3);
      // And no two orbs share a tile.
      expect(new Set(sim.powerups.map(orb => `${orb.x},${orb.y},${orb.z},${orb.dirKey}`)).size).toBe(40);
    }
  });
});

describe('Story orb layout', () => {
  it('scales each route onto the face at every size', () => {
    for (const size of [2, 3, 4, 5, 6, 8, 10, 15]) for (const cells of Object.values(STORY_ORB_ROUTES)) {
      for (const cell of cells) for (const value of routeCell(size, cell)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(size);
      }
    }
    // The authored footprint is unchanged where it was authored.
    expect(routeCell(5, [1, 3])).toEqual([1, 3]);
    // A 15×15 used to hold the pattern in cells 5–9; it now spans 2–12.
    expect(routeCell(15, [0, 4])).toEqual([2, 12]);
  });
  it('holds more orbs a face on the bigger boards, inside the food budget', () => {
    expect([5, 7, 8, 10, 15].map(storyOrbCap)).toEqual([10, 10, 11, 13, 15]);
    expect(6 * storyOrbCap(15)).toBeLessThanOrEqual(90);
  });
  it('stocks every face across its quarters on boards from 5×5, on every level', () => {
    for (const level of WORM_STORY_LEVELS) {
      const size = level.cubeSize ?? 5;
      if (size < 5) continue;
      const sim = makeWormSim(size);
      stageStory(sim, size, level);
      const faces = {};
      for (const orb of sim.powerups) (faces[orb.dirKey] ??= []).push(cellOf(orb));
      for (const [dirKey, cells] of Object.entries(faces)) {
        if (cells.length < 6) continue; // a face mostly taken by mouths or the body
        // An authored route may itself leave one quarter open (a channel, a lane);
        // the bigger boards have quota to spare and fill all four.
        expect(quarters(cells, size), `level ${level.id} ${dirKey}`).toBeGreaterThanOrEqual(size >= 8 ? 4 : 3);
      }
    }
  });
});

describe('Story element placement', () => {
  it('stands in from the rim of the neighbouring face when it can', () => {
    for (const size of [5, 6, 8, 10]) {
      const cubies = makeCubies(size), mid = Math.floor(size / 2);
      const sim = { pos: { x: mid, y: mid, z: size - 1, dirKey: 'PZ' } };
      const tile = storyElementTile(sim, size, cubies);
      expect(tile.dirKey).not.toBe('PZ');
      const [a, b] = cellOf(tile);
      expect(Math.min(a, size - 1 - a, b, size - 1 - b), `size ${size}`).toBeGreaterThanOrEqual(size >= 8 ? 2 : 1);
    }
  });
});
