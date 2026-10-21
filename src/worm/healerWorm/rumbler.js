// src/worm/healerWorm/rumbler.js
//
// The Rumbler: something under the tiles (docs/features/flip-cube-main-design.md
// §5). Two tiers, both pure presentation:
//
//   R1 ambience   a slow heave runs along the worm's lane (its row or column) and
//                 along the cross line through its head, coming up from behind,
//                 passing under the head and running on ahead.
//   R2 telegraph  while a slice turn is armed it moves to every threatened layer
//                 and circles that layer's belt the way the layer will turn,
//                 faster and harder as the warning ramps (rotationClock).
//
// ── Belts ────────────────────────────────────────────────────────────────────
// A slice's surface is a closed belt of 4N cells across four faces. A crest sits
// at a belt coordinate s0 and lifts the cells near it by a·sech²(d/λ), where d is
// the WRAPPED distance min(|s − s0|, L − |s − s0|), so a crest crosses the walk's
// start without a seam. The belt is walked with getNextSurfacePosition, the same
// rule the worm crawls by, so a crest follows the lane round every cube edge.
//
// ── Contract ─────────────────────────────────────────────────────────────────
// Nothing here writes to the simulation. The model is seeded (no Math.random), so
// tests replay it exactly. It advances only by the dt it is handed, clamped, and
// the caller hands it nothing while the game is held (pause, countdown, tunnels,
// rescue, focus beats, death, victory), so resuming never catches up. R2 reads the
// clock's axis, every slice index and the turn directions; it never picks a slice
// of its own and never touches when the turn dispatches. Reduced motion gets a
// still tint on the belts and nothing moves or lifts.

import { getNextSurfacePosition } from '../wormLogic.js';
import { FACE_NORMALS, DIR_FORWARD } from './constants.js';

const MOVES = ['up', 'down', 'left', 'right'];
const coordOf = (tile, axis) => (axis === 'col' ? tile.x : axis === 'row' ? tile.y : tile.z);
const keyOf = tile => `${tile.x},${tile.y},${tile.z},${tile.dirKey}`;
const AXIS_VEC = { col: [1, 0, 0], row: [0, 1, 0], depth: [0, 0, 1] };

/** Crest height at full strength, world units: a heave the eye catches, under the worm's 0.08 ride height. */
export const RUMBLE_LIFT = 0.04;
/** At most this many cells are physically lifted at once; the band carries the rest. */
export const MAX_RUMBLE_TILES = 8;
/** Boards this large get the band only, no lifted cells. */
export const RUMBLE_BIG_BOARD = 8;
// Crest width, in cells.
const CREST_WIDTH = 0.9;
// R1: how far behind the head a heave rises, and how far ahead it dies away.
const BEHIND = 6;
const AHEAD = 4;
// R1: seconds a heave takes from rising behind the head to dying ahead of it.
const HEAVE_SECONDS = 3.2;
// Crossfade when the worm turns onto a new lane.
const RETIRE_SECONDS = 0.35;
const MAX_DT = 0.1;

const _rings = new Map();

/**
 * The 4N surface cells round one slice, in walking order, cached per
 * (size, axis, index). `spin` is the sign of a +1 turn of that layer along the
 * walk: a positive turn carries cell i toward cell i + spin.
 */
export function beltRing(size, axis, index) {
  const cacheKey = `${size}:${axis}:${index}`;
  const hit = _rings.get(cacheKey);
  if (hit) return hit;
  const L = 4 * size;
  const start = axis === 'col' ? { x: index, y: 0, z: size - 1, dirKey: 'PZ' }
    : axis === 'row' ? { x: 0, y: index, z: size - 1, dirKey: 'PZ' }
      : { x: size - 1, y: 0, z: index, dirKey: 'PX' };
  let ring = null;
  for (const first of MOVES) {
    const tiles = [start], moves = [first];
    let tile = start, move = first, ok = true;
    for (let i = 1; i < L; i++) {
      const next = getNextSurfacePosition(tile, move, size);
      if (!next || coordOf(next, axis) !== index) { ok = false; break; }
      tile = { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey };
      move = next.moveDir ?? move;
      tiles.push(tile); moves.push(move);
    }
    if (!ok) continue;
    const back = getNextSurfacePosition(tile, move, size);
    if (!back || keyOf(back) !== keyOf(start)) continue;
    const keys = tiles.map(keyOf);
    const indexOf = new Map(keys.map((key, i) => [key, i]));
    // Which way a positive turn of this layer carries the walk: compare the
    // turn's tangent at the first cell (axis × position) with the walk's forward.
    const k = (size - 1) / 2, a = AXIS_VEC[axis], f = DIR_FORWARD[start.dirKey][first];
    const p = [start.x - k, start.y - k, start.z - k];
    const t = [a[1] * p[2] - a[2] * p[1], a[2] * p[0] - a[0] * p[2], a[0] * p[1] - a[1] * p[0]];
    const spin = t[0] * f[0] + t[1] * f[1] + t[2] * f[2] >= 0 ? 1 : -1;
    ring = { size, axis, index, L, tiles, keys, indexOf, moves, spin };
    break;
  }
  _rings.set(cacheKey, ring);
  return ring;
}

