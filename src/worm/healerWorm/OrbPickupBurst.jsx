import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
const solid = { transparent: true, depthWrite: false, toneMapped: false };

export default function OrbPickupBurst({ position, normal: surfaceNormal, color = '#ffd700', combo = 0, pickup = true, reducedMotion = false, onDone }) {
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
  }, []);

  useFrame((_state, delta) => {
    if (pickup && useGameStore.getState().wormPaused) return;
    age.current += delta;
    const t = age.current;

    const c = pickupCore(t);
    core.current.visible = coreHalo.current.visible = !!c;
    if (c) {
      const s = reducedMotion ? c.scale * 0.6 : c.scale;
      core.current.scale.setScalar(s * 0.55);
      core.current.material.opacity = c.opacity;
      coreHalo.current.scale.setScalar(s);
      coreHalo.current.material.opacity = c.opacity * 0.7;
    }

    rings.current.forEach((ring, i) => {
      // Reduced motion keeps one quiet, stationary ring: the cue without the travel.
      const r = reducedMotion ? (i === 0 ? pickupRing(0, t) : null) : pickupRing(i, t, combo);
      ring.visible = !!r;
      if (!r) return;
      ring.scale.setScalar(reducedMotion ? 0.45 : r.radius);
      ring.material.opacity = reducedMotion ? r.opacity * 0.5 : r.opacity;
    });

    if (sparkCount) {
      for (let i = 0; i < PICKUP_MAX_SPARKS; i++) {
        const s = i < sparkCount ? pickupSpark(i, t, sparkCount) : null;
        if (s) {
          dummy.position.fromArray(s.position);
          dummy.quaternion.setFromUnitVectors(Y_UP, dir.fromArray(s.direction));
          const fade = 0.3 + 0.7 * s.opacity;
          dummy.scale.set(0.035 * fade, s.length * fade, 0.035 * fade);
          sparks.current.setColorAt(i, s.white ? WHITE : base);
        } else dummy.scale.setScalar(0);
        dummy.updateMatrix();
        sparks.current.setMatrixAt(i, dummy.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
      if (sparks.current.instanceColor) sparks.current.instanceColor.needsUpdate = true;

      for (let i = 0; i < PICKUP_MOTES; i++) {
        const m = pickupMote(i, t);
        dummy.quaternion.identity();
        if (m) {
          dummy.position.fromArray(m.position);
          dummy.scale.setScalar(m.scale);
        } else dummy.scale.setScalar(0);
        dummy.updateMatrix();
        motes.current.setMatrixAt(i, dummy.matrix);
      }
      motes.current.instanceMatrix.needsUpdate = true;
    }

    if (t >= PICKUP_BURST_SECONDS && !done.current) {
      done.current = true;
      root.current.visible = false;
      onDone?.();
    }
  });

  return (
    <group ref={root} position={position} quaternion={quaternion}>
      <mesh ref={core} geometry={CORE} visible={false}>
        <meshBasicMaterial color="#ffffff" {...additive} />
      </mesh>
      <mesh ref={coreHalo} geometry={CORE} visible={false}>
        <meshBasicMaterial color={color} {...additive} side={THREE.BackSide} />
      </mesh>
      {[color, '#ffffff'].map((ringColor, i) => (
        <mesh key={i} ref={el => { rings.current[i] = el; }} geometry={RING} visible={false}>
          <meshBasicMaterial color={ringColor} {...solid} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {!reducedMotion && (
        <>
          <instancedMesh ref={sparks} args={[SHARD, null, PICKUP_MAX_SPARKS]} frustumCulled={false}>
            <meshBasicMaterial {...solid} />
          </instancedMesh>
          <instancedMesh ref={motes} args={[MOTE, null, PICKUP_MOTES]} frustumCulled={false}>
            <meshBasicMaterial color={color} {...solid} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
