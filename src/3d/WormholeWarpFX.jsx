import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PHASE_BOOST = {
  crawling: 0.15,
  entering: 0.55,
  tunnel: 1.0,
  exiting: 0.65,
  dead: 0.0,
};

/**
 * WormholeWarpFX
 *
 * Lightweight tunnel/star-streak effect centered on the cube core.
 * - Uses additive blended points to suggest forward motion through a wormhole.
 * - Intensity boosts during worm tunnel phases for traversal feedback.
 */
export default function WormholeWarpFX({
  wormPhase = 'crawling',
  enabled = true,
  radius = 2.0,
  depth = 8.0,
  count = 850,
}) {
  const pointsRef = useRef(null);
  const materialRef = useRef(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const r = (0.2 + Math.pow(Math.random(), 0.45) * 0.8) * radius;
      arr[i3 + 0] = Math.cos(theta) * r;
      arr[i3 + 1] = Math.sin(theta) * r;
      arr[i3 + 2] = (Math.random() - 0.5) * depth;
    }
    return arr;
  }, [count, radius, depth]);

  useFrame((_state, delta) => {
    if (!pointsRef.current || !materialRef.current || !enabled) return;

    const speed = THREE.MathUtils.lerp(0.4, 6.0, PHASE_BOOST[wormPhase] ?? 0.15);
    const pos = pointsRef.current.geometry.attributes.position;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let z = pos.array[i3 + 2];
      z += delta * speed;
      if (z > depth * 0.5) z = -depth * 0.5;
      pos.array[i3 + 2] = z;
    }

    pos.needsUpdate = true;

    const intensity = enabled ? THREE.MathUtils.lerp(0.1, 0.8, PHASE_BOOST[wormPhase] ?? 0.15) : 0;
    materialRef.current.opacity = intensity;
    materialRef.current.size = THREE.MathUtils.lerp(0.03, 0.075, PHASE_BOOST[wormPhase] ?? 0.15);
  });

  if (!enabled) return null;

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color="#79b8ff"
          size={0.035}
          sizeAttenuation
          transparent
          opacity={0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
