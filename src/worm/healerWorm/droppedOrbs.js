// src/worm/healerWorm/droppedOrbs.js
// Sonic's rings, for a cut tail. When a hazard shears off part of the body, the
// orbs it carried burst out of the severed beads and land on nearby tiles as
// dropped orbs. The worm has DROPPED_ORB_LIFETIME seconds of crawling to take them
// back; they blink as time runs out, then crumble away with the opening cube's
// dissolve (introDissolve.js).
//
// The sim owns the authoritative list (sim.droppedOrbs): which tile each orb sits
// on, what it gives back and how long it has left. Everything here is pure: the
// sim functions take the sim and a ctx, and the motion helpers take plain numbers,
// so the renderer (DroppedOrbs.jsx) and the tests read the same values.
import { collectManifoldRing } from '../wormLogic.js';
import { parseTileKey } from '../wormHelpers.js';
import { ORB_SEGMENT_GROWTH } from './constants.js';

/** Seconds of crawling a dropped orb waits to be picked back up. */
export const DROPPED_ORB_LIFETIME = 5;
/** Seconds the crumble takes once an orb expires (render only; it can no longer be taken). */
export const DROPPED_ORB_DISSOLVE = 1.0;
/** Seconds before expiry that the orb starts to blink. */
export const DROPPED_ORB_BLINK = 1.6;
/** Orbs one cut can scatter; a longer loss packs several orbs into each. */
export const MAX_DROPS_PER_CUT = 12;
/** Dropped orbs on the board at once; the oldest crumble first. */
export const MAX_DROPPED_ORBS = 24;
/** How far (in manifold steps) the burst can throw an orb from the cut. */
export const DROP_MAX_RADIUS = 4;
/** Seconds of the burst's flight from the severed bead to the tile, bounce included. */
export const DROP_FLIGHT = 0.75;
/** Seconds between orbs leaving the burst, so the ring fans out rather than popping at once. */
export const DROP_STAGGER = 0.025;

let dropSequence = 0;

/**
 * Pack the lost orbs into at most `max` drops, keeping neighbours together so a
 * drop gives back a run of the body. Each drop is a list of { faceId, color, segments }:
 * `segments` is what that orb's loss actually cost the body (cutWormTail), so
 * taking it back never grows the worm past its length before the cut.
 */
export function groupLostOrbs(faceIds, colors, max = MAX_DROPS_PER_CUT, segments = null) {
  const count = Math.max(faceIds?.length ?? 0, colors?.length ?? 0);
  if (count === 0) return [];
  const groups = Math.min(count, max);
  const out = [];
  for (let g = 0; g < groups; g++) {
    const start = Math.floor((g * count) / groups), end = Math.floor(((g + 1) * count) / groups);
    const payload = [];
    for (let i = start; i < end; i++) {
      payload.push({ faceId: faceIds?.[i] ?? 0, color: colors?.[i] ?? '#ffdd44', segments: segments?.[i] ?? ORB_SEGMENT_GROWTH });
    }
    out.push(payload);
  }
  return out;
}

const tileKeyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const _ring = new Set();
const _inner = new Set();

/**
 * Tiles for the burst, nearest rings first, shuffled within each ring so the orbs
 * fan out around the cut instead of lining up. `blocked(key)` rules a tile out.
 * @returns {Array<{x,y,z,dirKey}>} at most `count` tiles (fewer on a crowded board)
 */
export function chooseDropTiles(origin, size, count, blocked, rand = Math.random) {
  const out = [];
  if (!origin || count <= 0) return out;
  // The cut tile itself is the burst's centre: orbs fly away from it.
  _inner.clear();
  _inner.add(tileKeyOf(origin));
  for (let radius = 1; radius <= DROP_MAX_RADIUS && out.length < count; radius++) {
    collectManifoldRing(origin.x, origin.y, origin.z, origin.dirKey, size, radius, _ring);
    const shell = [];
    for (const key of _ring) {
      if (_inner.has(key)) continue;
      if (!blocked(key)) shell.push(key);
    }
    for (const key of _ring) _inner.add(key);
    // Fisher–Yates on the ring, then take what is still needed.
    for (let i = shell.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shell[i], shell[j]] = [shell[j], shell[i]];
    }
    for (const key of shell) {
      if (out.length >= count) break;
      const t = parseTileKey(key, {});
      if (t) out.push({ x: t.x, y: t.y, z: t.z, dirKey: t.dirKey });
    }
  }
  return out;
}

/**
 * Scatter a cut's lost orbs around it.
 * @param {object} drop { origin:{x,y,z,dirKey}, faceIds:number[], colors:string[], froms?:number[][], at?:number[] }
 *   `froms[i]` is the world point lost orb i bursts out of (its severed bead); `at`
 *   is the fallback (the cut point).
 * @returns {number} orbs placed
 */
