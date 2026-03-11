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
    const phase = new Float32Array(verts.count);

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

      phase[i] = noise.noise(v3.x * 0.02, v3.y * 0.02, v3.z * 0.02) * 0.5 + 0.5;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    return geo;
  }, [radius, tubeLength]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uBaseSize: { value: 5.5 },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uBoost;
      uniform float uBaseSize;
      varying vec3 vColor;
      varying float vPulse;

      void main() {
        vColor = color;
        float pulse = 0.65 + 0.35 * sin(uTime * (1.5 + uBoost * 4.0) + aPhase * 10.0 + position.y * 0.8);
        vPulse = pulse;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uBaseSize * (0.7 + uBoost * 0.8) * pulse;
        gl_PointSize *= (1.0 / max(0.1, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vPulse;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d) * (0.15 + vPulse * 0.45);
        if (alpha <= 0.001) discard;
        gl_FragColor = vec4(vColor * (0.75 + vPulse * 0.7), alpha);
      }
    `,
  }), []);

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

    matRef.current.uniforms.uTime.value += delta;
    matRef.current.uniforms.uBoost.value = boost;
    matRef.current.uniforms.uBaseSize.value = THREE.MathUtils.lerp(4.2, 7.8, boost);
  });

  if (!enabled) return null;

  return (
    <group>
      <points ref={tubeARef} geometry={geometry} rotation-x={Math.PI * 0.5} position-z={0}>
        <primitive object={material} ref={matRef} attach="material" />
      </points>

      {/* second copy creates seamless reset loop like original effect */}
      <points ref={tubeBRef} geometry={geometry} rotation-x={Math.PI * 0.5} position-z={-tubeLength}>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
}
