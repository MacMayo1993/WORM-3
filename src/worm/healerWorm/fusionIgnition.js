// src/worm/healerWorm/fusionIgnition.js
//
// The instant two elements fuse, the fusion goes off around the head: each recipe
// lays its own ground (a ring of steam, obsidian, frost, a garden of pads...) and hits
// the enemies in reach in its own way. The ongoing rule then runs for the wash
// (elementalFusion.js). The ignition lands while the claim camera pulls out, so the
// player sees the cube change as the banner names the recipe.
//
// Pure: the sim decides what changes; the mode resolves the posted burst (kind
// 'ignite') against enemies and draws the flames. Nothing here reads the clock.

import { addElementalPatch, postFusionBurst, FUSION } from './elementalGameplay.js';
import { springSlamTiles } from './jumpLanding.js';
import { computeBlastTiles } from './bombs.js';
import { collectManifoldRing } from '../wormLogic.js';

const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const tileOf = key => {
  const [x, y, z, dirKey] = key.split(',');
  return { x: +x, y: +y, z: +z, dirKey };
};

/** Seconds of the ignition speed surge (Slipstream). */
export const IGNITION_SURGE_T = 1.5;

// Where an ignition reaches, from the head tile. A ring of depth n is every tile within
// n surface steps (depth 1 is the head and its four neighbours).
const ring = (head, size, depth) => [...collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, depth)];
const plus = (head, size, reach) => computeBlastTiles({ tile: head }, size, reach).arms.map(arm => arm[arm.length - 1]).filter(Boolean).map(keyOf);
const corners = (head, size) => {
  const near = new Set(computeBlastTiles({ tile: head }, size, 1).keys);
  return [...springSlamTiles(head, size)].filter(k => !near.has(k));
};
// The eight tiles around the head (the 3x3 without its centre).
const around = (head, size) => [...springSlamTiles(head, size)].filter(k => k !== keyOf(head));
const cross = (head, size, reach) => [...computeBlastTiles({ tile: head }, size, reach).keys];

/**
 * Every recipe's ignition. `boost` is its instant effect on the worm (momentum, a
 * dash, a surge); `ground` lays the patches and returns the tile keys it reaches; `hit` is what happens to enemies in those tiles ('freeze', 'kill', 'burn'
 * or 'stun'); `flames` puts the blast's flames up over them; `text` is the banner's
 * one-line description of the moment.
 */
export const IGNITIONS = Object.freeze({
  steam: { text: 'A ring of steam bursts out: bombs in it go out.', hit: 'stun',
    ground: (sim, head, size) => lay(sim, ring(head, size, 2), 'fire') },
  quench: { text: 'The ground around you sets into obsidian.', hit: 'stun',
    ground: (sim, head, size) => lay(sim, ring(head, size, 2), 'fire') },
  coldfire: { text: 'A ring of blue fire flash-freezes everything near you.', hit: 'freeze',
    ground: (sim, head, size) => lay(sim, ring(head, size, 2), 'fire') },
  plasma: { text: 'A plasma flash: enemies next to you are vaporised.', hit: 'kill', flames: true,
    ground: (sim, head, size) => lay(sim, ring(head, size, 1), 'fire') },
  firestorm: { text: 'A cross of fire three tiles long erupts from you.', hit: 'burn', flames: true,
    ground: (sim, head, size) => lay(sim, cross(head, size, 3), 'fire') },
  meltdown: { text: 'You flare into a dash and melt the ground around you.', hit: 'burn',
    boost: sim => { sim.meltdownT = FUSION.meltdownDashT * 2; },
    ground: (sim, head, size) => lay(sim, ring(head, size, 1), 'fire', { melt: true }) },
  wildfire: { text: 'The 3×3 around you goes up in flame.', hit: 'kill', flames: true,
    ground: (sim, head, size) => lay(sim, [...springSlamTiles(head, size)], 'fire') },
  emberseed: { text: 'Four seed-pads drop at your corners, ready to burst.', hit: 'stun',
    ground: (sim, head, size) => lay(sim, corners(head, size), 'grass') },
  bloom: { text: 'A garden of spring pads springs up all around you.', hit: 'stun',
    ground: (sim, head, size) => lay(sim, around(head, size), 'grass') },
  geyser: { text: 'A geyser pad erupts under you at full momentum: jump!', hit: 'stun',
    boost: sim => { sim.waterMomentum = 1; },
    ground: (sim, head) => lay(sim, [keyOf(head)], 'grass') },
  'ski-jump': { text: 'Ramps grow two tiles out on every side.', hit: 'stun',
    ground: (sim, head, size) => lay(sim, plus(head, size, 2), 'grass') },
  thunderpad: { text: 'A charged pad sparks under you: jump for a rocket leap.', hit: 'stun',
    ground: (sim, head) => lay(sim, [keyOf(head)], 'grass', { charged: true }) },
  grounded: { text: 'Lightning grounds into four charged pads around you.', hit: 'kill',
    ground: (sim, head, size) => lay(sim, plus(head, size, 2), 'grass', { charged: true }) },
  'frozen-wake': { text: 'Everything near you freezes over.', hit: 'freeze',
    ground: (sim, head, size) => lay(sim, ring(head, size, 2), 'frost') },
  frostbloom: { text: 'A frost flower opens around an iced pad under you.', hit: 'freeze',
    ground: (sim, head, size) => [...lay(sim, around(head, size), 'frost'), ...lay(sim, [keyOf(head)], 'grass')] },
  cryostorm: { text: 'A blizzard: frost two tiles deep, enemies frozen solid.', hit: 'freeze',
    ground: (sim, head, size) => lay(sim, ring(head, size, 2), 'frost') },
  slipstream: { text: 'Full momentum and a surge of speed, right now.', hit: 'stun',
    boost: sim => { sim.waterMomentum = 1; sim.surgeT = IGNITION_SURGE_T; },
    ground: () => [] },
  conductor: { text: 'A bolt grounds through you and fries enemies within two tiles.', hit: 'kill',
    boost: sim => { sim.waterMomentum = 1; },
    ground: (sim, head, size) => ring(head, size, 2) },
  static: { text: 'You crackle with charge: an instant speed burst.', hit: 'stun',
    boost: sim => { sim.staticT = FUSION.staticBurstT; },
    ground: (sim, head, size) => ring(head, size, 1) },
  current: { text: 'You fill with charge at full momentum; nearby enemies are struck.', hit: 'kill',
    boost: sim => { sim.waterMomentum = 1; },
    ground: (sim, head, size) => ring(head, size, 2) },
});

function lay(sim, keys, type, extra = null) {
  for (const key of keys) addElementalPatch(sim, tileOf(key), type, extra);
  return keys;
}

/**
 * Set off the ignition of the fusion now active, around the head. Posts
 * a fusion burst ({ seq, kind: 'ignite', recipe, hit, flames, tile, tiles }) for
 * the mode to resolve once. Without a board size (some tests) only the non-spatial
 * part (momentum, bursts) happens and no tiles are reached.
 * @returns {object|null} the burst posted, or null for an unknown recipe
 */
export function igniteFusion(sim, recipeId, size = 0) {
  const ignition = IGNITIONS[recipeId];
  if (!ignition) return null;
  const head = { x: sim.pos.x, y: sim.pos.y, z: sim.pos.z, dirKey: sim.pos.dirKey };
  ignition.boost?.(sim);
  const tiles = size ? ignition.ground(sim, head, size) : [];
  return postFusionBurst(sim, { kind: 'ignite', recipe: recipeId, hit: ignition.hit, flames: !!ignition.flames, tile: head, tiles });
}
