// src/3d/padEnergy.js
//
// The unstable wormhole under a WORM flip pad, as pure arithmetic: the tile's
// shudder, the arcs that crackle across the gap and the sparks thrown off it.
// Every value is a function of (time, seed): no Math.random and no allocation,
// so a pad crackles the same way on every machine and tests can pin it. None of
// it feeds the simulation, which lands the worm on the pad's rest height.
//
// Local pad frame (the slot matrix PadProvider already builds): z = 0 at the
// slot, +z out of the cube, the tile spanning ±PAD_BACK_WIDTH / 2 in x and y.

import { PAD_BACK_WIDTH } from './padStalkGeometry.js';

const TAU = Math.PI * 2;
const HALF = PAD_BACK_WIDTH / 2;

// PadProvider writes one record per lifted WORM pad, in its local frame; the
// energy renderer reads them. WORM caps active pairs well below this.
export const MAX_ENERGY_PADS = 64;
export function createEnergyFrames(capacity = MAX_ENERGY_PADS) {
  return {
    count: 0,
    time: 0,
    dt: 0,
    motion: 1,
    matrix: new Float32Array(capacity * 16),
    lift: new Float32Array(capacity),
    color: new Float32Array(capacity * 3),
    seed: new Int32Array(capacity)
  };
}

