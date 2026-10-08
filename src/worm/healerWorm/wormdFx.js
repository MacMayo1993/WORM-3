// src/worm/healerWorm/wormdFx.js
// The WORM'D hit beat, as pure maths: which word a hit shouts, how its letters
// slam in, the starburst and shockwave behind them, the spark spray, and the
// severed tail that pops off the cube bead by bead. ThunkEffect and SeveredTail
// (impactFx.jsx) only read these; nothing here writes back to the sim.
import * as THREE from 'three';
import { shAt } from '../circularBuffers.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from './constants.js';
import { bodyDistanceAt, bodyPathHeadInto } from './sliceBodyPath.js';
import { tunnelBodyDistance } from './tunnelBodyFit.js';

// ─── Per-hit identity ─────────────────────────────────────────────────────────
// word/sub  — the shout and the small caption under it
// fill/ink  — letter face and its outline
// burst     — the starburst plate behind the word
// sparks    — fallback spark colours when the hit has no carried orbs to spray
// duration  — seconds the beat stays on screen
// fatal     — bigger slam, a longer hold and a darker plate
export const WORMD_STYLES = {
  cut: {
    word: "WORM'D!", sub: 'TAIL LOST', fill: '#ffe14d', ink: '#b3120a', burst: '#ff5a36',
    sparks: ['#ffdd44', '#ff8800'], duration: 2.0, fatal: false
  },
  sliced: {
    word: "WORM'D", sub: 'SLICED', fill: '#ffffff', ink: '#8f0c0c', burst: '#e11d2a',
    sparks: ['#ffdd44', '#ff4444', '#ffffff'], duration: 4.2, fatal: true
  },
  'blast-cut': {
    word: 'KA-BLAM!', sub: 'TAIL LOST', fill: '#ffe14d', ink: '#7c2d12', burst: '#ff7b2e',
    sparks: ['#ff7b2e', '#ffd23f'], duration: 2.0, fatal: false
  },
  blasted: {
    word: 'KA-BOOM!', sub: "WORM'D", fill: '#fff3c4', ink: '#7c2d12', burst: '#f97316',
    sparks: ['#ff7b2e', '#ffd23f', '#ffffff'], duration: 4.2, fatal: true
  },
  'struck-cut': {
    word: 'ZAP-CUT!', sub: 'TAIL LOST', fill: '#f3ecff', ink: '#312e81', burst: '#8b5cf6',
    sparks: ['#c4b5fd', '#ffffff'], duration: 2.0, fatal: false
  },
  struck: {
    word: 'ZAPPED!', sub: "WORM'D", fill: '#ffffff', ink: '#312e81', burst: '#7c3aed',
    sparks: ['#c4b5fd', '#a5b4fc', '#ffffff'], duration: 4.2, fatal: true
  },
  bite: {
    word: 'CHOMP!', sub: 'TAIL BITE', fill: '#ffe14d', ink: '#7f1d1d', burst: '#f87171',
    sparks: ['#ff4444', '#ffdd44'], duration: 4.2, fatal: true
  },
  void: {
    word: "VOID'D", sub: 'LOST IN THE VOID', fill: '#efe6ff', ink: '#312e81', burst: '#8b5cf6',
    sparks: ['#a78bfa', '#e0d4ff'], duration: 4.2, fatal: true
  },
  overrun: {
    word: "WORM'D", sub: 'SHIELDS DOWN', fill: '#f5ecff', ink: '#492468', burst: '#b591eb',
    sparks: ['#d5b4ff', '#ffffff'], duration: 4.2, fatal: true
  }
};

/** The beat for a death reason, or null when the run ended without a hit (the clock ran out). */
export function wormdKindForDeath(reason) {
  if (reason === 'slice-rotation') return 'sliced';
  if (reason === 'bomb') return 'blasted';
  if (reason === 'lightning') return 'struck';
  if (reason === 'self' || reason === 'self-collision') return 'bite';
  if (reason === 'voided' || reason === 'void-zone' || reason === 'void-tunnel-exhausted') return 'void';
  if (reason === 'portal-crawler') return 'overrun';
  return null;
}

export const wormdStyle = kind => WORMD_STYLES[kind] ?? WORMD_STYLES.sliced;

