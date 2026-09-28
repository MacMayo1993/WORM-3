import { getAllSurfaceTiles } from './surfaceTiles.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from './constants.js';

export const ORB_SHOWER_DURATION = 10;
export const ORB_SHOWER_INTERVAL = 0.65;
export const ORB_SHOWER_CAP = 144;
export const DEMO_ORB_GOAL = 12;
let orbSequence = 0;
const keyOf = p => `${p.x},${p.y},${p.z},${p.dirKey}`;
const SHOWER_FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

export function orbShowerCapacity(size, baseOrbs) {
  // Classic can already fill most of a small board. Reserve a complete six-face
  // wave above that permanent supply, while keeping the usual large-board cap.
  return Math.min(6 * size * size - 1,
    Math.max(baseOrbs + SHOWER_FACES.length, Math.min(ORB_SHOWER_CAP, Math.floor(6 * size * size * 0.65))));
}

// Identity survives layer rotations, while a respawn on the same tile gets a
// fresh entrance. Never reset the sequence between runs or demo lessons.
export const makeGrowthOrb = (tile, extra = {}) => ({ ...tile, type: 'apple', spawnId: `orb-${++orbSequence}`, ...extra });

export function startOrbShower(sim, ctx) {
  sim.orbShowerT = ORB_SHOWER_DURATION;
  sim.orbShowerDelay = 0;
  ctx.onOrbShowerState?.(ORB_SHOWER_DURATION);
  ctx.feel('specialSpawn');
}

// One orb per face per wave. Avoid the body, head, other pickups and open pads;
// never fall back to an occupied tile when a small board fills up.
export function showerWave(sim, size, cubies) {
  const baseOrbs = sim.powerups.reduce((count, orb) => count + !orb.shower, 0);
  const cap = orbShowerCapacity(size, baseOrbs);
  if (sim.powerups.length >= cap) return false;
  const occupied = new Set([...sim.powerups, ...sim.specials, sim.pos].map(keyOf));
  if (sim.prevTile) occupied.add(keyOf(sim.prevTile));
  const bodyTiles = Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING));
  for (let i = 0; i < bodyTiles; i++) occupied.add(ttAt(sim.tileTrail, i));
  const faces = new Map();
  for (const tile of getAllSurfaceTiles(size)) {
    const sticker = cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
    if (!sticker || sticker.curr !== sticker.orig || occupied.has(keyOf(tile))) continue;
    if (!faces.has(tile.dirKey)) faces.set(tile.dirKey, []);
    faces.get(tile.dirKey).push(tile);
  }
  const before = sim.powerups.length;
  const firstFace = sim.orbShowerFace ?? 0;
  for (let offset = 0; offset < SHOWER_FACES.length; offset++) {
    if (sim.powerups.length >= cap) break;
    const index = (firstFace + offset) % SHOWER_FACES.length;
    const tiles = faces.get(SHOWER_FACES[index]);
    if (!tiles?.length) continue;
    sim.powerups.push(makeGrowthOrb(tiles[Math.floor(sim.rand() * tiles.length)], { shower: true }));
    // Resume after the last face actually served. Even one newly available slot
    // per wave rotates through the cube rather than restarting at PX forever.
    sim.orbShowerFace = (index + 1) % SHOWER_FACES.length;
  }
  return sim.powerups.length > before;
}

export function tickOrbShower(sim, delta, size, ctx) {
  if (sim.phase !== 'crawling' || sim.orbShowerT <= 0) return;
  const dt = Math.min(delta, sim.orbShowerT);
  sim.orbShowerDelay -= dt;
  let changed = false;
  while (sim.orbShowerDelay < 0) {
    changed = showerWave(sim, size, ctx.getCubies()) || changed;
    sim.orbShowerDelay += ORB_SHOWER_INTERVAL;
  }
  sim.orbShowerT = Math.max(0, sim.orbShowerT - dt);
  if (sim.orbShowerT < 1e-8) sim.orbShowerT = 0;
  if (changed) ctx.onPowerupsChanged(sim.powerups.slice());
  if (sim.orbShowerT === 0) ctx.onOrbShowerState?.(0);
}
