// src/manifold/ChaosStorm.jsx
//
// Chaos mode's lightning, drawn as one storm instead of one component per bolt.
//
// What it shows, per chaos-worker tick (see game/chaosStormEvents.js):
//
//   bolt      a chain hop between two tiles. Arcs gather on the source tile, a
//             thin stepped leader crackles to the target, then the return stroke
//             slams a thick white-cored plasma channel open between them and it
//             re-strikes once or twice as it dies. The landing throws sparks,
//             rings the tile, punches the cubie in (cubieKick) with a softer
//             ripple through its neighbours, jolts the camera, and leaves the tile
//             crackling for a moment — the hit is felt, not just seen.
//   charge    a flip. The struck tile's twin flips with it — they are one point —
//             and the surge that links them runs down the pair's wormhole, through
//             the core and out of the twin, lighting the tunnel as it goes. The
//             tunnel renderers brighten the same span in step (tunnelCharges).
//   overload  a pair driven to its cap. The wormhole blows out end to end.
//
// Every endpoint is a TILE, re-resolved each frame against the live cubie
// transform — raised flipped pieces, Explode, springs, and a slice mid-turn.
// That is the fix for bolts that stayed at the old grid position while the
// cubies they were aimed at rose to their Explode position.
//
// Cost is fixed: bolt, charge, strip, spark and ring pools are allocated once,
// no React state changes per frame or per event, and the frame loop allocates
// nothing. Reduced motion keeps the bolts and surges (they carry information)
// but drops the flicker, re-strikes, crawl, the physical kicks and the shake.

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { prefersReducedMotion } from '../utils/device.js';
import { SURFACE_OFFSET, TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { buildManifoldGridMap } from '../game/manifoldLogic.js';
import { stormMeshIndex } from '../game/chaosStormEvents.js';
import { makeTunnelPath, buildTunnelPathInto, tunnelPathArcPointInto, TUNNEL_MINI_FACE_R } from '../utils/tunnelPath.js';
import { padMotion } from '../3d/padMotionBridge.js';
import { fireCubieKick } from '../3d/cubieKick.js';
import { fireCameraShake } from '../3d/flipImpulse.js';
import { feel } from '../utils/feel.js';
import { seededRand } from './boltPath.js';
import {
  chaosStorm,
  drainChaosStormEvents,
  setTunnelCharge,
  tunnelChargeState,
  pruneTunnelCharges,
  tunnelCharges,
  tunnelFocus
} from './chaosStormBridge.js';
import { createStripGeometry, createStripMaterials, createStripWriter, STRIP_POINTS } from './stormStrips.js';
import { createSparkPool, createSparkMaterial, spawnSpark, stepSparks, clearSparks } from './stormSparks.js';

// ── Budgets ───────────────────────────────────────────────────────────────────
const MAX_BOLTS = 8;
const MAX_CHARGES = 8;
// Up to 5 strips per bolt (channel, two forks, two crawling residue arcs) and 4
// per charge (sheath + arcs).
const MAX_STRIPS = MAX_BOLTS * 5 + MAX_CHARGES * 4;
const MAX_SPARKS = 240;
const MAX_RINGS = 14;

const BOLT_POINTS = 14;
const FORK_POINTS = 5;
const SHEATH_POINTS = STRIP_POINTS;
const ARC_POINTS = 8;
const CRAWL_POINTS = 6;

// ── Bolt timeline (seconds) ───────────────────────────────────────────────────
// Charge-up → leader → return stroke → after-glow with re-strikes. The charge-up
// is the anticipation beat: arcs gather on the source tile for a moment before it
// fires, which is what gives the strike weight. ~0.65 s end to end.
const CHARGE_S = 0.07;
const LEADER_S = 0.16;
const LEADER_CROSS_S = 0.22;
const STROKE_S = 0.1;
const AFTER_S = 0.3;
// How long the struck tile keeps crackling after the hit.
const RESIDUE_S = 0.42;
// The player's first strike comes out of the sky: the chosen tile charges up for
// longer, the leader falls further, and everything about the hit is bigger.
const HERO_CHARGE_S = 0.3;
const HERO_LEADER_S = 0.28;
const HERO_WIDTH = 1.6;

// ── Channel thickness (world units, full ribbon width including the aura) ─────
// Tiles are ~0.88 wide. The white core is ~a quarter of this, the coloured body
// about half; the rest is soft aura.
const LEADER_W = 0.15;
const STROKE_W = 0.5;
const AFTER_W = 0.2;

// Neighbouring cubies in the struck face's plane, by the face's slot axes.
const RIPPLE_AXES = { PX: [1, 2], NX: [1, 2], PY: [0, 2], NY: [0, 2], PZ: [0, 1], NZ: [0, 1] };
const RIPPLE_DELAY_MS = 45;
const RIPPLE_SHARE = 0.38;

// ── Palette ───────────────────────────────────────────────────────────────────
const C_BOLT = new THREE.Color('#4b8dff');
const C_BOLT_CROSS = new THREE.Color('#2fe2ff');
const C_HOT = new THREE.Color('#b27dff');
const C_SURGE = new THREE.Color('#5ab8ff');
const C_BIRTH = new THREE.Color('#8ef3ff');
const C_RECOVER = new THREE.Color('#4fe8b0');
const C_OVERLOAD = new THREE.Color('#ff5634');
const C_WHITE = new THREE.Color('#ffffff');

const FACE_N = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};

const SURFACE_LIFT = SURFACE_OFFSET + 0.03;

// ── Frame-loop scratch (never allocate per frame) ─────────────────────────────
const _pts = new Float32Array(STRIP_POINTS * 3);
const _wid = new Float32Array(STRIP_POINTS);
const _alp = new Float32Array(STRIP_POINTS);
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _r = new THREE.Vector3();
const _t = new THREE.Vector3();
const _u = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _bu = new THREE.Vector3();
const _bs = new THREE.Vector3();
const _col = new THREE.Color();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _chargeState = { active: false, front: 0, glow: 0, arrived: false };
const _kickDir = { x: 0, y: 0, z: 0 };

