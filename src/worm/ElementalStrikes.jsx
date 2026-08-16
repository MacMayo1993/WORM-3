// src/worm/ElementalStrikes.jsx
//
// The lightning theme's hero beat: bolts arc out of the charged cube and hit the
// worm.
//
// Staging only. A strike does no damage, no stun, no score, no speed change, no
// heal, and never interrupts input — the worm is a lightning rod, and that is the
// entire joke. Nothing in this file writes to the simulation; it reads the published
// body positions (wormSegments) and the wash clock (wormBuffs) and draws.
//
// ── Why it is not built out of ChaosWave ─────────────────────────────────────
// Chaos bolts look right, but they are driven by tile events and a cascade
// controller that propagates damage. Faking those events to get a decorative strike
// would tie an art effect to a gameplay system. The bolt SHAPE was extracted to
// manifold/boltPath.js instead, and both callers build on that; nothing here
// touches chaos.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// A fixed pool, sized by the quality budget and never grown. Each slot owns one
// core line, one glow line, one branch line and a contact flash, allocated once at
// mount and rewritten in place — a strike costs no allocation and no React render.
// Position buffers are preallocated at full length and drawn with setDrawRange, so
// a bolt with fewer points does not resize a buffer mid-frame.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeBoltPath, makeBoltBranches, boltPointAt } from '../manifold/boltPath.js';
import { makeStrikeState, tickStrikes } from './healerWorm/strikeScheduler.js';
import { elementalEnvelope } from './healerWorm/elementalLifecycle.js';
import { wormBuffs } from './wormBuffs.js';
import { wormSegments } from './wormSegments.js';

const SEGS = 9;                  // segments per bolt → SEGS + 1 points
const POINTS = SEGS + 1;
const BRANCH_SEGS = 4;
const BRANCH_POINTS = BRANCH_SEGS + 1;
const STRIKE_LIFE = 0.34;        // seconds from leader to gone
const SOURCE_LIFT = 2.15;        // how far off the cube the bolt is born

const _target = new THREE.Vector3();
const _source = new THREE.Vector3();
const _pt = [0, 0, 0];
const _ndc = new THREE.Vector3();

/**
 * Where a bolt comes from: out along the cube's own surface normal above the target,
 * pushed sideways so it arrives at an angle rather than dropping straight down.
 *
 * Derived from the target's own position rather than from a fixed corner list, so it
 * keeps working on every cube size and stays correct while a slice is turning.
 */
