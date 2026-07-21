// src/3d/FlipShockwave.jsx
// A neon shockwave ring that bursts outward across the tile face at the moment of
// a flip — the "punch through the manifold" beat. Additive, expanding + fading in
// the tile's own plane.
//
// This component is intentionally PASSIVE: it owns no useFrame. Its progress is
// driven by the parent StickerPlane's tick, which only runs while the sticker is
// in the active-sticker registry (StickerAnimationManager) — so idle tiles cost
// nothing. uProgress idles at 1 (spent → fully transparent); trigger() resets it
// to 0 and setProgress() advances it 0→1.
import React, { useRef, useImperativeHandle } from 'react';
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
  uniform float uProgress; // 0 = birth, 1 = spent (transparent)
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
  const [uniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uProgress: { value: 1 }, // idle = spent = transparent (must NOT start at 0)
  }));
  const matRef = useRef();

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (color) uniforms.uColor.value.set(color);
      uniforms.uProgress.value = 0;
    },
    // Advanced 0→1 by the parent tick (active-registry driven); ≥1 = transparent.
    setProgress(p) {
      uniforms.uProgress.value = p;
    },
  }), [uniforms]);

  return (
    <mesh position={[0, 0, 0.05]} renderOrder={12}>
      <primitive object={_shockGeo} attach="geometry" />
      <shaderMaterial
        ref={matRef}
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
