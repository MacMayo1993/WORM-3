// src/manifold/ChaosIgnitionMarker.jsx
//
// Marks the tile the player picked for chaos's first strike while the round
// waits to go live: a charged target ring on the tile, pulsing, with a ripple
// running outward. It follows the live cubie (so a slice turned after the pick
// carries the mark with it) and re-finds the sticker by grid id if a committed
// turn moves it to another slot. At GO the mark goes and the sky answers it
// (ChaosStorm's hero strike).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { prefersReducedMotion } from '../utils/device.js';
import { stormMeshIndex } from '../game/chaosStormEvents.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { ignitionCandidates } from '../game/chaosIgnition.js';

const FACE_N = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};
const COLOR = '#8ef3ff';
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);

const additive = (opacity) => new THREE.MeshBasicMaterial({
  color: COLOR, transparent: true, opacity, blending: THREE.AdditiveBlending,
  depthWrite: false, side: THREE.DoubleSide, toneMapped: false
});

/** The slot holding `gridId` on this board: the stored one if still true, else a scan. */
function locate(cubies, size, tile) {
  const st = cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
  if (st && getManifoldGridId(st, size) === tile.gridId) return tile;
  return ignitionCandidates(cubies, size).find((c) => c.gridId === tile.gridId) ?? null;
}

export default function ChaosIgnitionMarker({ cubieRefs, size }) {
  const tile = useGameStore((s) => (s.chaosLevel === 0 ? s.chaosIgnition : null));
  const res = useMemo(() => ({
    ringGeo: new THREE.RingGeometry(0.36, 0.46, 48),
    coreGeo: new THREE.RingGeometry(0.12, 0.2, 32),
    discGeo: new THREE.CircleGeometry(0.44, 40),
    ring: additive(0.9),
    ripple: additive(0.6),
    core: additive(0.9),
    disc: additive(0.22)
  }), []);
  useEffect(() => () => {
    for (const k of ['ringGeo', 'coreGeo', 'discGeo', 'ring', 'ripple', 'core', 'disc']) res[k].dispose();
  }, [res]);

  const groupRef = useRef();
  const ringRef = useRef();
  const rippleRef = useRef();
  const clock = useRef({ t: 0, born: 0, tile: null, cubies: null, at: null, reduced: false, frame: 0 });

  useFrame((_state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const c = clock.current;
    if (!tile) { g.visible = false; c.tile = null; return; }
    c.t += Math.min(delta, 0.05);
    if ((c.frame++ & 31) === 0) c.reduced = !!useGameStore.getState().settings?.reducedMotion || prefersReducedMotion();
    if (c.tile !== tile) { c.tile = tile; c.born = c.t; c.cubies = null; }
    const cubies = useGameStore.getState().cubies;
    if (c.cubies !== cubies) { c.cubies = cubies; c.at = locate(cubies, size, tile); }
    const at = c.at;
    const piece = at ? cubieRefs?.[stormMeshIndex(at, size)] : null;
    const n = at ? FACE_N[at.dirKey] : null;
    if (!piece || !n) { g.visible = false; return; }
    piece.updateWorldMatrix(true, false);
    _p.setFromMatrixPosition(piece.matrixWorld);
    _n.set(n[0], n[1], n[2]).transformDirection(piece.matrixWorld);
    g.visible = true;
    g.position.copy(_p).addScaledVector(_n, SURFACE_OFFSET + 0.045);
    g.quaternion.setFromUnitVectors(_z, _n);

    // Pops in large and settles onto the tile, so a pick lands with a beat.
    const age = c.t - c.born;
    const pop = age < 0.25 ? 1 + 0.6 * (1 - age / 0.25) ** 2 : 1;
    g.scale.setScalar(pop);
    const pulse = c.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(c.t * 6.5);
    if (ringRef.current) ringRef.current.scale.setScalar(1 + 0.12 * pulse);
    res.ring.opacity = 0.65 + 0.35 * pulse;
    res.disc.opacity = 0.14 + 0.16 * pulse;
    res.core.opacity = 0.6 + 0.4 * (1 - pulse);
    if (rippleRef.current) {
      const r = c.reduced ? 0 : (c.t * 1.1) % 1;
      rippleRef.current.visible = !c.reduced;
      rippleRef.current.scale.setScalar(1 + r * 1.3);
      res.ripple.opacity = 0.6 * (1 - r) * (1 - r);
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={12}>
      <mesh geometry={res.discGeo} material={res.disc} raycast={() => null} dispose={null} renderOrder={12} />
      <mesh ref={ringRef} geometry={res.ringGeo} material={res.ring} raycast={() => null} dispose={null} renderOrder={12} />
      <mesh ref={rippleRef} geometry={res.ringGeo} material={res.ripple} raycast={() => null} dispose={null} renderOrder={12} />
      <mesh geometry={res.coreGeo} material={res.core} raycast={() => null} dispose={null} renderOrder={12} />
    </group>
  );
}