function strikeSource(target, seed, out) {
  // The dominant axis of a point on a cube surface is the face it is on.
  const ax = Math.abs(target.x), ay = Math.abs(target.y), az = Math.abs(target.z);
  out.set(0, 0, 0);
  if (ax >= ay && ax >= az) out.x = Math.sign(target.x) || 1;
  else if (ay >= az) out.y = Math.sign(target.y) || 1;
  else out.z = Math.sign(target.z) || 1;

  // Two stable tangents, so the lateral offset is in the plane of the face.
  const t1 = Math.abs(out.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tanA = new THREE.Vector3().crossVectors(out, t1).normalize();
  const tanB = new THREE.Vector3().crossVectors(out, tanA).normalize();

  const ang = (seed % 360) * (Math.PI / 180);
  return out.multiplyScalar(SOURCE_LIFT)
    .add(target)
    .addScaledVector(tanA, Math.cos(ang) * 0.9)
    .addScaledVector(tanB, Math.sin(ang) * 0.9);
}

/** Write a polyline into a preallocated position buffer, padding with its last point. */
function writePath(attr, path, capacity) {
  const arr = attr.array;
  const n = Math.min(path.length, capacity);
  for (let i = 0; i < capacity; i++) {
    const p = path[Math.min(i, n - 1)];
    arr[i * 3] = p[0];
    arr[i * 3 + 1] = p[1];
    arr[i * 3 + 2] = p[2];
  }
  attr.needsUpdate = true;
  return n;
}

function makeLineGeometry(points) {
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setDrawRange(0, 0);
  return geo;
}

/**
 * @param {boolean} active     a lightning wash is up
 * @param {boolean} enabled    the gates that change a few times a run (pause, game
 *                             phase, tunnel transit). The per-frame ones — the claim
 *                             freeze and the dissolve — are read live below, because
 *                             a prop computed at render time would be a frame stale
 *                             and could let a bolt fire during the frozen beat.
 * @param {number}  branches   from the quality budget; 0 disables forking
 * @param {number}  pool       concurrent strikes allowed
 * @param {string}  color
 * @param {string}  accent
 */
export default function ElementalStrikes({ active, enabled, branches = 2, pool = 2, color, accent }) {
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = makeStrikeState(0x9e3779b1);

  // One fixed set of slots. Never grown, never reallocated.
  const slots = useMemo(
    () =>
      Array.from({ length: pool }, () => ({
        alive: 0,           // seconds of life left, 0 = free
        core: makeLineGeometry(POINTS),
        glow: makeLineGeometry(POINTS),
        branch: makeLineGeometry(BRANCH_POINTS * 3), // up to three forks, end to end
        branchCount: 0,
        flash: new THREE.Vector3(),
        path: null
      })),
    [pool]
  );

  const coreRefs = useRef([]);
  const glowRefs = useRef([]);
  const branchRefs = useRef([]);
  const flashRefs = useRef([]);
  const headRefs = useRef([]);

  useEffect(
    () => () => {
      for (const s of slots) { s.core.dispose(); s.glow.dispose(); s.branch.dispose(); }
    },
    [slots]
  );

  const elapsedRef = useRef(0);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;

    // ── Age the live bolts ────────────────────────────────────────────────
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const core = coreRefs.current[i];
      const glow = glowRefs.current[i];
      const branch = branchRefs.current[i];
      const flash = flashRefs.current[i];
      const head = headRefs.current[i];
      if (s.alive <= 0) {
        if (core) core.geometry.setDrawRange(0, 0);
        if (glow) glow.geometry.setDrawRange(0, 0);
        if (branch) branch.geometry.setDrawRange(0, 0);
        if (flash) flash.material.opacity = 0;
        if (head) head.material.opacity = 0;
        continue;
      }
      s.alive = Math.max(0, s.alive - dt);
      // p: 0 at the flash of contact → 1 as the last of the charge dies.
      const p = 1 - s.alive / STRIKE_LIFE;

      if (core) {
        // The leader draws itself along the path, then the whole thing fades.
        const drawn = Math.max(2, Math.ceil(Math.min(1, p / 0.35) * (POINTS - 1)) + 1);
        core.geometry.setDrawRange(0, drawn);
        core.material.opacity = p < 0.35 ? 1 : Math.max(0, 1 - (p - 0.35) / 0.65);
      }
      if (glow) {
        glow.geometry.setDrawRange(0, POINTS);
        glow.material.opacity = Math.max(0, 0.6 * (1 - p) * (1 - p));
      }
      if (branch) {
        // Forks arrive late and die before the leader does, so they add texture
        // near the impact without competing with it.
        const show = p > 0.28 && p < 0.7 && s.branchCount > 0;
        branch.geometry.setDrawRange(0, show ? s.branchCount * BRANCH_POINTS : 0);
        branch.material.opacity = show ? 0.55 * (1 - (p - 0.28) / 0.42) : 0;
      }
      if (head && s.path) {
        // Spark head riding the leader. WebGL draws `line` at one pixel whatever
        // linewidth says, so the bolt on its own is a hairline at any resolution —
        // this is what gives the strike visible mass while it travels, the same job
        // the head sphere does for a chaos bolt.
        const lead = Math.min(1, p / 0.35);
        boltPointAt(_pt, s.path, lead);
        head.position.set(_pt[0], _pt[1], _pt[2]);
        head.material.opacity = p < 0.35 ? 0.95 : Math.max(0, 0.95 - (p - 0.35) * 3.4);
        head.scale.setScalar(0.16 * (1 - p * 0.4));
      }
      if (flash) {
        // Contact: a hard white-blue pop where the bolt lands, gone fast. Sized to
        // read from the overview camera without becoming a screen-wide flash — the
        // accessibility line here is "localized and brief", not "bright".
        const bang = p < 0.5 ? Math.sin(Math.min(1, p / 0.5) * Math.PI) : 0;
        flash.material.opacity = bang * 0.95;
        flash.scale.setScalar(0.26 + bang * 0.85);
        flash.position.copy(s.flash);
      }
    }

    // ── Schedule the next one ─────────────────────────────────────────────
    // The same envelope the skin, the light and the particles run on. wormBuffs
    // mirrors the sim clock, so this freezes on pause and during tunnel transit.
    const env = elementalEnvelope({ elapsed: elapsedRef.current, remaining: wormBuffs.elementalT });
    const count = active ? wormSegments.count : 0;
    const free = slots.findIndex((s) => s.alive <= 0);
    const strike = tickStrikes(stateRef.current, dt, {
      // A slot must be free too: without this the schedule would keep firing into a
      // full pool and silently drop strikes, which reads as the effect stuttering.
      // `accents` is false during the claim freeze and for the whole dissolve, so
      // no bolt is ever born that would be cut off mid-life.
      enabled: !!enabled && free !== -1 && env.accents,
      targetCount: count,
      visible: (i) => {
        // On camera, and in front of it. Projecting is cheap at ~1 call/second.
        _ndc.set(
          wormSegments.positions[i * 3],
          wormSegments.positions[i * 3 + 1],
          wormSegments.positions[i * 3 + 2]
        ).project(camera);
        return _ndc.z < 1 && Math.abs(_ndc.x) < 0.92 && Math.abs(_ndc.y) < 0.92;
      }
    });

    if (!strike) return;

    const s = slots[free];
    const i = strike.targetIndex;
    _target.set(
      wormSegments.positions[i * 3],
      wormSegments.positions[i * 3 + 1],
      wormSegments.positions[i * 3 + 2]
    );
    strikeSource(_target, strike.seed, _source);

    // Both endpoints are snapshotted, not tracked. The bolt lives a third of a
    // second; re-resolving its target every frame would make it rubber-band along
    // behind a crawling worm instead of landing.
    const path = makeBoltPath(
      [_source.x, _source.y, _source.z],
      [_target.x, _target.y, _target.z],
      { segs: SEGS, jitter: 0.16, seed: strike.seed }
    );
    s.path = path;
    writePath(s.core.getAttribute('position'), path, POINTS);
    writePath(s.glow.getAttribute('position'), path, POINTS);

    const forks = branches > 0 ? makeBoltBranches(path, { count: Math.min(3, branches), seed: strike.seed, segs: BRANCH_SEGS }) : [];
    s.branchCount = forks.length;
    if (forks.length) {
      // All forks share one line, laid end to end. A LineSegments-style break would
      // need a second draw; joining them costs one stray connecting segment that is
      // invisible at these opacities and saves a draw call per strike.
      const attr = s.branch.getAttribute('position');
      const arr = attr.array;
      for (let f = 0; f < forks.length; f++) {
        for (let k = 0; k < BRANCH_POINTS; k++) {
          const p = forks[f][Math.min(k, forks[f].length - 1)];
          const o = (f * BRANCH_POINTS + k) * 3;
          arr[o] = p[0]; arr[o + 1] = p[1]; arr[o + 2] = p[2];
        }
      }
      attr.needsUpdate = true;
    }

    boltPointAt(_pt, path, 1);
    s.flash.set(_pt[0], _pt[1], _pt[2]);
    s.alive = STRIKE_LIFE;
  });

  if (!active) return null;

  return (
    <group>
      {slots.map((s, i) => (
        <group key={i}>
          <line ref={(el) => { glowRefs.current[i] = el; }} geometry={s.glow} raycast={() => null}>
            <lineBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </line>
          <line ref={(el) => { coreRefs.current[i] = el; }} geometry={s.core} raycast={() => null}>
            <lineBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </line>
          <line ref={(el) => { branchRefs.current[i] = el; }} geometry={s.branch} raycast={() => null}>
            <lineBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </line>
          <mesh ref={(el) => { headRefs.current[i] = el; }} raycast={() => null}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={(el) => { flashRefs.current[i] = el; }} raycast={() => null}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