// ─── Deterministic scatter ───────────────────────────────────────────────────
/** mulberry32: a tiny seeded generator so a replayed hit sprays the same way. */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed from a world position, so two hits at the same point spray alike. */
export function seedFromPosition(pos) {
  const [x = 0, y = 0, z = 0] = pos ?? [];
  return (Math.round(x * 997) * 73856093) ^ (Math.round(y * 997) * 19349663) ^ (Math.round(z * 997) * 83492791);
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutBack = t => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

// ─── Letters ─────────────────────────────────────────────────────────────────
export const LETTER_STAGGER = 0.045; // seconds between letters landing
const LETTER_SLAM = 0.22;             // seconds for one letter to slam in and settle

/**
 * One letter's pose at `elapsed` seconds into the beat: it drops in oversized and
 * tilted, overshoots, and settles into a slight alternating tilt. Reduced motion
 * skips the slam and only fades the word in.
 * @returns {{scale:number, rot:number, y:number, opacity:number}} rot in degrees, y in px
 */
export function wormdLetterInto(out, elapsed, index, count, { duration = 4.2, reducedMotion = false } = {}) {
  const fadeOut = 1 - clamp01((elapsed - duration * 0.72) / (duration * 0.28));
  const rest = (index % 2 ? 1 : -1) * (index === count - 1 ? 9 : 4);
  if (reducedMotion) {
    out.scale = 1; out.rot = rest; out.y = 0;
    out.opacity = clamp01(elapsed / 0.2) * fadeOut;
    return out;
  }
  const t = clamp01((elapsed - index * LETTER_STAGGER) / LETTER_SLAM);
  const e = easeOutBack(t);
  out.scale = t <= 0 ? 0 : 2.4 - 1.4 * e;
  out.rot = rest + (1 - e) * (index % 2 ? 38 : -38);
  out.y = (1 - e) * -46;
  out.opacity = (t > 0 ? 1 : 0) * fadeOut;
  return out;
}

/** The whole word's shake: a hard kick on impact that dies away inside half a second. */
export function wormdShakeInto(out, elapsed, { fatal = false, reducedMotion = false } = {}) {
  const amp = reducedMotion ? 0 : (fatal ? 9 : 6) * Math.exp(-elapsed * 9);
  out.x = amp * Math.sin(elapsed * 83);
  out.y = amp * Math.cos(elapsed * 67);
  return out;
}

/** The starburst plate behind the word: punches out past full size, then turns slowly and fades. */
export function wormdBurstInto(out, elapsed, { duration = 4.2, reducedMotion = false } = {}) {
  const fadeOut = 1 - clamp01((elapsed - duration * 0.68) / (duration * 0.32));
  if (reducedMotion) {
    out.scale = 1; out.rot = 0; out.opacity = clamp01(elapsed / 0.2) * fadeOut * 0.92;
    return out;
  }
  const t = clamp01(elapsed / 0.28);
  out.scale = t * (1.35 - 0.35 * t) + 0.04 * Math.sin(elapsed * 14) * Math.exp(-elapsed * 3);
  out.rot = -12 + elapsed * 9;
  out.opacity = fadeOut * 0.92;
  return out;
}

/** The shockwave ring flat on the struck face: races out and thins. */
export function wormdRingInto(out, elapsed, { fatal = false, reducedMotion = false } = {}) {
  const life = fatal ? 0.7 : 0.5;
  const t = clamp01(elapsed / life);
  out.visible = !reducedMotion && t < 1;
  out.scale = 0.15 + (fatal ? 1.9 : 1.3) * (1 - (1 - t) * (1 - t));
  out.opacity = (1 - t) * (1 - t) * 0.9;
  return out;
}

/** Spiky starburst outline as an SVG points list, in a 200×120 box. */
export function starburstPoints(spikes = 14, seed = 7) {
  const rand = seededRandom(seed);
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 ? 0.62 + rand() * 0.08 : 0.9 + rand() * 0.12;
    pts.push(`${(100 + Math.cos(a) * 100 * r).toFixed(1)},${(60 + Math.sin(a) * 60 * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

// ─── Sparks ──────────────────────────────────────────────────────────────────
export const SPARK_GRAVITY = 5.5;
export const SPARK_LIFE = 0.9;

/** Fill `sparks[i] = { v:[x,y,z], size }` with a seeded spray biased out of the struck face. */
export function seedSparks(sparks, count, normal, seed) {
  const rand = seededRandom(seed);
  const [nx, ny, nz] = normal;
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const speed = 1.6 + rand() * 2.6;
    let x = Math.sin(phi) * Math.cos(theta), y = Math.sin(phi) * Math.sin(theta), z = Math.cos(phi);
    // Fold into the outward hemisphere and lean it off the face.
    const d = x * nx + y * ny + z * nz;
    if (d < 0) { x -= 2 * d * nx; y -= 2 * d * ny; z -= 2 * d * nz; }
    x += nx * 0.6; y += ny * 0.6; z += nz * 0.6;
    const len = Math.hypot(x, y, z) || 1;
    const s = sparks[i] ?? (sparks[i] = { v: [0, 0, 0], size: 0 });
    s.v[0] = (x / len) * speed; s.v[1] = (y / len) * speed; s.v[2] = (z / len) * speed;
    s.size = 0.05 + rand() * 0.08;
  }
  return sparks;
}

/** Spark offset from the impact at time t, with gravity and air drag. */
export function sparkOffsetInto(out, spark, t) {
  const drag = (1 - Math.exp(-2.2 * t)) / 2.2;
  out[0] = spark.v[0] * drag;
  out[1] = spark.v[1] * drag - 0.5 * SPARK_GRAVITY * t * t;
  out[2] = spark.v[2] * drag;
  return out;
}

// ─── Severed tail ────────────────────────────────────────────────────────────
export const MAX_SEVERED_PIECES = 40;
export const SEVERED_RIPPLE = 0.28; // seconds for the pop to run from the cut to the tip
export const SEVERED_HOLD = 0.08;   // the cut tail sits still for a beat before it pops
export const SEVERED_LIFE = 1.05;   // seconds a piece flies after its pop

/** Body colour of bead `i`, by the same rule WormBody uses (the middle of each orb's trio wears the orb). */
export function severedBeadColor(i, orbColors, base) {
  if (i < BASE_TAIL_LENGTH) return base;
  const orb = Math.floor((i - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
  return (i - BASE_TAIL_LENGTH) % ORB_SEGMENT_GROWTH === 1 ? (orbColors?.[orb] ?? base) : base;
}

const _head = new THREE.Vector3();

/**
 * Sample the beads a cut is about to remove, BEFORE cutWormTail trims history.
 * Walks the occupied centre-line from the live head exactly as the renderer and
 * findSlicePathHit do, and emits at most `max` evenly strided beads from `fromBead`
 * to the tail tip. Beads inside a tunnel are skipped: nothing flies out of a tube.
 *
 * @param {object} worm the worm's ref bag
 * @param {number} fromBead first removed bead (the cut's keepCount)
 * @param {Array} out reusable array; entries are { pos:[x,y,z], normal:[x,y,z], bead }
 * @returns {number} how many entries were written
 */
export function sampleSeveredTail(worm, fromBead, out, max = MAX_SEVERED_PIECES) {
  const history = worm.stepHistory?.current;
  const tail = worm.tailLength?.current ?? 0;
  if (!history?.count || !worm.headInterpPos?.current || !worm.currentNormal?.current) return 0;
  const first = Math.max(1, Math.floor(fromBead));
  if (first >= tail) return 0;
  const stride = Math.max(1, Math.ceil((tail - first) / max));
  let a = bodyPathHeadInto(_head, worm), aNormal = worm.currentNormal.current;
  let previous = null;
  let distance = 0;
  let written = 0;
  let bead = first;
  let target = bodyDistanceAt(worm, bead);
  for (let i = 0; i < history.count && bead < tail && written < max; i++) {
    const record = shAt(history, i);
    const b = record.pos;
    const length = tunnelBodyDistance(a.distanceTo(b), previous, record);
    while (bead < tail && written < max && target <= distance + length) {
      const t = length > 1e-9 ? (target - distance) / length : 0;
      if (!record.transit && !previous?.transit) {
        const piece = out[written] ?? (out[written] = { pos: [0, 0, 0], normal: [0, 0, 0], bead: 0 });
        piece.pos[0] = a.x + (b.x - a.x) * t; piece.pos[1] = a.y + (b.y - a.y) * t; piece.pos[2] = a.z + (b.z - a.z) * t;
        const n = t < 0.5 ? aNormal : record.normal;
        piece.normal[0] = n.x; piece.normal[1] = n.y; piece.normal[2] = n.z;
        piece.bead = bead;
        written++;
      }
      bead += stride;
      target = bodyDistanceAt(worm, bead);
    }
    distance += length;
    a = b;
    aNormal = record.normal;
    previous = record;
  }
  return written;
}

/**
 * Where a severed piece is `elapsed` seconds after the cut. Pieces hold still,
 * then pop off in a ripple from the cut to the tip: a hop off the face, a tumble
 * down under world gravity, shrinking away. Reduced motion only shrinks them in place.
 * @param {{pos:number[], normal:number[], rank:number, spin:number[]}} piece rank ∈ [0,1] from the cut to the tip
 * @returns {{x,y,z,scale,flash}} scale is a multiple of the bead radius; flash ∈ [0,1] whitens the bead
 */
export function severedPieceInto(out, piece, elapsed, reducedMotion = false) {
  const [px, py, pz] = piece.pos;
  const launch = SEVERED_HOLD + piece.rank * SEVERED_RIPPLE;
  const t = elapsed - launch;
  out.flash = clamp01(1 - Math.abs(t) / 0.12);
  if (reducedMotion) {
    out.x = px; out.y = py; out.z = pz;
    out.scale = 1 - clamp01(elapsed / (SEVERED_HOLD + SEVERED_RIPPLE + SEVERED_LIFE));
    out.flash = 0;
    return out;
  }
  if (t <= 0) {
    out.x = px; out.y = py; out.z = pz;
    // A tight swell just before it pops.
    out.scale = 1 + 0.25 * clamp01(1 + t / 0.1);
    return out;
  }
  const [nx, ny, nz] = piece.normal;
  const [sx, sy, sz] = piece.spin;
  const hop = 1.4 + piece.rank * 0.8;
  out.x = px + (nx * hop + sx) * t;
  out.y = py + (ny * hop + sy) * t - 0.5 * SPARK_GRAVITY * t * t;
  out.z = pz + (nz * hop + sz) * t;
  const life = clamp01(t / SEVERED_LIFE);
  out.scale = (1.25 - 0.25 * clamp01(t / 0.08)) * (1 - life * life);
  return out;
}

/** Seconds until the last severed piece is gone. */
export const SEVERED_TOTAL = SEVERED_HOLD + SEVERED_RIPPLE + SEVERED_LIFE;
