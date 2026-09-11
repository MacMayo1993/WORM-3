import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import MenuWormParticle from './MenuWormParticle.jsx';
import { isCarouselActive } from './menuCarouselState.js';

const waveGeometry = new THREE.RingGeometry(0.8, 1, 32);
const portalGeometry = new THREE.RingGeometry(0.19, 0.23, 40);

// One paused clock drives the pair, their portal pulses and tail completion.
// There is deliberately no wall-clock timeout that can rotate a cube mid-worm.
export default function MenuFlipWave({ origins, onComplete }) {
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const elapsed = useRef(0);
  const root = useRef();
  const waves = useRef([]);
  const portals = useRef([]);
  const completed = useRef(0);
  const finished = useRef(false);
  useFrame((_state, delta) => {
    if (root.current) root.current.visible = !isCarouselActive();
    if (isCarouselActive() || document.hidden) return;
    elapsed.current += Math.min(delta, 0.05);
    const p = Math.min(1, elapsed.current / 0.8);
    const eased = 1 - (1 - p) ** 3;
    waves.current.forEach(ring => {
      if (!ring) return;
      ring.scale.setScalar(0.2 + eased * 0.65);
      ring.material.opacity = (1 - eased) * 0.6;
    });
    portals.current.forEach(ring => {
      if (!ring) return;
      ring.scale.setScalar(1 + Math.sin(elapsed.current * 3) * 0.06);
      ring.material.opacity = 0.38 + Math.sin(elapsed.current * 3) * 0.12;
    });
  });
  if (!origins || origins.length < 2) return null;
  const wormCompleted = () => {
    completed.current += 1;
    if (completed.current === 2 && !finished.current) {
      finished.current = true;
      onComplete?.();
    }
  };
  return <group ref={root}>
    {origins.map((origin, i) => <group key={i} position={origin.position} rotation={origin.rotation}>
      <mesh position={[0, 0, 0.012]} ref={el => { waves.current[i] = el; }} geometry={waveGeometry} scale={0.01}>
        <meshBasicMaterial color={origin.color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.014]} ref={el => { portals.current[i] = el; }} geometry={portalGeometry}>
        <meshBasicMaterial color={origin.color} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>)}
    {[0, 1].map(i => <MenuWormParticle key={i}
      start={origins[0].position} antipodal={i === 1}
      color1={origins[i].color} elapsed={elapsed} arcPhase={phase} onComplete={wormCompleted}
    />)}
  </group>;
}
