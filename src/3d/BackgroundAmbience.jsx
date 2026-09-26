// Each distant cube owns a palette and a uniform style, in one instanced draw.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { prefersReducedMotion } from '../utils/device.js';
import { ambienceLayout, cubePositionAt } from './backgroundAmbience.js';
import { ambienceCubeGeometry, ambienceCubeMaterial } from './ambienceCubeMaterial.js';
const noRaycast = () => null;

export default function BackgroundAmbience({ size = 3 }) {
  const reducedFX = useGameStore(s => s.perfReducedFX);
  const [seed] = useState(() => Math.floor(Math.random() * 0x100000000));
  const layout = useMemo(() => ambienceLayout(size, reducedFX ? 'reduced' : 'full', seed), [size, reducedFX, seed]);
  const still = useMemo(() => prefersReducedMotion(), []);
  const geometry = useMemo(() => ambienceCubeGeometry(layout.cubes), [layout]);
  const material = useMemo(() => ambienceCubeMaterial(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const mesh = useRef(null);
  const clock = useRef(0);
  const position = useMemo(() => [0, 0, 0], []);
  const matrix = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame((_, delta) => {
    if (!still) clock.current += Math.min(delta, 0.1);
    const instanced = mesh.current;
    if (!instanced) return;
    const t = clock.current;
    layout.cubes.forEach((cube, i) => {
      cubePositionAt(cube, t, position);
      matrix.p.fromArray(position);
      matrix.e.set(cube.spin[0] * t + cube.phase, cube.spin[1] * t + cube.phase * 0.7, cube.spin[2] * t);
      matrix.q.setFromEuler(matrix.e);
      matrix.s.setScalar(cube.scale);
      instanced.setMatrixAt(i, matrix.m.compose(matrix.p, matrix.q, matrix.s));
    });
    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh key={layout.cubes.length} ref={mesh} args={[geometry, material, layout.cubes.length]}
        raycast={noRaycast} frustumCulled={false} />
    </group>
  );
}
