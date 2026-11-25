// src/components/intro/introTouch.js
// The opening answers a tap: a tapped sticker flips to its antipodal colour and its
// twin, straight through the cube, flips with it a beat later, so the first thing a
// new player learns by doing is the game's one rule. Taps are kept as start times
// on the intro's own clock, so the flips replay with it and pause with it.
import { TILES } from './introTopology.js';
import { ramp } from './introChoreography.js';
import { DISSOLVE_START } from './introTiming.js';

export const TAP_FLIP_TIME = 0.42;
/** The twin answers a beat after the tapped tile, as the flip crosses the core. */
export const TWIN_DELAY = 0.16;
/** Taps stop counting once the ending starts. */
export const TAP_UNTIL = DISSOLVE_START;
const MAX_TAPS = 8;

const keyOf = (position, faceIndex) => `${position.join(',')}:${faceIndex}`;
const INDEX = new Map(TILES.map((tile, i) => [keyOf(tile.position, tile.faceIndex), i]));
/** Each tile's antipodal twin: the opposite cell, the opposite face. */
export const TWIN_OF = TILES.map(tile => INDEX.get(keyOf(tile.position.map(v => -v), tile.faceIndex ^ 1)));

export const createTaps = () => TILES.map(() => []);

/** Records a tap on tile `index` at intro time `t`; returns the tiles it flips. */
export function tapTile(taps, index, t) {
  if (!(t < TAP_UNTIL) || !taps[index]) return [];
  const twin = TWIN_OF[index];
  for (const [tile, at] of [[index, t], [twin, t + TWIN_DELAY]]) {
    const list = taps[tile];
    if (list.length >= MAX_TAPS) list.shift();
    list.push(at);
  }
  return [index, twin];
}

/**
 * A tile's extra turn from taps at intro time `t`: `angle` (π per flip),
 * `halves` (flips past their midpoint, when the colour changes), `lift` (it pops
 * off the face while turning) and `last` (the latest flip's start, for its portal).
 * Reduced motion flips the colour at once, without the turn.
 */
export function tapFlip(list, t, reducedMotion = false) {
  let angle = 0, halves = 0, lift = 0, last = -Infinity;
  for (const at of list) {
    if (t < at) continue;
    const u = reducedMotion ? 1 : ramp(t, at, at + TAP_FLIP_TIME);
    angle += reducedMotion ? 0 : Math.PI * u;
    if (u >= 0.5) halves++;
    lift += 0.32 * Math.sin(Math.PI * u);
    last = Math.max(last, at);
  }
  return { angle, halves, lift, last };
}
