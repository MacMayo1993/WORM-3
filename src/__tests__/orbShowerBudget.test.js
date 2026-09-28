import { expect, it } from 'vitest';
import { characterOrbCount } from '../worm/characterAbilities.js';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { makeGrowthOrb, orbShowerCapacity, showerWave, startOrbShower } from '../worm/healerWorm/orbSpawning.js';

const faces = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
function board(size, perFace) {
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const tiles = getAllSurfaceTiles(size).filter(p => tileKey(p) !== tileKey(sim.pos));
  sim.powerups = faces.flatMap(face => tiles.filter(p => p.dirKey === face).slice(0, perFace).map(p => makeGrowthOrb(p)));
  sim.rand = () => 0;
  return { sim, cubies: makeCubies(size), tiles };
}

it('reserves a full six-face shower above the twelve Classic orbs on a 2×2 Easy board', () => {
  const count = characterOrbCount(8, 'classic');
  expect(count).toBe(12);
  const { sim, cubies } = board(2, 2);
  expect(sim.powerups).toHaveLength(count);
  expect(orbShowerCapacity(2, count)).toBe(18);
  expect(showerWave(sim, 2, cubies)).toBe(true);
  const rain = sim.powerups.filter(p => p.shower);
  expect(rain).toHaveLength(6);
  expect(new Set(rain.map(p => p.dirKey))).toEqual(new Set(faces));
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(18);
  expect(showerWave(sim, 2, cubies)).toBe(false);
});

it('rotates a single available shower slot through every face, including across a refresh', () => {
  const { sim, cubies, tiles } = board(3, 5);
  const occupied = new Set([...sim.powerups, sim.pos].map(tileKey));
  for (const face of faces.slice(0, 5)) {
    sim.powerups.push(makeGrowthOrb(tiles.find(p => p.dirKey === face && !occupied.has(tileKey(p))), { shower: true }));
  }
  expect(sim.powerups).toHaveLength(orbShowerCapacity(3, 30) - 1);
  const served = [];
  for (let i = 0; i < 12; i++) {
    if (i === 3) startOrbShower(sim, { feel() {} });
    expect(showerWave(sim, 3, cubies)).toBe(true);
    const orb = sim.powerups.pop(); // collect just this bonus, leaving one slot
    served.push(orb.dirKey);
    expect(orb.shower).toBe(true);
  }
  expect(served).toEqual([...faces, ...faces]);
  resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
  expect(sim.orbShowerFace).toBe(0);
});

it('skips fully occupied or flipped faces without overlapping pickups or losing the next face', () => {
  const { sim, cubies, tiles } = board(2, 2);
  for (const tile of tiles.filter(p => p.dirKey === 'PX')) cubies[tile.x][tile.y][tile.z].stickers.PX.curr = 0;
  showerWave(sim, 2, cubies);
  expect(sim.powerups.filter(p => p.shower).map(p => p.dirKey)).toEqual(faces.slice(1));
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
});
