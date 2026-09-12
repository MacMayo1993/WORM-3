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
// A fixed pool bounds concurrent strikes. Core and halo tubes are rebuilt only
// when a new strike is born; replaced geometry is disposed immediately. Branch
// segment buffers are reused, and no geometry changes during a strike's lifetime.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeBoltPath, makeBoltBranches, boltPointAt } from '../manifold/boltPath.js';
import { makeStrikeState, tickStrikes } from './healerWorm/strikeScheduler.js';
import { STRIKE_LIFE, strikeVisuals } from './healerWorm/strikeVisuals.js';
import { elementalEnvelope } from './healerWorm/elementalLifecycle.js';
import { wormBuffs } from './wormBuffs.js';
import { wormSegments } from './wormSegments.js';

const SEGS = 20;                 // segments per bolt → SEGS + 1 points (a tall sky
                                 // bolt wants more segments than a short surface arc)
const POINTS = SEGS + 1;
const BRANCH_SEGS = 4;
// Lateral wander of the launch point away from straight-above, so successive sky
// bolts don't all fall down the exact same line.
const SKY_WOBBLE = 0.55;

const _target = new THREE.Vector3();
const _source = new THREE.Vector3();
const _pt = [0, 0, 0];
const _ndc = new THREE.Vector3();

/**
 * Where a bolt comes from: high overhead in WORLD space — above the top of the
 * screen — so every strike falls out of the sky and comes down onto the cube,
 * rather than arcing off the surface. The launch keeps the target's horizontal
 * position (plus a small seeded wander) and only raises Y, so the drop stays
 * dominantly vertical however the cube is turned.
 *
 * `skyY` is an absolute world height above the cube, supplied by the caller from
 * the board's size, so the source clears the cube top on every board.
 */
function strikeSource(target, seed, skyY, out) {
  const ang = (seed % 360) * (Math.PI / 180);
  out.set(
    target.x + Math.cos(ang) * SKY_WOBBLE,
    // Clearly above the cube — and never below the target, for the rare hit near
    // the very top of a mega board.
    Math.max(skyY, target.y + 3.0),
    target.z + Math.sin(ang) * SKY_WOBBLE
  );
  return out;
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
 * @param {number}  skyY       world height the bolts launch from, above the cube
 * @param {string}  color
 * @param {string}  accent
 */
export default function ElementalStrikes({ active, enabled, branches = 2, pool = 2, skyY = 12, color, accent }) {
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = makeStrikeState(0x9e3779b1);

  // One fixed set of slots. Never grown, never reallocated.
  const slots = useMemo(
    () =>
      Array.from({ length: pool }, () => ({
        alive: 0,           // seconds of life left, 0 = free
        core: makeLineGeometry(POINTS),
        glow: makeLineGeometry(POINTS),
        branch: makeLineGeometry(BRANCH_SEGS * 2 * 3), // up to three forks, end to end
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
    const dt = enabled ? Math.min(delta, 0.05) : 0;
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
      const age = STRIKE_LIFE - s.alive;
      const visual = strikeVisuals(age);
      if (core) {
        core.geometry.setDrawRange(0, Infinity);
        core.material.opacity = visual.core;
      }
      if (glow) {
        glow.geometry.setDrawRange(0, Infinity);
        glow.material.opacity = visual.glow;
      }
      if (branch) {
        branch.geometry.setDrawRange(0, s.branchCount * BRANCH_SEGS * 2);
        branch.material.opacity = visual.branches;
      }
      if (head && s.path) {
        boltPointAt(_pt, s.path, visual.leader);
        head.position.set(_pt[0], _pt[1], _pt[2]);
        head.material.opacity = visual.leader < 1 ? 0.45 * visual.leader : 0;
        head.scale.setScalar(0.10);
      }
      if (flash) {
        flash.material.opacity = visual.impact * 0.7;
        flash.scale.setScalar(0.2 + visual.impact * 0.45);
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
    strikeSource(_target, strike.seed, skyY, _source);

    // Both endpoints are snapshotted, not tracked. The charge and afterglow keep one stable silhouette; re-resolving its target every frame would make it rubber-band along
    // behind a crawling worm instead of landing.
    const path = makeBoltPath(
      [_source.x, _source.y, _source.z],
      [_target.x, _target.y, _target.z],
      // Lower relative jitter than the old short surface arc — the sky bolt is long,
      // and jitter is a fraction of length, so 0.16 over this span read as too wide.
      { segs: SEGS, jitter: 0.11, seed: strike.seed }
    );
    s.path = path;
    // Build width once per strike; do not regenerate its jagged shape per frame.
    const curve = new THREE.CurvePath();
    for (let k = 1; k < path.length; k++) {
      curve.add(new THREE.LineCurve3(new THREE.Vector3(...path[k - 1]), new THREE.Vector3(...path[k])));
    }
    s.core.dispose(); s.glow.dispose();
    s.core = new THREE.TubeGeometry(curve, SEGS * 3, 0.022, 4, false);
    s.glow = new THREE.TubeGeometry(curve, SEGS * 3, 0.065, 4, false);
    if (coreRefs.current[free]) coreRefs.current[free].geometry = s.core;
    if (glowRefs.current[free]) glowRefs.current[free].geometry = s.glow;

    const forks = branches > 0 ? makeBoltBranches(path, { count: Math.min(3, branches), seed: strike.seed, segs: BRANCH_SEGS }) : [];
    s.branchCount = forks.length;
    if (forks.length) {
      // Independent line segments prevent a spurious bridge between forks.
      const attr = s.branch.getAttribute('position');
      const arr = attr.array;
      for (let f = 0; f < forks.length; f++) {
        for (let k = 0; k < BRANCH_SEGS; k++) {
          for (let end = 0; end < 2; end++) {
            const p = forks[f][Math.min(k + end, forks[f].length - 1)];
            const o = (f * BRANCH_SEGS * 2 + k * 2 + end) * 3;
            arr[o] = p[0]; arr[o + 1] = p[1]; arr[o + 2] = p[2];
          }
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
          <mesh ref={(el) => { glowRefs.current[i] = el; }} geometry={s.glow} raycast={() => null}>
            <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={(el) => { coreRefs.current[i] = el; }} geometry={s.core} raycast={() => null}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <lineSegments ref={(el) => { branchRefs.current[i] = el; }} geometry={s.branch} raycast={() => null}>
            <lineBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </lineSegments>
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
