// src/game/chaosIgnition.js
//
// The first strike of a chaos round: the tile where the storm ignites.
//
// Chaos used to ignite wherever a coin toss in the worker landed, so the player
// never saw a round's opening as theirs and one round blurred into the next. Now
// they pick it — tap a tile after the scramble, or let "Surprise me" draw one —
// and the simulation starts its first chain on that tile. Every later hop still
// rolls fresh randomness, so the same pick never plays out the same way twice;
// what the pick decides is where the damage starts spreading from.
//
// A tile is carried by its manifold grid id as well as its slot: the unshuffle
// turns begin the moment the round goes live and move the sticker, and the grid
// id is what finds it again.
//
// Pure: no React, no Three.

import { getManifoldGridId } from './gridIds.js';

const DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

/** The tile at a slot and face, or null if that face carries no sticker. */
export function ignitionTileAt(cubies, size, x, y, z, dirKey) {
  const st = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!st) return null;
  return { x, y, z, dirKey, gridId: getManifoldGridId(st, size) };
}

/**
 * Every tile a strike can land on: stickers still below the flip cap. A fresh
 * round has none spent, but a replayed board might.
 */
export function ignitionCandidates(cubies, size, cap = Infinity) {
  const out = [];
  if (!cubies || cubies.length !== size) return out;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x]?.[y]?.[z];
        if (!c) continue;
        for (const dirKey of DIRS) {
          const st = c.stickers?.[dirKey];
          if (st && (st.flips || 0) < cap) out.push({ x, y, z, dirKey, gridId: getManifoldGridId(st, size) });
        }
      }
    }
  }
  return out;
}

/** "Surprise me": a uniformly random live tile, or null on an empty board. */
export function randomIgnitionTile(cubies, size, cap = Infinity, rand = Math.random) {
  const all = ignitionCandidates(cubies, size, cap);
  if (!all.length) return null;
  return all[Math.min(all.length - 1, Math.floor(rand() * all.length))];
}
