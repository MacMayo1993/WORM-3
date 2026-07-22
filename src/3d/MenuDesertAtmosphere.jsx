// A very light dust layer for the desert menu. It is deliberately separate from
// the HDRI: the panorama supplies the world, while these nearby motes give the
// otherwise static menu cube a small amount of warm, tactile depth.
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function MenuDesertAtmosphere({ reduced = false, pulseTrigger = 0 }) {
  const points = useRef();
  const pulse = useRef(0);
  const positions = useMemo(() => {
    const count = reduced ? 28 : 72;
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      values[index * 3] = (Math.random() - 0.5) * 18;
      values[index * 3 + 1] = -2.6 + Math.random() * 8;
      values[index * 3 + 2] = -6 + Math.random() * 14;
    }
    return values;
  }, [reduced]);

  useEffect(() => { if (pulseTrigger > 0) pulse.current = 1; }, [pulseTrigger]);

  useFrame((state, delta) => {
    if (!points.current) return;
    const position = points.current.geometry.attributes.position;
    const drift = reduced ? 0.035 : 0.075;
    for (let index = 0; index < position.count; index += 1) {
      const x = index * 3;
      position.array[x] += delta * drift;
      position.array[x + 1] += Math.sin(index * 3.7 + state.clock.elapsedTime * 0.45) * delta * 0.008;
      if (position.array[x] > 9) position.array[x] = -9;
    }
    position.needsUpdate = true;
    pulse.current = Math.max(0, pulse.current - delta * 1.7);
    points.current.material.opacity = 0.16 + pulse.current * 0.05;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#e9c982"
        size={reduced ? 0.035 : 0.05}
        sizeAttenuation
        transparent
        opacity={0.16}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