const smooth = (u) => u * u * (3 - 2 * u);
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function makeBolt() {
  return {
    live: false, cascadeId: null, from: null, to: null, fromPos: null, toPos: null,
    crossFace: false, heat: 0, seed: 0, sub: 0, subAt: 0, age: 0, leader: LEADER_S,
    landed: false, sparked: false, restrikes: 0, born: 0, landedAge: 0,
    hero: false, chargeS: CHARGE_S, fromN: new THREE.Vector3(0, 0, 1),
    A: new THREE.Vector3(), B: new THREE.Vector3(), nA: new THREE.Vector3(), nB: new THREE.Vector3(),
    path: new Float32Array(BOLT_POINTS * 3), color: new THREE.Color()
  };
}

function makeCharge() {
  return {
    live: false, kind: 'surge', pairId: null, from: null, to: null, heat: 0, seed: 0, sub: 0, subAt: 0,
    charge: null, started: false, arrived: false, born: 0, throated: false,
    vStart: new THREE.Vector3(), vEnd: new THREE.Vector3(), n1: new THREE.Vector3(), n2: new THREE.Vector3(),
    dock1: new THREE.Vector3(), dock2: new THREE.Vector3(), path: makeTunnelPath(),
    legLen: [0, 0, 0], color: new THREE.Color()
  };
}

function makeRing(geo) {
  const mat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  mesh.raycast = () => null;
  return { mesh, mat, age: 0, dur: 0.3, s0: 0.3, s1: 1.6, peak: 0.9, live: false };
}

