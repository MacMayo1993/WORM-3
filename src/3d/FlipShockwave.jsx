// src/3d/FlipShockwave.jsx
// A neon shockwave ring that bursts outward across the tile face at the moment of
// a flip — the "punch through the manifold" beat. Additive, expanding + fading in
// the tile's own plane. Drop-in API like FlipParticles: parent calls ref.trigger(color).
import React, { useRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Larger than the tile so the ring can travel past the edge before it fades.
const _shockGeo = new THREE.PlaneGeometry(1.5, 1.5);

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3  uColor;
  uniform float uProgress; // 0 = birth, 1 = spent
  varying vec2  vUv;

  void main() {
    // Plane is 1.5 wide → local space spans -0.75 .. 0.75.
    vec2  p    = (vUv - 0.5) * 1.5;
    float dist = length(p);

    // Expanding ring: radius grows, band thickens slightly, whole thing fades out.
    float R     = uProgress * 0.72;
    float width = 0.055 + uProgress * 0.10;
    float ring  = 1.0 - smoothstep(0.0, width, abs(dist - R));
    float fade  = pow(1.0 - uProgress, 1.6);

    // Central white-hot pop at the very start (first ~25% of the burst).
    float core  = (1.0 - smoothstep(0.0, 0.20, dist)) * pow(max(0.0, 1.0 - uProgress * 4.0), 2.0);

    float alpha = clamp(ring * fade + core * 0.8, 0.0, 1.0);
    if (alpha < 0.004) discard;

    // White-hot at the ring crest + core, colored elsewhere.
    vec3 col = mix(uColor, vec3(1.0), clamp(ring * 0.55 + core, 0.0, 1.0));
    gl_FragColor = vec4(col * 1.8, alpha);
  }
`;

const FlipShockwave = React.forwardRef((_props, ref) => {
  const progressRef = useRef(1); // ≥1 = idle
  const [uniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uProgress: { value: 0 },
  }));

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (color) uniforms.uColor.value.set(color);
      progressRef.current = 0;
      uniforms.uProgress.value = 0;
    },
  }), [uniforms]);

  useFrame((_state, delta) => {
    if (progressRef.current >= 1) return;
    // ~0.45 s burst — overlaps the flip so the ring is mid-expansion at the crossing.
    progressRef.current = Math.min(1, progressRef.current + Math.min(delta, 0.05) * 2.2);
    uniforms.uProgress.value = progressRef.current;
  });

  return (
    <mesh position={[0, 0, 0.05]} renderOrder={12}>
      <primitive object={_shockGeo} attach="geometry" />
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
});

FlipShockwave.displayName = 'FlipShockwave';
export default FlipShockwave;
