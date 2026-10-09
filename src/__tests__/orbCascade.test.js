import { expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, stepWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { queueOrbCascade, tickOrbCascades, CASCADE_CAP, CASCADE_REWARDS } from '../worm/healerWorm/orbCascade.js';
import { makeGrowthOrb } from '../worm/healerWorm/orbSpawning.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { ttPush } from '../worm/circularBuffers.js';

function setup(size = 5) {
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const cubies = makeCubies(size);
  const ctx = { getCubies: () => cubies, onPowerupsChanged: vi.fn(), isPaused: () => true };
  const origin = { x: 0, y: 0, z: size - 1, dirKey: 'PZ' };
  const tick = () => tickOrbCascades(sim, 0.2, size, ctx);
  return { sim, cubies, ctx, origin, tick };
}

it.each(Object.keys(CASCADE_REWARDS))('delivers the full %s reward as four-orb waves with unique identities', kind => {
  const { sim, origin, tick, ctx } = setup();
  queueOrbCascade(sim, kind, origin);
  tick();
  expect(sim.powerups).toHaveLength(4);
  expect(sim.powerups.every(p => p.dirKey === origin.dirKey && p.cascade.age === 0)).toBe(true);
  for (let i = 0; i < 20; i++) tick();
  expect(sim.powerups).toHaveLength(CASCADE_REWARDS[kind]);
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
  expect(new Set(sim.powerups.map(p => p.spawnId)).size).toBe(sim.powerups.length);
  expect(sim.orbCascades).toHaveLength(0);
  expect(ctx.onPowerupsChanged).toHaveBeenCalledTimes(Math.ceil(CASCADE_REWARDS[kind] / 4));
});

it('retains the entire reward on a full 2x2 and resumes as tiles become free', () => {
  const { sim, origin, tick } = setup(2);
  const all = getAllSurfaceTiles(2);
  sim.powerups = all.filter(p => tileKey(p) !== tileKey(sim.pos)).map(p => makeGrowthOrb(p));
  queueOrbCascade(sim, 'bomb', origin);
  tick();
  expect(sim.orbCascades[0].remaining).toBe(12);
  sim.powerups.splice(0, 3);
  tick();
  expect(sim.powerups.filter(p => p.cascade)).toHaveLength(3);
  expect(sim.orbCascades[0].remaining).toBe(9);
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
});

it('avoids body, head, previous tile, bombs, specials, existing food and flipped tiles', () => {
  const { sim, cubies, origin, tick } = setup();
  const tiles = getAllSurfaceTiles(5).filter(p => tileKey(p) !== tileKey(sim.pos));
  sim.powerups = [makeGrowthOrb(tiles[0])];
  sim.specials = [tiles[1]];
  sim.prevTile = tiles[2];
  sim.orbCascadeBombTiles = [tiles[3]];
  ttPush(sim.tileTrail, tileKey(tiles[4]));
  const flipped = tiles[5];
  cubies[flipped.x][flipped.y][flipped.z].stickers[flipped.dirKey].curr = 0;
  queueOrbCascade(sim, 'bomb', origin);
  for (let i = 0; i < 20; i++) tick();
  const blocked = new Set([sim.pos, ...tiles.slice(0, 6)].map(tileKey));
  expect(sim.powerups.filter(p => p.cascade).every(p => !blocked.has(tileKey(p)))).toBe(true);
});

it('caps live reward pickups without dropping multi-heal balances', () => {
  const { sim, origin, tick } = setup();
  for (let i = 0; i < 8; i++) queueOrbCascade(sim, 'surround', origin);
  for (let i = 0; i < 40; i++) tick();
  expect(sim.powerups).toHaveLength(CASCADE_CAP);
  expect(sim.orbCascades.reduce((n, p) => n + p.remaining, 0)).toBe(72 - CASCADE_CAP);
  sim.powerups.splice(0, 8);
  for (let i = 0; i < 4; i++) tick();
  expect(sim.powerups).toHaveLength(CASCADE_CAP);
  expect(sim.orbCascades.reduce((n, p) => n + p.remaining, 0)).toBe(16);
});

it('freezes during pause/transit/death and clears queued rewards on retry', () => {
  const { sim, origin, tick, ctx } = setup();
  queueOrbCascade(sim, 'surround', origin);
  stepWormSim(sim, 0.05, 5, ctx);
  expect(sim.powerups).toHaveLength(0);
  sim.phase = 'tunnel'; tick();
  expect(sim.powerups).toHaveLength(0);
  sim.phase = 'crawling'; tick();
  const age = sim.powerups[0].cascade.age;
  sim.alive = false; tick(); queueOrbCascade(sim, 'bomb', origin);
  expect(sim.powerups[0].cascade.age).toBe(age);
  expect(sim.orbCascades).toHaveLength(1);
  resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
  expect(sim.orbCascades).toEqual([]);
  expect(sim.powerups).toEqual([]);
});