/** The per-frame inputs every helper reads, reused across frames. */
function makeContext() {
  return {
    refs: null, size: 3, cubies: null, cap: 1, padsOn: true, nowMs: 0, dt: 0,
    reduced: false, lowFx: false, showTunnels: false, levelHeat: 0,
    epoch: null, relocMap: null, complete: null,
    bolts: null, charges: null, rings: null, sparks: null, writer: null,
    sound: { zap: -1e9, surge: -1e9, overload: -1e9, ignite: -1e9 }
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Surface point and outward normal of a tile on its LIVE cubie.
 *
 * The cubie ref's world matrix carries everything that moves a piece: its grid
 * slot, Explode, the raised-cubie lift, a slice mid-turn and a lightning kick.
 * `lift` is how far from the cubie centre to land.
 */
function resolveTile(ctx, loc, lift, outP, outN) {
  const n = FACE_N[loc?.dirKey];
  const g = n ? ctx.refs?.[stormMeshIndex(loc, ctx.size)] : null;
  if (!g) return false;
  g.updateWorldMatrix(true, false);
  outP.setFromMatrixPosition(g.matrixWorld);
  outN.set(n[0], n[1], n[2]).transformDirection(g.matrixWorld);
  outP.addScaledVector(outN, lift);
  return true;
}

/** A raised flip pad sits proud of its slot; land on its face, not the slot. */
function padLift(ctx, loc) {
  if (!ctx.padsOn || !loc?.pairKey) return 0;
  const st = ctx.cubies?.[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
  if (!st || st.flips >= ctx.cap || st.flips % 2 !== 1) return 0;
  return padMotion.get(loc.pairKey)?.lift ?? 0;
}

/**
 * A committed slice turn moves stickers to new slots. Effects in flight are keyed
 * by slot, so re-find their tiles by grid id — once per turn per effect, with the
 * lookup map built at most once per turn and only when something is in the air.
 */
function relocate(ctx, loc) {
  if (!loc || loc.epoch === ctx.epoch) return;
  if (!ctx.relocMap) ctx.relocMap = buildManifoldGridMap(ctx.cubies, ctx.size);
  const at = ctx.relocMap.get(loc.gridId);
  if (at) { loc.x = at.x; loc.y = at.y; loc.z = at.z; loc.dirKey = at.dirKey; }
  loc.epoch = ctx.epoch;
}

/** Any two unit vectors perpendicular to the unit vector `t`. */
function perpBasis(t, a, b) {
  if (Math.abs(t.y) < 0.9) a.set(0, 1, 0); else a.set(1, 0, 0);
  a.crossVectors(t, a).normalize();
  b.crossVectors(t, a).normalize();
}

/**
 * Write the bolt's full jagged path between its live endpoints into b.path.
 *
 * The bolt arcs OUT over the cube — bowed along the average of the two face
 * normals — so a hop across a cube edge leaps the corner instead of cutting
 * through the piece, and jitter never dives below the tiles it joins. Both ends
 * are pinned (sine taper), so the bolt always lands exactly on its tile.
 */
function buildBoltPath(b) {
  _t.subVectors(b.B, b.A);
  const len = _t.length();
  if (len < 1e-4) {
    for (let i = 0; i < BOLT_POINTS; i++) {
      b.path[i * 3] = b.A.x; b.path[i * 3 + 1] = b.A.y; b.path[i * 3 + 2] = b.A.z;
    }
    return 0;
  }
  _t.divideScalar(len);
  _u.addVectors(b.nA, b.nB);
  _u.addScaledVector(_t, -_u.dot(_t));
  if (_u.lengthSq() < 1e-6) perpBasis(_t, _u, _s);
  _u.normalize();
  _s.crossVectors(_t, _u);
  const bow = Math.min(0.55, 0.14 + 0.24 * len);
  const seed = b.seed * 1.618 + b.sub * 37.1;
  for (let i = 0; i < BOLT_POINTS; i++) {
    const f = i / (BOLT_POINTS - 1);
    const taper = Math.sin(Math.PI * f);
    const lateral = (seededRand(seed + i * 2) - 0.5) * 0.44 * len * taper;
    const lift = bow * taper + (seededRand(seed + i * 2 + 1) - 0.35) * 0.16 * len * taper;
    const o = i * 3;
    b.path[o] = b.A.x + _t.x * len * f + _s.x * lateral + _u.x * lift;
    b.path[o + 1] = b.A.y + _t.y * len * f + _s.y * lateral + _u.y * lift;
    b.path[o + 2] = b.A.z + _t.z * len * f + _s.z * lateral + _u.z * lift;
  }
  return len;
}

/** Point at fraction f of a polyline stored flat in `arr` with `n` points. */
function polyAt(arr, n, f, out) {
  const s = clamp01(f) * (n - 1);
  const i = Math.min(n - 2, Math.floor(s));
  const k = s - i;
  const o = i * 3;
  return out.set(
    arr[o] + (arr[o + 3] - arr[o]) * k,
    arr[o + 1] + (arr[o + 4] - arr[o + 1]) * k,
    arr[o + 2] + (arr[o + 5] - arr[o + 2]) * k
  );
}

/**
 * A point on the charge's wormhole at t (0 = struck mouth, 1 = twin's mouth), by
 * arc length. Focus-tier ribbons follow the throated gameplay route; cords — and
 * hidden tunnels, which the surge reveals — run straight to the core docks.
 */
function chargePathAt(c, t, out) {
  if (c.throated) return tunnelPathArcPointInto(out, c.path, clamp01(t) * c.path.total);
  const total = c.legLen[0] + c.legLen[1] + c.legLen[2] || 1;
  let a = clamp01(t) * total;
  if (a <= c.legLen[0]) return out.lerpVectors(c.vStart, c.path.midA, c.legLen[0] > 0 ? a / c.legLen[0] : 0);
  a -= c.legLen[0];
  if (a <= c.legLen[1]) return out.lerpVectors(c.path.midA, c.path.midB, c.legLen[1] > 0 ? a / c.legLen[1] : 0);
  a -= c.legLen[1];
  return out.lerpVectors(c.path.midB, c.vEnd, c.legLen[2] > 0 ? a / c.legLen[2] : 1);
}

/**
 * Emit `n` points from the scratch buffers as one strip, jittered sideways by
 * `amp` (tapered to zero at both ends so a strip stays pinned to what it joins).
 */
function emitStrip(writer, n, amp, seed, color, core, xray) {
  const s = writer.open();
  if (s < 0) return;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    let x = _pts[o], y = _pts[o + 1], z = _pts[o + 2];
    if (amp > 0 && i > 0 && i < n - 1) {
      const a = (i - 1) * 3, c = (i + 1) * 3;
      _t.set(_pts[c] - _pts[a], _pts[c + 1] - _pts[a + 1], _pts[c + 2] - _pts[a + 2]);
      if (_t.lengthSq() > 1e-10) {
        _t.normalize();
        perpBasis(_t, _u, _s);
        const taper = Math.sin((Math.PI * i) / (n - 1));
        const j1 = (seededRand(seed + i * 2.3) - 0.5) * 2 * amp * taper;
        const j2 = (seededRand(seed + i * 2.3 + 1.7) - 0.5) * 2 * amp * taper;
        x += _u.x * j1 + _s.x * j2;
        y += _u.y * j1 + _s.y * j2;
        z += _u.z * j1 + _s.z * j2;
      }
    }
    writer.point(s, i, x, y, z, _wid[i], _alp[i], color.r, color.g, color.b, core, xray);
  }
  writer.close(s, n);
}

// ── Impact helpers ────────────────────────────────────────────────────────────

function ring(ctx, pos, normal, color, s0, s1, dur, peak) {
  let slot = null;
  let oldest = ctx.rings[0];
  for (const r of ctx.rings) {
    if (!r.live) { slot = r; break; }
    if (r.age / r.dur > oldest.age / oldest.dur) oldest = r;
  }
  slot ??= oldest;
  slot.live = true; slot.age = 0; slot.dur = dur; slot.s0 = s0; slot.s1 = s1; slot.peak = peak;
  slot.mesh.visible = true;
  slot.mesh.position.copy(pos).addScaledVector(normal, 0.035);
  slot.mesh.quaternion.setFromUnitVectors(_zAxis, normal);
  slot.mesh.scale.setScalar(s0);
  slot.mat.color.copy(color);
  slot.mat.opacity = peak;
}

/** Sparks thrown off a tile: out along its normal, fanned sideways, then falling. */
function burst(ctx, pos, normal, color, count, speed, seed, sizeMul = 1) {
  const n = ctx.lowFx ? Math.ceil(count / 2) : ctx.reduced ? Math.ceil(count * 0.6) : count;
  perpBasis(normal, _bu, _bs);
  for (let i = 0; i < n; i++) {
    const r1 = seededRand(seed + i * 3.1);
    const r2 = seededRand(seed + i * 3.1 + 1.3);
    const r3 = seededRand(seed + i * 3.1 + 2.9);
    const ang = r1 * Math.PI * 2;
    const out = speed * (0.45 + 0.75 * r2);
    const side = speed * (0.25 + 0.65 * r3);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    _col.copy(C_WHITE).lerp(color, 0.25 + 0.65 * r2);
    spawnSpark(
      ctx.sparks, pos.x, pos.y, pos.z,
      normal.x * out + (_bu.x * ca + _bs.x * sa) * side,
      normal.y * out + (_bu.y * ca + _bs.y * sa) * side,
      normal.z * out + (_bu.z * ca + _bs.z * sa) * side,
      0.22 + 0.3 * r3, (0.045 + 0.06 * r1) * sizeMul, _col.r, _col.g, _col.b
    );
  }
}

/** The impact flash: one big, very short-lived particle just off the tile. */
function flash(ctx, pos, normal, color, size, life) {
  _col.copy(color).lerp(C_WHITE, 0.35);
  spawnSpark(ctx.sparks, pos.x + normal.x * 0.06, pos.y + normal.y * 0.06, pos.z + normal.z * 0.06,
    0, 0, 0, life, size, _col.r, _col.g, _col.b, NO_MOTION);
}
const NO_MOTION = { drag: 0, gravity: 0 };

function kick(ctx, loc, normal, amp) {
  if (ctx.reduced || !loc || !(amp > 0)) return;
  _kickDir.x = normal.x; _kickDir.y = normal.y; _kickDir.z = normal.z;
  fireCubieKick(`${loc.x},${loc.y},${loc.z}`, _kickDir, amp, ctx.nowMs);
}

/**
 * Kick the struck cubie hard and its in-face neighbours softly a beat later, so a
 * hit shoves the surface around it the way a real blow would.
 */
function kickRipple(ctx, loc, normal, amp) {
  kick(ctx, loc, normal, amp);
  const axes = !ctx.reduced && loc ? RIPPLE_AXES[loc.dirKey] : null;
  if (!axes) return;
  for (const axis of axes) {
    for (let d = -1; d <= 1; d += 2) {
      const x = loc.x + (axis === 0 ? d : 0);
      const y = loc.y + (axis === 1 ? d : 0);
      const z = loc.z + (axis === 2 ? d : 0);
      if (x < 0 || y < 0 || z < 0 || x >= ctx.size || y >= ctx.size || z >= ctx.size) continue;
      fireCubieKick(`${x},${y},${z}`, _kickDir, amp * RIPPLE_SHARE, ctx.nowMs + RIPPLE_DELAY_MS);
    }
  }
}

function shake(ctx, amp, dur) {
  if (!ctx.reduced) fireCameraShake(amp, dur);
}

/**
 * Short arcs crawling over a tile's face: gathering toward its centre before it
 * fires (inward), or skittering edge to edge after it has been struck.
 */
function tileArcs(ctx, center, normal, color, count, alpha, width, seed, inward) {
  perpBasis(normal, _bu, _bs);
  for (let k = 0; k < count; k++) {
    const a = seededRand(seed + k * 7.7) * Math.PI * 2;
    const b = a + Math.PI * (0.55 + 0.9 * seededRand(seed + k * 7.7 + 3.1));
    const r0 = 0.42;
    const r1 = inward ? 0.04 : 0.36;
    for (let i = 0; i < CRAWL_POINTS; i++) {
      const f = i / (CRAWL_POINTS - 1);
      const ca = Math.cos(a) * r0 * (1 - f) + Math.cos(b) * r1 * f;
      const sa = Math.sin(a) * r0 * (1 - f) + Math.sin(b) * r1 * f;
      _pts[i * 3] = center.x + _bu.x * ca + _bs.x * sa + normal.x * 0.02;
      _pts[i * 3 + 1] = center.y + _bu.y * ca + _bs.y * sa + normal.y * 0.02;
      _pts[i * 3 + 2] = center.z + _bu.z * ca + _bs.z * sa + normal.z * 0.02;
      _wid[i] = width * (0.55 + 0.45 * Math.sin(Math.PI * f));
      _alp[i] = alpha;
    }
    emitStrip(ctx.writer, CRAWL_POINTS, 0.07, seed + k * 13, color, 1, 0);
  }
}

const SOUND_EVENTS = { zap: 'chaosZap', surge: 'chaosSurge', overload: 'chaosOverload', ignite: 'chaosIgnite' };
/** Chaos fires many events a second; each voice keeps a minimum gap. */
function sound(ctx, name, gapMs, opts) {
  if (ctx.nowMs - ctx.sound[name] < gapMs) return;
  ctx.sound[name] = ctx.nowMs;
  feel(SOUND_EVENTS[name], opts);
}

function blast(ctx, loc, pos, normal, color, seed) {
  burst(ctx, pos, normal, color, 22, 3.4, seed, 1.3);
  flash(ctx, pos, normal, color, 1.8, 0.2);
  ring(ctx, pos, normal, color, 0.4, 2.3, 0.48, 1);
  kickRipple(ctx, loc, normal, 0.2);
  shake(ctx, 0.09, 0.34);
}

function retire(ctx, b) {
  b.live = false;
  if (b.cascadeId != null) ctx.complete?.(b.cascadeId);
}

// ── Ingest ────────────────────────────────────────────────────────────────────

function ingestBolt(ctx, ev) {
  let b = null;
  let oldest = ctx.bolts[0];
  for (const x of ctx.bolts) {
    if (!x.live) { b = x; break; }
    if (x.born < oldest.born) oldest = x;
  }
  const hero = ev.type === 'ignition';
  // The first strike falls from the sky above the chosen tile: fix its launch
  // point now, off the tile's live position and normal, with a seeded lean.
  let sky = null;
  if (hero) {
    if (!resolveTile(ctx, ev.to, SURFACE_LIFT, _p, _n)) return;
    const lean = (seededRand((ev.seed ?? 0) + 3.3) - 0.5) * 1.6;
    perpBasis(_n, _bu, _bs);
    sky = [
      _p.x + _n.x * 3.4 + _bu.x * lean, _p.y + _n.y * 3.4 + 1.4 + _bu.y * lean, _p.z + _n.z * 3.4 + _bu.z * lean
    ];
  }
  if (!b) { b = oldest; retire(ctx, b); }
  b.live = true;
  b.hero = hero;
  b.chargeS = hero ? HERO_CHARGE_S : CHARGE_S;
  if (hero) b.fromN.copy(_n).negate();
  b.cascadeId = ev.cascadeId ?? null;
  b.from = ev.from ? { ...ev.from, epoch: ctx.epoch } : null;
  b.to = ev.to ? { ...ev.to, epoch: ctx.epoch } : null;
  b.fromPos = sky ?? ev.fromPos;
  b.toPos = ev.toPos;
  b.crossFace = !!ev.crossFace;
  b.heat = ev.heat ?? 0;
  b.seed = ev.seed ?? 0;
  b.sub = 0;
  b.subAt = ctx.nowMs;
  b.age = 0;
  b.leader = hero ? HERO_LEADER_S : b.crossFace ? LEADER_CROSS_S : LEADER_S;
  b.landed = false;
  b.landedAge = 0;
  b.sparked = false;
  b.restrikes = 0;
  b.born = ctx.nowMs;
  if (hero) b.color.copy(C_BIRTH).lerp(C_WHITE, 0.25);
  else b.color.copy(b.crossFace ? C_BOLT_CROSS : C_BOLT).lerp(C_HOT, Math.min(0.8, ctx.levelHeat * 0.45 + b.heat * 0.4));
}

function ingestCharge(ctx, ev) {
  if (!ev.from) return;
  const kind = ev.type === 'overload' ? 'overload' : ev.kind;
  // A pair already carrying a surge restarts it rather than taking a second slot.
  let c = null;
  let free = null;
  let oldest = ctx.charges[0];
  for (const x of ctx.charges) {
    if (x.live && x.pairId === ev.pairId) { c = x; break; }
    if (!x.live) free ??= x;
    else if (x.born < oldest.born) oldest = x;
  }
  c ??= free ?? oldest;
  c.live = true;
  c.kind = kind;
  c.pairId = ev.pairId;
  c.from = { ...ev.from, epoch: ctx.epoch };
  c.to = ev.to ? { ...ev.to, epoch: ctx.epoch } : null;
  c.heat = ev.heat ?? 0;
  c.seed = ev.seed ?? 0;
  c.sub = 0;
  c.subAt = ctx.nowMs;
  c.started = false;
  c.arrived = false;
  c.born = ctx.nowMs;
  c.charge = c.to ? setTunnelCharge(ev.pairId, ev.from.gridId, ctx.nowMs, kind) : null;
  c.color.copy(kind === 'overload' ? C_OVERLOAD : kind === 'recover' ? C_RECOVER : kind === 'birth' ? C_BIRTH : C_SURGE);
  if (kind === 'surge') c.color.lerp(C_HOT, Math.min(0.75, c.heat * 0.6 + ctx.levelHeat * 0.2));
}

// ── Per-frame updates ─────────────────────────────────────────────────────────

function updateBolt(ctx, b) {
  b.age += ctx.dt;
  if (b.age >= b.chargeS + b.leader + STROKE_S + AFTER_S) { retire(ctx, b); return; }

  relocate(ctx, b.from);
  relocate(ctx, b.to);
  if (!resolveTile(ctx, b.from, SURFACE_LIFT + padLift(ctx, b.from), b.A, b.nA)) {
    if (!b.fromPos) { retire(ctx, b); return; }
    const n = FACE_N[b.from?.dirKey] ?? FACE_N.PZ;
    b.A.fromArray(b.fromPos);
    if (b.hero) b.nA.copy(b.fromN);
    else b.nA.set(n[0], n[1], n[2]);
  }
  if (!resolveTile(ctx, b.to, SURFACE_LIFT + padLift(ctx, b.to), b.B, b.nB)) {
    if (!b.toPos) { retire(ctx, b); return; }
    const n = FACE_N[b.to?.dirKey] ?? FACE_N.PZ;
    b.B.fromArray(b.toPos);
    b.nB.set(n[0], n[1], n[2]);
  }

  // Lightning never holds still: re-seed the jag while it charges and hunts, and
  // again on each re-strike. Reduced motion keeps one fixed shape.
  const t = b.age - b.chargeS; // time since the leader left the source
  if (!ctx.reduced && t < b.leader && ctx.nowMs - b.subAt > 34) { b.sub++; b.subAt = ctx.nowMs; }

  // ── Charge-up: arcs gather on the source tile, then it fires ──────────────
  // The first strike charges the tile it is about to hit instead: the player
  // watches their pick gather charge before the sky answers.
  if (t < 0) {
    const u = b.age / b.chargeS;
    if (b.hero) tileArcs(ctx, b.B, b.nB, b.color, 3, 0.3 + 0.7 * u, 0.13, b.seed + b.sub * 5, true);
    else tileArcs(ctx, b.A, b.nA, b.color, 2, 0.35 + 0.65 * u, 0.1, b.seed + b.sub * 5, true);
    return;
  }
  if (!b.sparked) {
    b.sparked = true;
    if (!b.hero) {
      burst(ctx, b.A, b.nA, b.color, 6, 1.8, b.seed + 5, 0.9);
      flash(ctx, b.A, b.nA, b.color, 0.5, 0.08);
    }
  }

  const leading = t < b.leader;
  const stroking = !leading && t < b.leader + STROKE_S;
  const afterU = leading || stroking ? 0 : (t - b.leader - STROKE_S) / AFTER_S;
  if (!ctx.reduced) {
    const restrikes = afterU > 0.62 ? 2 : afterU > 0.28 ? 1 : 0;
    if (restrikes > b.restrikes) b.sub++;
    b.restrikes = restrikes;
  }
  const len = buildBoltPath(b);

  // ── Landing: the return stroke and the hit ────────────────────────────────
  if (!leading && !b.landed) {
    b.landed = true;
    b.landedAge = b.age;
    if (b.hero) {
      burst(ctx, b.B, b.nB, b.color, 28, 3.8, b.seed + 11, 1.4);
      flash(ctx, b.B, b.nB, b.color, 2.2, 0.22);
      ring(ctx, b.B, b.nB, b.color, 0.4, 2.8, 0.5, 1);
      kickRipple(ctx, b.to, b.nB, 0.24);
      shake(ctx, 0.11, 0.42);
      sound(ctx, 'ignite', 0, { priority: 1 });
    } else {
      const heavy = (b.crossFace ? 1.25 : 1) * (1 + b.heat * 0.35);
      burst(ctx, b.B, b.nB, b.color, Math.round(14 * heavy), 2.8 + b.heat * 1.4, b.seed + 11, 1.15);
      flash(ctx, b.B, b.nB, b.color, 1.25 * heavy, 0.15);
      ring(ctx, b.B, b.nB, b.color, 0.35, 1.7 * heavy, 0.36, 1);
      kickRipple(ctx, b.to, b.nB, 0.12 + b.heat * 0.06 + (b.crossFace ? 0.04 : 0));
      shake(ctx, 0.03 + b.heat * 0.025 + (b.crossFace ? 0.015 : 0), 0.2);
      sound(ctx, 'zap', 85, { combo: Math.round(b.heat * 6), priority: 0 });
    }
  }

  // ── Envelope ──────────────────────────────────────────────────────────────
  let head = 1, alpha, width, core;
  if (leading) {
    const u = t / b.leader;
    // Stepped leader: lurches forward in short hops rather than gliding.
    head = ctx.reduced ? smooth(u) : Math.min(1, (Math.floor(u * 7) + smooth((u * 7) % 1)) / 7);
    alpha = 0.7;
    width = LEADER_W;
    core = 0.8;
  } else if (stroking) {
    // The return stroke slams the channel open to full thickness, then eases.
    const u = (t - b.leader) / STROKE_S;
    const swell = u < 0.25 ? 0.55 + 0.45 * smooth(u / 0.25) : 1 - 0.2 * ((u - 0.25) / 0.75);
    alpha = 1;
    width = STROKE_W * swell;
    core = 1;
  } else {
    const fade = Math.pow(1 - afterU, 1.5);
    const restrike = ctx.reduced ? 0 : 0.9 * gauss(afterU - 0.3, 0.06) + 0.6 * gauss(afterU - 0.64, 0.05);
    alpha = Math.min(1, fade * 0.8 + restrike);
    width = AFTER_W * (0.6 + 0.4 * fade) + STROKE_W * 0.55 * restrike;
    core = 0.6 + 0.4 * Math.min(1, restrike);
  }
  width *= (b.hero ? HERO_WIDTH : b.crossFace ? 1.15 : 1) * (1 + b.heat * 0.25);

  // Main channel: source → head, resampled along the stable jagged path so the
  // shape holds while it grows. Thickness varies knot to knot, and swells toward
  // the impact, so it reads as a muscular channel rather than a ruled line.
  for (let i = 0; i < BOLT_POINTS; i++) {
    const f = i / (BOLT_POINTS - 1);
    polyAt(b.path, BOLT_POINTS, f * head, _p);
    _pts[i * 3] = _p.x; _pts[i * 3 + 1] = _p.y; _pts[i * 3 + 2] = _p.z;
    const tip = leading ? gauss(1 - f, 0.12) : 0;
    const knot = 0.8 + 0.4 * seededRand(b.seed * 0.37 + i * 4.7);
    const ends = 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, f * head * 0.85 + 0.15));
    _wid[i] = width * knot * ends * (0.85 + 0.3 * f) * (1 + 1.6 * tip);
    _alp[i] = Math.min(1, alpha * (1 + 0.8 * tip));
  }
  emitStrip(ctx.writer, BOLT_POINTS, 0, 0, b.color, core, 0);

  // The struck tile keeps crackling for a moment after the hit.
  if (b.landed) {
    const r = (b.age - b.landedAge) / RESIDUE_S;
    if (r < 1) {
      const flicker = ctx.reduced ? 1 : 0.6 + 0.4 * seededRand(b.seed + b.sub * 3.9 + Math.floor(b.age * 30));
      tileArcs(ctx, b.B, b.nB, b.color, ctx.lowFx ? 1 : 2, Math.pow(1 - r, 1.3) * flicker, 0.11, b.seed + 71 + Math.floor(b.age * 22), false);
    }
  }

  // Forks split off the channel from the return stroke on, and die with it.
  if (leading || ctx.lowFx || len < 0.2) return;
  const forks = b.hero ? 3 : b.crossFace ? 2 : 1;
  for (let k = 0; k < forks; k++) {
    const fs = b.seed * 0.73 + k * 19.7 + b.sub * 3.3;
    const at = 0.3 + 0.45 * seededRand(fs + 1);
    polyAt(b.path, BOLT_POINTS, at, _q);
    polyAt(b.path, BOLT_POINTS, Math.min(1, at + 0.08), _r);
    _t.subVectors(_r, _q).normalize();
    perpBasis(_t, _u, _s);
    const ang = seededRand(fs + 2) * Math.PI * 2;
    const reach = len * (0.22 + 0.16 * seededRand(fs + 3));
    _n.copy(_t).multiplyScalar(0.5).addScaledVector(_u, Math.cos(ang)).addScaledVector(_s, Math.sin(ang)).normalize();
    for (let i = 0; i < FORK_POINTS; i++) {
      const f = i / (FORK_POINTS - 1);
      _pts[i * 3] = _q.x + _n.x * reach * f;
      _pts[i * 3 + 1] = _q.y + _n.y * reach * f;
      _pts[i * 3 + 2] = _q.z + _n.z * reach * f;
      _wid[i] = width * 0.42 * (1 - 0.7 * f);
      _alp[i] = alpha * 0.75 * (1 - 0.6 * f);
    }
    emitStrip(ctx.writer, FORK_POINTS, reach * 0.18, fs + 7, b.color, core * 0.85, 0);
  }
}

