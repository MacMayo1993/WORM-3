import React, { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePickupMaterials } from './usePickupMaterials.js';
import { resetPickupMaterials } from './pickupMaterials.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  PICKUP_BURST_SECONDS, PICKUP_MAX_SPARKS, PICKUP_MOTES,
  pickupCore, pickupRing, pickupSpark, pickupMote, pickupSparkCount,
} from './orbPickupBurst.js';

// The orb pickup burst: a white-hot core swallowed at the head, two shock rings
// running flat along the tile, motion-stretched sparks fanned over the face, and
// charge motes spiralling up — all in the orb's colour, all laid out in the
// tile's frame (orbPickupBurst.js has the motion). Replaces the old expanding
// light sphere, which read the same on every face and every pickup.
//
// Bounded: four meshes and two instanced draws per burst, shared geometry, no
// per-frame allocation. Only the core is additive — it is the flash. Rings,
// sparks and motes draw in the orb's true colour, so they stay readable on the
// light arcade tiles (white and yellow faces would wash an additive glow out);
// sparks fade by shrinking, which keeps one material for all of them.

const Z_UP = new THREE.Vector3(0, 0, 1);
const Y_UP = new THREE.Vector3(0, 1, 0);
const CORE = new THREE.SphereGeometry(1, 16, 12);
const RING = new THREE.RingGeometry(0.9, 1, 48);
const SHARD = new THREE.OctahedronGeometry(0.5);
const MOTE = new THREE.OctahedronGeometry(0.5, 1);
const WHITE = new THREE.Color('#ffffff');
const dummy = new THREE.Object3D(), dir = new THREE.Vector3(), normal = new THREE.Vector3();

