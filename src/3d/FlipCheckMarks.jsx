// src/3d/FlipCheckMarks.jsx
// Flip Cube levels' Check: a ring on every tile that is not yet right
// (flipCheckTiles): an ink ring inside a white one, so it reads on every face colour,
// red included. Two instanced draws sharing one set of matrices; hidden while a layer
// turns, when the rings would stand where the tiles were. It sits above a flipped
// tile's portal lens (PORTAL_TOP), which would otherwise cover it.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { flipCheckTiles } from '../game/flipCheck.js';
import { getStickerWorldPos } from '../game/gridIds.js';
import { prefersReducedMotion } from '../utils/device.js';
import { PORTAL_TOP } from './flipPortal.js';

const MAX_MARKS = 54;
const LIFT = PORTAL_TOP + 0.01;
const FACE_TURN = {
  PX: [0, Math.PI / 2, 0], NX: [0, -Math.PI / 2, 0], PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0], PZ: [0, 0, 0], NZ: [0, Math.PI, 0],
};
const NORMAL = { PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1] };
export const CHECK_MARK_INK = '#14232b';
export const CHECK_MARK_HALO = '#fffdf2';

const _matrix = new THREE.Matrix4(), _quat = new THREE.Quaternion(), _euler = new THREE.Euler();
const _pos = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);

// `warm` draws one ring at zero opacity so the rings' programs link during the
// level's briefing rather than the moment the player first taps Check.
export default function FlipCheckMarks({ warm = false }) {
  const on = useGameStore(s => warm || (s.flipCheck && s.currentLevelData?.scoring === 'flips'));
  const cubies = useGameStore(s => s.cubies);
  const size = useGameStore(s => s.size);
  const turning = useGameStore(s => !!s.animState);
  const tiles = useMemo(() => (warm ? [{ x: 0, y: size - 1, z: size - 1, dirKey: 'PZ' }] : on ? flipCheckTiles(cubies, size) : []), [warm, on, cubies, size]);
  const rings = useMemo(() => [[0.3, 0.46, CHECK_MARK_HALO, 4], [0.33, 0.43, CHECK_MARK_INK, 5]].map(([inner, outer, color, order]) => {
    const m = new THREE.InstancedMesh(new THREE.RingGeometry(inner, outer, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), MAX_MARKS);
    m.name = 'FlipCheckMarks';
    m.frustumCulled = false;
    m.renderOrder = order;
    return m;
  }), []);
  const [mesh, ink] = rings;
  const ref = useRef(mesh);
  useLayoutEffect(() => () => rings.forEach(m => { m.geometry.dispose(); m.material.dispose(); }), [rings]);
  useLayoutEffect(() => {
    tiles.slice(0, MAX_MARKS).forEach((t, i) => {
      const p = getStickerWorldPos(t.x, t.y, t.z, t.dirKey, size);
      const n = NORMAL[t.dirKey];
      _pos.set(p[0] + n[0] * LIFT, p[1] + n[1] * LIFT, p[2] + n[2] * LIFT);
      _quat.setFromEuler(_euler.set(...FACE_TURN[t.dirKey]));
      mesh.setMatrixAt(i, _matrix.compose(_pos, _quat, _one));
    });
    mesh.count = ink.count = Math.min(tiles.length, MAX_MARKS);
    ink.instanceMatrix.array.set(mesh.instanceMatrix.array.subarray(0, mesh.count * 16));
    mesh.instanceMatrix.needsUpdate = ink.instanceMatrix.needsUpdate = true;
  }, [mesh, ink, tiles, size]);
  useFrame(({ clock }) => {
    const shown = on && !turning && mesh.count > 0;
    const opacity = warm ? 0 : prefersReducedMotion() ? 0.95 : 0.8 + Math.sin(clock.elapsedTime * 3) * 0.15;
    for (const m of rings) { m.visible = shown; m.material.opacity = opacity; }
  });
  return <group><primitive ref={ref} object={mesh} /><primitive object={ink} /></group>;
}