/** The lane (the slice the worm crawls along) and the cross line through its head. */
export function laneBelts(tile, moveDir) {
  const n = FACE_NORMALS[tile.dirKey], f = DIR_FORWARD[tile.dirKey]?.[moveDir];
  if (!n || !f) return null;
  const c = [n.y * f[2] - n.z * f[1], n.z * f[0] - n.x * f[2], n.x * f[1] - n.y * f[0]];
  const axisOf = v => (Math.abs(v[0]) > 0.5 ? 'col' : Math.abs(v[1]) > 0.5 ? 'row' : 'depth');
  const lane = axisOf(c), cross = axisOf(f);
  return { lane: { axis: lane, index: coordOf(tile, lane) }, cross: { axis: cross, index: coordOf(tile, cross) } };
}

/** Wrapped distance along a belt of length L. */
export function wrappedDistance(s, s0, L) {
  const d = Math.abs((((s - s0) % L) + L) % L);
  return Math.min(d, L - d);
}

const sech2 = x => { const c = Math.cosh(x); return 1 / (c * c); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh Rumbler. Everything it does is drawn from `seed`. */
export function makeRumbler(seed = 0x5eed) {
  const rand = rng(seed);
  const place = () => ({ ok: false, axis: null, index: 0, ring: null, i: 0, along: 1, pos: 0 });
  return {
    rand,
    heaves: [],
    rest: { lane: 0.8 + rand() * 1.2, cross: 2.2 + rand() * 2 },
    passes: 0,          // crests that have rolled under the head (feedback counts these)
    // The head's belts, re-derived only when it moves to another cell or turns.
    track: { valid: false, x: 0, y: 0, z: 0, dirKey: '', moveDir: '', size: 0, lane: place(), cross: place() },
    bands: [],          // rumbleBands' output, reused frame to frame
  };
}

// Where the head is on its two belts. On its lane it is moving: sim.pos is the
// step's destination, so at interpT 0 the head is still a cell back. The cross
// line runs through the head's cell and the head is not travelling along it. The
// belts are looked up only when the head changes cell or heading.
function trackHead(state, size, head) {
  const track = state.track, tile = head?.tile;
  if (!tile) { track.valid = false; return; }
  if (!track.valid || track.x !== tile.x || track.y !== tile.y || track.z !== tile.z || track.dirKey !== tile.dirKey
      || track.moveDir !== head.moveDir || track.size !== size) {
    track.valid = true;
    track.x = tile.x; track.y = tile.y; track.z = tile.z; track.dirKey = tile.dirKey;
    track.moveDir = head.moveDir; track.size = size;
    const belts = laneBelts(tile, head.moveDir);
    for (const kind of ['lane', 'cross']) {
      const place = track[kind], belt = belts?.[kind];
      const ring = belt ? beltRing(size, belt.axis, belt.index) : null;
      const i = ring?.indexOf.get(keyOf(tile));
      place.ok = i !== undefined;
      if (!place.ok) continue;
      place.axis = belt.axis; place.index = belt.index; place.ring = ring; place.i = i;
      if (kind === 'lane') {
        const ahead = getNextSurfacePosition(tile, head.moveDir, size);
        place.along = ahead && ring.keys[(i + 1) % ring.L] === keyOf(ahead) ? 1 : -1;
      } else place.along = 1;
    }
  }
  const back = 1 - Math.min(1, Math.max(0, head.interpT ?? 1));
  track.lane.pos = track.lane.i - track.lane.along * back;
  track.cross.pos = track.cross.i;
}

function retire(heave) {
  if (!heave.retiring) heave.retiring = 1e-6;
}

function runningHeave(state, kind, axis, index) {
  for (const heave of state.heaves) {
    if (heave.kind === kind && !heave.retiring && (axis == null || (heave.axis === axis && heave.index === index))) return heave;
  }
  return null;
}

function startHeave(state, kind, place, along) {
  const rel = -Math.min(BEHIND, place.ring.L / 2 - 1);
  state.heaves.push({ kind, axis: place.axis, index: place.index, ring: place.ring, rel, along, crest: place.pos, amp: 0,
    fade: 1, retiring: 0, sweep: (-rel + Math.min(AHEAD, place.ring.L / 2 - 1)) / HEAVE_SECONDS, passed: false, turn: 1 });
}

/**
 * Advance the Rumbler by dt. `input`:
 *   size, head: { tile, moveDir, interpT } (the live head), live (false while the
 *   game is held: then nothing advances and running heaves fade), reduced (reduced
 *   motion), clock: rotationClock ({ armed, axis, sliceIndices, sliceDirs, warning }).
 * Nothing is allocated on a frame where no heave starts.
 */
export function stepRumbler(state, input, dt) {
  const { size, head, live, reduced, clock } = input;
  const step = live && !reduced ? Math.min(MAX_DT, Math.max(0, dt)) : 0;
  const fadeStep = Math.min(MAX_DT, Math.max(0, dt));

  // ── R1: the worm's lane and its cross line ────────────────────────────────
  trackHead(state, size, head);
  const { track } = state;
  for (const heave of state.heaves) {
    if (heave.kind === 'threat') continue;
    const place = track.valid ? track[heave.kind] : null;
    // The worm turned onto another lane: let this crest settle where it is.
    if (!place?.ok || place.ring !== heave.ring) retire(heave);
  }
  if (live && !reduced && track.valid) {
    for (const kind of ['lane', 'cross']) {
      const place = track[kind];
      if (!place.ok || runningHeave(state, kind)) continue;
      state.rest[kind] -= step;
      if (state.rest[kind] > 0) continue;
      // The lane's heave comes up behind the worm; the cross line's from either side.
      startHeave(state, kind, place, kind === 'lane' ? place.along : (state.rand() < 0.5 ? 1 : -1));
      state.rest[kind] = kind === 'lane' ? 1.4 + state.rand() * 2.2 : 2.6 + state.rand() * 2.6;
    }
  }

  // ── R2: every threatened layer, circling the way it will turn ─────────────
  const armed = !!(clock?.armed && clock.axis && clock.sliceIndices?.length);
  for (const heave of state.heaves) {
    if (heave.kind === 'threat' && !(armed && heave.axis === clock.axis && clock.sliceIndices.includes(heave.index))) retire(heave);
  }
  if (armed) {
    for (let i = 0; i < clock.sliceIndices.length; i++) {
      const index = clock.sliceIndices[i];
      const ring = beltRing(size, clock.axis, index);
      if (!ring) continue;
      const turn = (clock.sliceDirs?.[i] ?? 1) < 0 ? -1 : 1;
      const existing = runningHeave(state, 'threat', clock.axis, index);
      if (existing) { existing.turn = turn; continue; }
      state.heaves.push({ kind: 'threat', axis: clock.axis, index, ring, rel: 0, along: 1,
        crest: state.rand() * ring.L, amp: 0, fade: 1, retiring: 0, sweep: 0, passed: false, turn });
    }
  }

  // ── Advance every crest ───────────────────────────────────────────────────
  const warning = armed ? Math.min(1, Math.max(0, clock.warning ?? 0)) : 0;
  for (const heave of state.heaves) {
    if (heave.retiring) {
      heave.retiring += fadeStep;
      heave.fade = 1 - smooth(0, RETIRE_SECONDS, heave.retiring);
      continue;
    }
    if (heave.kind === 'threat') {
      // Faster and harder as the warning ramps, the way the layer will turn.
      heave.crest += step * heave.turn * heave.ring.spin * (1.6 + 9 * warning * warning);
      heave.crest = ((heave.crest % heave.ring.L) + heave.ring.L) % heave.ring.L;
      heave.amp = reduced ? 0 : 0.45 + 0.55 * warning;
      continue;
    }
    const before = heave.rel;
    heave.rel += step * heave.sweep;
    const limit = Math.min(AHEAD, heave.ring.L / 2 - 1);
    const rise = -Math.min(BEHIND, heave.ring.L / 2 - 1);
    heave.amp = smooth(rise, rise + 2, heave.rel) * (1 - smooth(limit - 2, limit, heave.rel));
    // Head-relative: the crest rides up behind the head, under it, then away ahead.
    heave.crest = track[heave.kind].pos + heave.along * heave.rel;
    if (!heave.passed && before < 0 && heave.rel >= 0) { heave.passed = true; state.passes++; }
    if (heave.rel >= limit) retire(heave);
  }
  // Drop the crests that have finished fading, in place.
  let kept = 0;
  for (let r = 0; r < state.heaves.length; r++) {
    const heave = state.heaves[r];
    if (!(heave.retiring && heave.fade <= 0)) state.heaves[kept++] = heave;
  }
  state.heaves.length = kept;
  return state;
}

/**
 * The cells the crests lift this frame, at most `max` (none on big boards or under
 * reduced motion), as tile key → lift in world units, written into `out`.
 */
export function collectRumbleLifts(state, size, out, { reduced = false, max = MAX_RUMBLE_TILES } = {}) {
  out.clear();
  if (reduced || size >= RUMBLE_BIG_BOARD || max <= 0) return out;
  for (const heave of state.heaves) {
    const strength = heave.amp * heave.fade;
    if (strength <= 0.02) continue;
    const { ring } = heave;
    const from = Math.floor(heave.crest - 2.5), to = Math.ceil(heave.crest + 2.5);
    for (let s = from; s <= to; s++) {
      const i = ((s % ring.L) + ring.L) % ring.L;
      const lift = RUMBLE_LIFT * strength * sech2(wrappedDistance(i, heave.crest, ring.L) / CREST_WIDTH);
      if (lift < RUMBLE_LIFT * 0.12) continue;
      const key = ring.keys[i];
      if ((out.get(key) ?? 0) < lift) out.set(key, lift);
    }
  }
  if (out.size > max) {
    // Rare (two crests crossing): keep the highest.
    const keep = [...out].sort((a, b) => b[1] - a[1]).slice(0, max);
    out.clear();
    for (const [key, lift] of keep) out.set(key, lift);
  }
  return out;
}

function putBand(bands, n, axis, index, crest, strength, still, kind) {
  const band = bands[n] ?? (bands[n] = {});
  band.axis = axis; band.index = index; band.crest = crest; band.strength = strength; band.still = still; band.kind = kind;
  return n + 1;
}

/**
 * The belts to draw: one band per crest (and, under reduced motion, a still tint on
 * the lane and the threatened layers). The array and its objects are reused.
 */
export function rumbleBands(state, input) {
  const bands = state.bands;
  let n = 0;
  if (input.reduced) {
    trackHead(state, input.size, input.head);
    if (state.track.valid && state.track.lane.ok && input.live) n = putBand(bands, n, state.track.lane.axis, state.track.lane.index, 0, 0.35, true);
    if (input.clock?.armed && input.clock.axis) {
      for (const index of input.clock.sliceIndices ?? []) n = putBand(bands, n, input.clock.axis, index, 0, 0.35, true);
    }
  } else {
    for (const heave of state.heaves) {
      const strength = heave.amp * heave.fade;
      if (strength > 0.01) n = putBand(bands, n, heave.axis, heave.index, heave.crest, strength, false, heave.kind);
    }
  }
  bands.length = n;
  return bands;
}

/** Whether the game is running, in the sense the Rumbler contract freezes on. */
export function rumbleLive(store, worm) {
  if (!store.wormAlive || store.wormPaused || store.wormGamePhase !== 'active') return false;
  if (store.wormStoryLevel && !store.wormStoryStarted) return false;
  if (store.wormJumpRescueActive || worm.jumpRescueHeld?.current) return false;
  if (worm.phase?.current !== 'crawling' || worm.padFlight?.current) return false;
  if ((worm.cutFocusT?.current ?? 0) > 0 || (worm.elementalFocusT?.current ?? 0) > 0 || (worm.healPauseT?.current ?? 0) > 0) return false;
  return true;
}

/** What Mobi says the first time a crest rolls under the worm (design §6.3). */
export const RUMBLE_FIRST_LINE = "Feel that rumble? Something's under the tiles. Keep moving!";