export default function OrbPickupBurst({ position, normal: surfaceNormal, color = '#ffd700', combo = 0, pickup = true, reducedMotion = false, onDone }) {
  const materials = usePickupMaterials(color);
  const root = useRef(), core = useRef(), coreHalo = useRef(), rings = useRef([]), sparks = useRef(), motes = useRef();
  const age = useRef(0), done = useRef(false);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const sparkCount = reducedMotion ? 0 : pickupSparkCount(combo);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z_UP,
    normal.fromArray(surfaceNormal ?? [0, 0, 1]).normalize()), [surfaceNormal]);

  // Instances start at identity; hide them before the first draw, in case the
  // game pauses on the very frame the orb was eaten.
  useLayoutEffect(() => {
    dummy.scale.setScalar(0); dummy.updateMatrix();
    for (const mesh of [sparks.current, motes.current]) {
      if (!mesh) continue;
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [materials]);

  // Built once: the frame loop allocates nothing.
  const parts = useMemo(() => ({ core, coreHalo, rings, sparks, motes }), []);
  const look = useRef({});
  look.current.combo = combo; look.current.reducedMotion = reducedMotion; look.current.sparkCount = sparkCount; look.current.base = base;

  useFrame((_state, delta) => {
    if (!materials) return;
    if (pickup && useGameStore.getState().wormPaused) return;
    age.current += delta;
    if (poseBurst(parts, age.current, look.current) && !done.current) {
      done.current = true;
      root.current.visible = false;
      onDone?.();
    }
  });

  if (!materials) return null;
  return (
    <group ref={root} position={position} quaternion={quaternion}>
      <BurstParts materials={materials} reducedMotion={reducedMotion} core={core} coreHalo={coreHalo} rings={rings} sparks={sparks} motes={motes} />
    </group>
  );
}

// One frame of a burst at time t (seconds since the pickup), from the parts' refs.
// True once it is over. Allocates nothing.
function poseBurst(parts, t, { combo, reducedMotion, sparkCount, base }) {
  const core = parts.core.current, coreHalo = parts.coreHalo.current, rings = parts.rings.current;
  const sparks = parts.sparks.current, motes = parts.motes.current;
  const c = pickupCore(t);
  core.visible = coreHalo.visible = !!c;
  if (c) {
    const s = reducedMotion ? c.scale * 0.6 : c.scale;
    core.scale.setScalar(s * 0.55);
    core.material.opacity = c.opacity;
    coreHalo.scale.setScalar(s);
    coreHalo.material.opacity = c.opacity * 0.7;
  }

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    // Reduced motion keeps one quiet, stationary ring: the cue without the travel.
    const r = reducedMotion ? (i === 0 ? pickupRing(0, t) : null) : pickupRing(i, t, combo);
    ring.visible = !!r;
    if (!r) continue;
    ring.scale.setScalar(reducedMotion ? 0.45 : r.radius);
    ring.material.opacity = reducedMotion ? r.opacity * 0.5 : r.opacity;
  }

  if (sparkCount && sparks && motes) {
    for (let i = 0; i < PICKUP_MAX_SPARKS; i++) {
      const s = i < sparkCount ? pickupSpark(i, t, sparkCount) : null;
      if (s) {
        dummy.position.fromArray(s.position);
        dummy.quaternion.setFromUnitVectors(Y_UP, dir.fromArray(s.direction));
        const fade = 0.3 + 0.7 * s.opacity;
        dummy.scale.set(0.035 * fade, s.length * fade, 0.035 * fade);
        sparks.setColorAt(i, s.white ? WHITE : base);
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;

    for (let i = 0; i < PICKUP_MOTES; i++) {
      const m = pickupMote(i, t);
      dummy.quaternion.identity();
      if (m) {
        dummy.position.fromArray(m.position);
        dummy.scale.setScalar(m.scale);
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      motes.setMatrixAt(i, dummy.matrix);
    }
    motes.instanceMatrix.needsUpdate = true;
  }
  return t >= PICKUP_BURST_SECONDS;
}

// Hide every spark and mote instance (they start at identity).
function hideInstances(...meshes) {
  dummy.position.set(0, 0, 0); dummy.quaternion.identity(); dummy.scale.setScalar(0); dummy.updateMatrix();
  for (const mesh of meshes) {
    if (!mesh) continue;
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function BurstParts({ materials, reducedMotion, core, coreHalo, rings, sparks, motes }) {
  return <>
    <mesh ref={core} geometry={CORE} visible={false}>
      <primitive object={materials.core} attach="material" />
    </mesh>
    <mesh ref={coreHalo} geometry={CORE} visible={false}>
      <primitive object={materials.halo} attach="material" />
    </mesh>
    {[materials.ring, materials.ringWhite].map((material, i) => (
      <mesh key={i} ref={el => { rings.current[i] = el; }} geometry={RING} visible={false}>
        <primitive object={material} attach="material" />
      </mesh>
    ))}
    {!reducedMotion && (
      <>
        <instancedMesh ref={sparks} args={[SHARD, null, PICKUP_MAX_SPARKS]} frustumCulled={false}>
          <primitive object={materials.sparks} attach="material" />
        </instancedMesh>
        <instancedMesh ref={motes} args={[MOTE, null, PICKUP_MOTES]} frustumCulled={false}>
          <primitive object={materials.motes} attach="material" />
        </instancedMesh>
      </>
    )}
  </>;
}

/**
 * A burst that stays mounted and is restarted from a frame loop: OrbFlashSystem
 * keeps four and hands each pickup to the next (start), so eating an orb costs no
 * React render and no mount. Holds one material set from the pool for its life.
 */
export const PickupBurstSlot = forwardRef(function PickupBurstSlot({ pickup = true, reducedMotion = false }, ref) {
  const materials = usePickupMaterials('#ffd700');
  const root = useRef(), core = useRef(), coreHalo = useRef(), rings = useRef([]), sparks = useRef(), motes = useRef();
  const run = useRef({ active: false, age: 0, combo: 0, sparkCount: 0, reducedMotion, base: new THREE.Color() });
  const parts = useMemo(() => ({ core, coreHalo, rings, sparks, motes }), []);
  run.current.reducedMotion = reducedMotion;
  useImperativeHandle(ref, () => ({
    /** Play a burst at a world position on a surface; false until the materials are ready. */
    start(position, surfaceNormal, color, combo = 0) {
      if (!materials || !root.current) return false;
      const r = run.current;
      resetPickupMaterials(materials, color);
      r.base.set(color);
      r.combo = combo; r.sparkCount = reducedMotion ? 0 : pickupSparkCount(combo); r.age = 0; r.active = true;
      root.current.position.fromArray(position);
      root.current.quaternion.setFromUnitVectors(Z_UP, normal.fromArray(surfaceNormal ?? [0, 0, 1]).normalize());
      hideInstances(sparks.current, motes.current);
      root.current.visible = true;
      return true;
    },
    stop() { run.current.active = false; if (root.current) root.current.visible = false; },
    get active() { return run.current.active; },
    get age() { return run.current.age; },
  }), [materials, reducedMotion]);

  useFrame((_state, delta) => {
    const r = run.current, group = root.current;
    // Idle slots stay hidden (a Suspense resume unhides instances).
    if (!r.active || !materials) { if (group?.visible) group.visible = false; return; }
    if (pickup && useGameStore.getState().wormPaused) return;
    r.age += delta;
    if (poseBurst(parts, r.age, r)) { r.active = false; group.visible = false; }
  });

  if (!materials) return null;
  return (
    <group ref={root} visible={false}>
      <BurstParts materials={materials} reducedMotion={reducedMotion} core={core} coreHalo={coreHalo} rings={rings} sparks={sparks} motes={motes} />
    </group>
  );
});