function updateCharge(ctx, c) {
  relocate(ctx, c.from);
  relocate(ctx, c.to);

  // An overload whose twin is already gone is only the blast at its one tile.
  if (!c.to) {
    if (resolveTile(ctx, c.from, SURFACE_LIFT, _p, _n)) blast(ctx, c.from, _p, _n, c.color, c.seed + 3);
    c.live = false;
    return;
  }

  tunnelChargeState(c.charge, ctx.nowMs, _chargeState);
  if (!_chargeState.active) { c.live = false; return; }

  if (!resolveTile(ctx, c.from, TUNNEL_ANCHOR_OFFSET, c.vStart, c.n1) ||
      !resolveTile(ctx, c.to, TUNNEL_ANCHOR_OFFSET, c.vEnd, c.n2)) {
    c.live = false;
    return;
  }
  // Dock on the mini-cube face in the tile's LOCAL colour direction — the same
  // convention every tunnel renderer uses, so the surge rides the visible tunnel.
  const d1 = FACE_N[c.from.dirKey], d2 = FACE_N[c.to.dirKey];
  c.dock1.set(d1[0], d1[1], d1[2]);
  c.dock2.set(d2[0], d2[1], d2[2]);
  c.throated = ctx.showTunnels && tunnelFocus.ids.has(c.pairId);
  if (c.throated) {
    buildTunnelPathInto(c.path, c.vStart, c.n1, c.vEnd, c.n2, c.dock1, c.dock2);
  } else {
    c.path.midA.copy(c.dock1).multiplyScalar(TUNNEL_MINI_FACE_R);
    c.path.midB.copy(c.dock2).multiplyScalar(TUNNEL_MINI_FACE_R);
    c.legLen[0] = c.vStart.distanceTo(c.path.midA);
    c.legLen[1] = c.path.midA.distanceTo(c.path.midB);
    c.legLen[2] = c.path.midB.distanceTo(c.vEnd);
  }

  const overload = c.kind === 'overload';
  const quiet = c.kind === 'recover';

  // ── Mouth flash where the surge enters ────────────────────────────────────
  if (!c.started) {
    c.started = true;
    resolveTile(ctx, c.from, SURFACE_LIFT + padLift(ctx, c.from), _p, _n);
    if (overload) {
      blast(ctx, c.from, _p, _n, c.color, c.seed + 3);
      sound(ctx, 'overload', 220, { priority: 1 });
    } else if (!quiet) {
      const birth = c.kind === 'birth';
      ring(ctx, _p, _n, c.color, 0.25, birth ? 1.35 : 0.95, 0.28, birth ? 0.85 : 0.6);
      burst(ctx, _p, _n, c.color, 3, 1.1, c.seed + 1, 0.7);
      if (birth) sound(ctx, 'surge', 180, { haptics: false, priority: 0 });
    }
  }

  // ── Arrival at the twin ───────────────────────────────────────────────────
  if (_chargeState.arrived && !c.arrived) {
    c.arrived = true;
    resolveTile(ctx, c.to, SURFACE_LIFT + padLift(ctx, c.to), _p, _n);
    if (overload) {
      blast(ctx, c.to, _p, _n, c.color, c.seed + 9);
    } else if (!quiet) {
      burst(ctx, _p, _n, c.color, 7 + Math.round(c.heat * 5), 1.9, c.seed + 9, 0.9);
      flash(ctx, _p, _n, c.color, 0.65, 0.11);
      ring(ctx, _p, _n, c.color, 0.3, c.kind === 'birth' ? 1.5 : 1.15, 0.3, 0.8);
      kickRipple(ctx, c.to, _n, c.kind === 'birth' ? 0.1 : 0.07 + c.heat * 0.04);
      shake(ctx, c.kind === 'birth' ? 0.03 : 0.015 + c.heat * 0.015, 0.16);
    }
  }

  if (!ctx.reduced && ctx.nowMs - c.subAt > 38) { c.sub++; c.subAt = ctx.nowMs; }
  const front = _chargeState.front;
  const glow = _chargeState.glow;
  const crackle = ctx.reduced ? 1 : 0.72 + 0.28 * seededRand(c.seed + c.sub * 5.7);

  // Sheath: the wormhole itself, lit from the struck mouth up to the front and
  // hottest right at the front. Also drawn through the cube (x-ray), faintly.
  const sheathW = (overload ? 0.32 : quiet ? 0.1 : 0.17) + c.heat * 0.07;
  for (let i = 0; i < SHEATH_POINTS; i++) {
    const t = i / (SHEATH_POINTS - 1);
    chargePathAt(c, t, _p);
    _pts[i * 3] = _p.x; _pts[i * 3 + 1] = _p.y; _pts[i * 3 + 2] = _p.z;
    const lit = 1 - smooth(clamp01((t - front + 0.03) / 0.06));
    const hot = gauss(t - front, 0.08);
    _alp[i] = glow * Math.min(1, lit * 0.55 * crackle + hot * 1.1);
    _wid[i] = sheathW * (1 + 1.3 * hot);
  }
  emitStrip(ctx.writer, SHEATH_POINTS, ctx.reduced ? 0 : 0.03, c.seed + c.sub * 11, c.color, quiet ? 0.3 : 0.7, 1);

  // Crawling arcs at the surge front — the electricity itself, restless.
  if (_chargeState.arrived && !overload) return;
  const arcs = overload ? 3 : quiet || ctx.lowFx ? 1 : 2;
  const span = overload ? 0.3 : 0.16;
  for (let k = 0; k < arcs; k++) {
    const t0 = Math.max(0, front - span - (overload ? k * 0.2 : 0));
    const t1 = Math.min(1, front + (overload ? 0.02 - k * 0.2 : 0.015));
    if (t1 <= t0) continue;
    for (let i = 0; i < ARC_POINTS; i++) {
      const f = i / (ARC_POINTS - 1);
      chargePathAt(c, t0 + (t1 - t0) * f, _p);
      _pts[i * 3] = _p.x; _pts[i * 3 + 1] = _p.y; _pts[i * 3 + 2] = _p.z;
      _wid[i] = (overload ? 0.18 : 0.11) * (0.6 + 0.4 * Math.sin(Math.PI * f));
      _alp[i] = glow * (0.5 + 0.5 * f);
    }
    emitStrip(ctx.writer, ARC_POINTS, ctx.reduced ? 0.02 : overload ? 0.13 : 0.075, c.seed + k * 29 + c.sub * 7, c.color, 1, 1);
  }
}