// Integer hash of (seed, n) → [0, 1). Same mixing as padPose's hop noise.
export function energyHash(seed, n) {
  let h = (Math.imul(seed | 0, 0x27d4eb2d) + Math.imul(n | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ── Shudder ─────────────────────────────────────────────────────────────────
// Two fast incommensurate wobbles plus a jolt that re-rolls 14 times a second.
// Bounded by these amplitudes: a few millimetres against a 0.85 tile.
export const TREMBLE_NORMAL = 0.012;
export const TREMBLE_PLANE = 0.008;
const JOLTS_PER_SECOND = 14;

export function padTremble(out, time, seed) {
  const jolt = Math.floor(time * JOLTS_PER_SECOND) * 3;
  const phase = energyHash(seed, -1) * TAU;
  out.n = TREMBLE_NORMAL * 0.5 * (Math.sin(TAU * 11.3 * time + phase) + energyHash(seed, jolt) * 2 - 1);
  out.u = TREMBLE_PLANE * 0.5 * (Math.sin(TAU * 7.1 * time + phase * 1.7) + energyHash(seed, jolt + 1) * 2 - 1);
  out.v = TREMBLE_PLANE * 0.5 * (Math.sin(TAU * 8.9 * time + phase * 2.3) + energyHash(seed, jolt + 2) * 2 - 1);
  return out;
}

// ── Arcs ────────────────────────────────────────────────────────────────────
export const ARCS_PER_PAD = 3;
export const ARC_POINTS = 8;
export const ARC_RATE = 9; // strikes per second, per arc
export const ARC_DUTY = 0.62; // share of strikes that light
// Sideways spread of a strike, as a fraction of its length. Tapers to zero at
// both ends, so an arc always starts and ends exactly on the rims it jumps.
export const ARC_JITTER = 0.3;

const _rim = [0, 0];
// Point on the rim of a square of half-size h: side 0..3 (+y, +x, -y, -x), u in [0, 1).
function rim(h, side, u) {
  const s = (u * 2 - 1) * h;
  switch (side & 3) {
    case 0: _rim[0] = s; _rim[1] = h; break;
    case 1: _rim[0] = h; _rim[1] = -s; break;
    case 2: _rim[0] = -s; _rim[1] = -h; break;
    default: _rim[0] = -h; _rim[1] = s;
  }
  return _rim;
}

/**
 * One arc of a pad's gap for the strike under way at `time`.
 *
 * Writes ARC_POINTS local [x, y, z] points into `out` and returns the strike's
 * brightness, or 0 while this arc is dark. The first arcs jump the gap from the
 * slot's rim to the tile's underside; the last one discharges from the tile's
 * edge to the surface just outside it. A strike keeps its shape for its whole
 * beat and flashes then fades across it.
 */
export function padArc(out, arc, time, seed, lift) {
  if (lift <= 0.02) return 0;
  const clock = time * ARC_RATE + energyHash(seed, arc * 977);
  const beat = Math.floor(clock);
  const age = clock - beat;
  const key = (seed + Math.imul(arc + 1, 0x632be5ab)) | 0;
  // Sixteen draws per strike: energyHash(key, base + n) for n = 0..15.
  const base = beat * 16;
  if (energyHash(key, base) > ARC_DUTY) return 0;
  const side = Math.floor(energyHash(key, base + 1) * 4);
  const discharge = arc === ARCS_PER_PAD - 1;

  let p = rim(discharge ? HALF : HALF * 0.72, side, energyHash(key, base + 2));
  const sx = p[0], sy = p[1];
  const sz = discharge ? lift * (0.35 + 0.4 * energyHash(key, base + 3)) : 0.004;
  const r4 = energyHash(key, base + 4), r5 = energyHash(key, base + 5);
  p = discharge ? rim(HALF * (1.25 + 0.5 * r4), side, r5) : rim(HALF * 0.94, side + (r4 < 0.5 ? 0 : 1), r5);
  const ex = p[0], ey = p[1];
  const ez = discharge ? 0.006 : Math.max(0.01, lift - 0.02);

  const dx = ex - sx, dy = ey - sy, dz = ez - sz;
  const len = Math.hypot(dx, dy, dz);
  // Sideways axes: d × z, falling back to x for a vertical strike, then d × that.
  let p1x = dy, p1y = -dx;
  const l1 = Math.hypot(p1x, p1y);
  if (l1 < 1e-6) { p1x = 1; p1y = 0; } else { p1x /= l1; p1y /= l1; }
  let p2x = -dz * p1y, p2y = dz * p1x, p2z = dx * p1y - dy * p1x;
  const l2 = Math.hypot(p2x, p2y, p2z) || 1;
  p2x /= l2; p2y /= l2; p2z /= l2;
  const jitter = ARC_JITTER * len;
  const other = key ^ 0x5bd1e995;
  // Stay in the gap: under the surface an arc would vanish, and over the tile it
  // would crawl across the landing face instead of under it.
  const top = lift - 0.01;
  for (let i = 0; i < ARC_POINTS; i++) {
    const f = i / (ARC_POINTS - 1);
    const taper = Math.sin(Math.PI * f);
    const a = (energyHash(key, base + 6 + i) * 2 - 1) * jitter * taper;
    const b = (energyHash(other, base + i) * 2 - 1) * jitter * taper;
    const o = i * 3;
    out[o] = sx + dx * f + p1x * a + p2x * b;
    out[o + 1] = sy + dy * f + p1y * a + p2y * b;
    out[o + 2] = Math.min(top, Math.max(0.004, sz + dz * f + p2z * b));
  }
  return Math.sqrt(1 - age) * (0.65 + 0.35 * energyHash(key, base + 14));
}

// ── Sparks ──────────────────────────────────────────────────────────────────
export const SPARKS_PER_SECOND = 11;

/**
 * Launch state of a pad's `n`th spark, in the local frame: from the gap's rim,
 * flung outward and up. Fills out.{px, py, pz, vx, vy, vz, life, size}.
 */
export function padSpark(out, n, seed, lift) {
  const key = seed ^ 0x2545f491;
  const base = n * 8;
  const side = Math.floor(energyHash(key, base) * 4);
  const p = rim(HALF * 0.9, side, energyHash(key, base + 1));
  out.px = p[0];
  out.py = p[1];
  out.pz = Math.max(0.01, lift) * (0.15 + 0.75 * energyHash(key, base + 2));
  // Outward from the side the spark leaves by, fanned along that side.
  const ox = side === 1 ? 1 : side === 3 ? -1 : 0;
  const oy = side === 0 ? 1 : side === 2 ? -1 : 0;
  const fan = (energyHash(key, base + 3) * 2 - 1) * 0.6;
  const speed = 0.8 + 1.1 * energyHash(key, base + 4);
  out.vx = (ox - oy * fan) * speed;
  out.vy = (oy + ox * fan) * speed;
  out.vz = (0.35 + 1.1 * energyHash(key, base + 5)) * speed;
  out.life = 0.22 + 0.33 * energyHash(key, base + 6);
  out.size = 0.035 + 0.03 * energyHash(key, base + 7);
  return out;
}
