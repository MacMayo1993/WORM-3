import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

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
 * R3F adaptation of the classic noisy point-tube wormhole effect.
 * Inspired by bobbyroe/wormhole-effect: two long, rotating point tubes that
 * scroll toward camera to fake forward travel.
 */
export default function WormholeWarpFX({
  wormPhase = 'crawling',
  enabled = true,
  radius = 2.7,
  tubeLength = 12,
}) {
  const tubeARef = useRef(null);
  const tubeBRef = useRef(null);
  const matRef = useRef(null);

  const geometry = useMemo(() => {
    const radialSegments = 96;
    const heightSegments = 640;
    const geo = new THREE.CylinderGeometry(radius, radius, tubeLength, radialSegments, heightSegments, true);
    const verts = geo.attributes.position;

    const noise = new ImprovedNoise();
    const p = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    const color = new THREE.Color();
    const arr = new Float32Array(verts.count * 3);

    const noiseFreq = 0.1;
    const noiseAmp = 0.38;
    const hueNoiseFreq = 0.005;

    for (let i = 0; i < verts.count; i++) {
      p.fromBufferAttribute(verts, i);
      v3.copy(p);

      const vertexNoise = noise.noise(v3.x * noiseFreq, v3.y * noiseFreq, v3.z * noiseFreq);
      v3.addScaledVector(p, vertexNoise * noiseAmp);

      // Keep longitudinal axis clean (Y), perturb only radial shell (X/Z).
      verts.setXYZ(i, v3.x, p.y, v3.z);

      const colorNoise = noise.noise(v3.x * hueNoiseFreq, v3.y * hueNoiseFreq, i * 0.001 * hueNoiseFreq);
      color.setHSL(0.54 - (colorNoise * 0.25), 1, 0.55);

      const i3 = i * 3;
      arr[i3] = color.r;
      arr[i3 + 1] = color.g;
      arr[i3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [radius, tubeLength]);

  useFrame((_state, delta) => {
    if (!enabled || !tubeARef.current || !tubeBRef.current || !matRef.current) return;

    const boost = PHASE_BOOST[wormPhase] ?? PHASE_BOOST.crawling;
    const speed = THREE.MathUtils.lerp(0.25, 3.6, boost);
    const rot = THREE.MathUtils.lerp(0.0015, 0.01, boost);

    for (const tube of [tubeARef.current, tubeBRef.current]) {
      tube.rotation.y += rot;
      tube.position.z += speed * delta;
      if (tube.position.z > tubeLength * 0.5) {
        tube.position.z = -tubeLength * 0.5;
      }
    }

    matRef.current.opacity = THREE.MathUtils.lerp(0.05, 0.28, boost);
    matRef.current.size = THREE.MathUtils.lerp(0.01, 0.022, boost);
  });

  if (!enabled) return null;

  return (
    <group>
      <points ref={tubeARef} geometry={geometry} rotation-x={Math.PI * 0.5} position-z={0}>
        <pointsMaterial
          ref={matRef}
          size={0.015}
          vertexColors
          transparent
          opacity={0.1}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* second copy creates seamless reset loop like original effect */}
      <points ref={tubeBRef} geometry={geometry} rotation-x={Math.PI * 0.5} position-z={-tubeLength}>
        <pointsMaterial
          size={0.015}
          vertexColors
          transparent
          opacity={0.1}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