function resetStorm(ctx) {
  for (const b of ctx.bolts) b.live = false;
  for (const c of ctx.charges) c.live = false;
  for (const r of ctx.rings) { r.live = false; r.mesh.visible = false; }
  clearSparks(ctx.sparks);
}

export default function ChaosStorm({ cubieRefs, size, onCascadeComplete }) {
  const res = useMemo(() => {
    const stripGeo = createStripGeometry(MAX_STRIPS);
    const stripMats = createStripMaterials();
    const sparks = createSparkPool(MAX_SPARKS);
    const sparkMat = createSparkMaterial();
    const ringGeo = new THREE.RingGeometry(0.3, 0.44, 40);
    const ctx = makeContext();
    ctx.bolts = Array.from({ length: MAX_BOLTS }, makeBolt);
    ctx.charges = Array.from({ length: MAX_CHARGES }, makeCharge);
    ctx.rings = Array.from({ length: MAX_RINGS }, () => makeRing(ringGeo));
    ctx.sparks = sparks;
    ctx.writer = createStripWriter(stripGeo, MAX_STRIPS);
    ctx.gen = chaosStorm.gen;
    return { stripGeo, stripMats, sparkMat, ringGeo, ctx };
  }, []);

  useEffect(() => () => {
    res.stripGeo.dispose();
    res.stripMats.lit.dispose();
    res.stripMats.xray.dispose();
    res.ctx.sparks.geo.dispose();
    res.sparkMat.dispose();
    res.ringGeo.dispose();
    for (const r of res.ctx.rings) r.mat.dispose();
    // The wormhole renderers read these; nothing stays lit once the storm is gone.
    tunnelCharges.clear();
  }, [res]);

  const { ctx } = res;
  ctx.refs = cubieRefs;
  ctx.size = size;
  ctx.complete = onCascadeComplete;

  useFrame((state, delta) => {
    const store = useGameStore.getState();
    ctx.dt = Math.min(delta, 0.05);
    ctx.nowMs = performance.now();
    ctx.cubies = store.cubies;
    ctx.cap = selectEffectiveFlipCap(store);
    ctx.padsOn = store.settings?.flipPads !== 'off' && !store.wormHealerMode;
    ctx.lowFx = !!store.perfReducedFX;
    ctx.showTunnels = !!store.showTunnels;
    ctx.levelHeat = (Math.max(1, Math.min(5, store.chaosLevel || 1)) - 1) / 4;
    // Reduced motion is polled, not read every frame (matchMedia).
    ctx.frame = (ctx.frame ?? 0) + 1;
    if ((ctx.frame & 31) === 1) ctx.reduced = !!store.settings?.reducedMotion || prefersReducedMotion();
    if (ctx.epoch !== store.rotationEpoch) {
      ctx.epoch = store.rotationEpoch;
      ctx.relocMap = null;
    }

    // The round stopped, reset or ended: drop everything mid-flight. The store's
    // bolt list was cleared by the same path, so there is nothing to retire.
    if (ctx.gen !== chaosStorm.gen) {
      ctx.gen = chaosStorm.gen;
      resetStorm(ctx);
    }

    drainChaosStormEvents(ctx.ingest ??= (ev) => {
      if (ev.type === 'bolt' || ev.type === 'ignition') ingestBolt(ctx, ev);
      else if (ev.type === 'charge' || ev.type === 'overload') ingestCharge(ctx, ev);
    });

    ctx.writer.begin();
    for (const b of ctx.bolts) if (b.live) updateBolt(ctx, b);
    for (const c of ctx.charges) if (c.live) updateCharge(ctx, c);
    ctx.writer.end();
    pruneTunnelCharges(ctx.nowMs);

    for (const r of ctx.rings) {
      if (!r.live) continue;
      r.age += ctx.dt;
      const u = r.age / r.dur;
      if (u >= 1) { r.live = false; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(r.s0 + (r.s1 - r.s0) * (1 - (1 - u) * (1 - u)));
      r.mat.opacity = r.peak * (1 - u) * (1 - u);
    }
    stepSparks(ctx.sparks, ctx.dt);
    const cam = state.camera;
    const fov = cam?.isPerspectiveCamera ? cam.fov : 50;
    const pxPerUnit = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    res.sparkMat.uniforms.uScale.value = pxPerUnit;
    res.stripMats.uniforms.uScale.value = pxPerUnit;
    res.stripMats.uniforms.uMinPx.value = 3 * state.viewport.dpr;
    res.stripMats.uniforms.uTime.value += ctx.dt;
  });

  return (
    <group>
      {/* Positions are written in world space into meshes at the origin, so their
          bounding volumes are meaningless — culling is disabled explicitly. */}
      <mesh geometry={res.stripGeo} material={res.stripMats.xray} frustumCulled={false} renderOrder={9} raycast={() => null} dispose={null} />
      <mesh geometry={res.stripGeo} material={res.stripMats.lit} frustumCulled={false} renderOrder={10} raycast={() => null} dispose={null} />
      <points geometry={res.ctx.sparks.geo} material={res.sparkMat} frustumCulled={false} renderOrder={11} raycast={() => null} dispose={null} />
      {res.ctx.rings.map((r, i) => (
        <primitive key={i} object={r.mesh} dispose={null} />
      ))}
    </group>
  );
}