export function scatterDroppedOrbs(sim, size, ctx, drop) {
  if (!sim.alive || !drop?.origin) return 0;
  const groups = groupLostOrbs(drop.faceIds, drop.colors, MAX_DROPS_PER_CUT, drop.segments);
  if (!groups.length) return 0;
  const blocked = new Set();
  const block = t => t && blocked.add(tileKeyOf(t));
  block(sim.pos);
  for (const p of sim.powerups) block(p);
  for (const s of sim.specials) block(s);
  for (const d of sim.droppedOrbs) block(d);
  // Keep them off the surviving body, where only the head could reach them anyway.
  const trail = sim.tileTrail;
  for (let i = 0; i < trail.count; i++) blocked.add(trail.buf[(trail.head + i) % trail.capacity]);
  const cubies = ctx.getCubies?.();
  const isBlocked = key => {
    if (blocked.has(key)) return true;
    const t = parseTileKey(key, {});
    // Flipped tiles are tunnel mouths and raised pads: an orb there would hover out of reach.
    const sticker = t && cubies?.[t.x]?.[t.y]?.[t.z]?.stickers?.[t.dirKey];
    return !!sticker && sticker.curr !== sticker.orig;
  };
  const tiles = chooseDropTiles(drop.origin, size, groups.length, isBlocked, sim.rand);
  // A crowded board packs what did not fit into the drops that did.
  for (let g = tiles.length; g < groups.length && tiles.length; g++) groups[g % tiles.length].push(...groups[g]);
  let seen = 0;
  for (let i = 0; i < tiles.length; i++) {
    const payload = groups[i];
    const from = drop.froms?.[seen] ?? drop.at ?? null;
    seen += payload.length;
    sim.droppedOrbs.push({
      ...tiles[i],
      id: `drop-${++dropSequence}`,
      ttl: DROPPED_ORB_LIFETIME,
      payload,
      color: payload[0].color,
      from,
      delay: i * DROP_STAGGER,
    });
  }
  // Over the board cap, the oldest go first — and crumble, not vanish.
  while (sim.droppedOrbs.length > MAX_DROPPED_ORBS) expireDrop(sim, sim.droppedOrbs.shift());
  if (tiles.length) ctx.feel?.('orbScatter');
  return tiles.length;
}

function expireDrop(sim, drop) {
  sim.pendingDropDissolves.push({ id: drop.id, x: drop.x, y: drop.y, z: drop.z, dirKey: drop.dirKey, color: drop.color });
}

/** Age every dropped orb by `delta` seconds of crawling; expired ones leave to crumble. */
export function ageDroppedOrbs(sim, delta) {
  const drops = sim.droppedOrbs;
  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].ttl -= delta;
    if (drops[i].ttl <= 0) expireDrop(sim, drops.splice(i, 1)[0]);
  }
}

/**
 * Take every dropped orb whose tile is the head's (or inside `reach`, the magnet's
 * ring). Returns the taken drops, already removed from the board.
 */
export function takeDroppedOrbsAt(sim, headKey, reach = null) {
  const drops = sim.droppedOrbs;
  if (!drops.length) return null;
  let taken = null;
  for (let i = drops.length - 1; i >= 0; i--) {
    const key = tileKeyOf(drops[i]);
    if (reach ? !reach.has(key) : key !== headKey) continue;
    (taken ??= []).push(drops.splice(i, 1)[0]);
  }
  return taken;
}

// ─── Render motion ──────────────────────────────────────────────────────────
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Where a dropped orb is `t` seconds after it burst out: a high arc from its
 * severed bead to its tile with one small bounce on landing, like a scattered ring.
 * `from`/`to` are world points, `n` the landing tile's outward normal.
 * @returns {number} 0→1 flight progress (1 once it rests on the tile)
 */
export function dropFlightInto(out, from, to, n, t) {
  const p = clamp01(t / DROP_FLIGHT);
  if (!from || p >= 1) {
    out[0] = to[0]; out[1] = to[1]; out[2] = to[2];
    return 1;
  }
  // 0 → 0.72: the throw. 0.72 → 1: one bounce a fifth as tall.
  const throwEnd = 0.72;
  const span = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  let lift;
  if (p < throwEnd) {
    const u = p / throwEnd;
    const e = 1 - (1 - u) * (1 - u) * 0.35 - 0.65 * (1 - u); // quick out, settles in
    out[0] = from[0] + (to[0] - from[0]) * e;
    out[1] = from[1] + (to[1] - from[1]) * e;
    out[2] = from[2] + (to[2] - from[2]) * e;
    lift = (0.55 + span * 0.35) * 4 * u * (1 - u);
  } else {
    const u = (p - throwEnd) / (1 - throwEnd);
    out[0] = to[0]; out[1] = to[1]; out[2] = to[2];
    lift = (0.55 + span * 0.35) * 0.2 * 4 * u * (1 - u);
  }
  out[0] += n[0] * lift; out[1] += n[1] * lift; out[2] += n[2] * lift;
  return p;
}

/** Sonic-style warning flicker: steady until the last DROPPED_ORB_BLINK seconds, then faster and faster. */
export function dropVisible(ttl, time, reducedMotion = false) {
  if (reducedMotion || ttl > DROPPED_ORB_BLINK) return true;
  const urgency = 1 - clamp01(ttl / DROPPED_ORB_BLINK);
  const rate = 5 + 13 * urgency; // flashes per second
  return Math.sin(time * rate * Math.PI * 2) > -0.35;
}

/** 0→1 crumble front `t` seconds after expiry (linear, like the intro's cube). */
export const dropDissolveProgress = t => clamp01(t / DROPPED_ORB_DISSOLVE);
