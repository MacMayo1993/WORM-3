import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { introEnergy } from './introEnergy.js';
import { sampleIntro } from './introChoreography.js';
import { introConfetti, introShockwaves, introFloorY, SHOCKWAVES } from './introMotion.js';

// Bounded accents: one instanced confetti draw, one instanced ring draw and one
// light. No downloaded assets, physics, lights per particle, or per-frame
// geometry allocation. Every position is a function of the intro clock.
export default function IntroEnergy({ time, reducedMotion, performanceMode }) {
  const confetti = useRef();
  const rings = useRef();
  const light = useRef();
  const count = performanceMode ? 32 : 64;
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 0.62), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const { dummy, color } = scratch;
    const energy = introEnergy(time, reducedMotion);
    light.current.intensity = energy.charge * 2.4 + energy.burst * 3.2;

    let flying = 0;
    for (let i = 0; i < count; i++) {
      const piece = introConfetti(i, time, reducedMotion);
      if (piece) {
        flying++;
        dummy.position.fromArray(piece.position);
        dummy.rotation.set(...piece.spin);
        dummy.scale.setScalar(piece.scale);
        confetti.current.setColorAt(i, color.set(piece.color));
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      confetti.current.setMatrixAt(i, dummy.matrix);
    }
    confetti.current.visible = flying > 0;
    confetti.current.instanceMatrix.needsUpdate = true;
    if (confetti.current.instanceColor) confetti.current.instanceColor.needsUpdate = true;

    // Shockwaves ride the paper under the cube, wherever its base is.
    const floor = introFloorY(1 + 1.5 * sampleIntro(time, reducedMotion).open);
    let rippling = 0;
    introShockwaves(time, reducedMotion).forEach((wave, i) => {
      dummy.position.set(0, floor + 0.02, 0);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(wave.opacity > 0 ? wave.radius : 0);
      dummy.updateMatrix();
      rings.current.setMatrixAt(i, dummy.matrix);
      rippling = Math.max(rippling, wave.opacity);
    });
    rings.current.visible = rippling > 0.001;
    rings.current.material.opacity = rippling;
    rings.current.instanceMatrix.needsUpdate = true;
  });

  return <group>
    <instancedMesh ref={confetti} args={[geometry, null, count]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} />
    </instancedMesh>
    <instancedMesh ref={rings} args={[null, null, SHOCKWAVES.length]} frustumCulled={false} renderOrder={-5}>
      <ringGeometry args={[0.94, 1, 64]} />
      <meshBasicMaterial color="#26372d" transparent depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <pointLight ref={light} position={[0, 3, 4]} color="#fff1c9" distance={18} decay={2} />
  </group>;
}
