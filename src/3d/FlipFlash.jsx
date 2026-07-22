// src/3d/FlipFlash.jsx
// Localized "crossing" flash fired at the flip midpoint — a white-hot bloom with a
// chromatic (RGB) channel split that's hard at birth and converges as it fades, so
// the manifold crossing reads as a bright bloom + a brief "reality tears" glitch.
// Mobile-safe: it's a per-tile additive overlay, so it needs no global post-processing
// composer (the game's composer is gated off on mobile / low-FPS).
//
// Passive like FlipShockwave: no useFrame. uProgress idles at 1 (spent/transparent);
// StickerPlane.trigger()s it and advances setProgress() from its active-registry tick.
import React, { useRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

const _flashGeo = new THREE.PlaneGeometry(1.35, 1.35);

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uProgress; // 0 = birth (peak), 1 = spent (transparent)
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 1.35;
    float fade = pow(1.0 - uProgress, 1.5);

    // Chromatic split: channels separate hard at birth, converge as it dissipates.
    float split = 0.11 * (1.0 - uProgress);
    float rC = 1.0 - smoothstep(0.0, 0.58, length(p * (1.0 + split)));
    float gC = 1.0 - smoothstep(0.0, 0.58, length(p));
    float bC = 1.0 - smoothstep(0.0, 0.58, length(p * (1.0 - split)));

    vec3 col = vec3(rC, gC, bC);
    float a = fade * max(rC, max(gC, bC));
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * 1.9, clamp(a, 0.0, 1.0));
  }
`;

const FlipFlash = React.forwardRef((_props, ref) => {
  const [uniforms] = React.useState(() => ({
    uProgress: { value: 1 } // idle = spent = transparent (must NOT start at 0)
  }));
  const matRef = useRef();
  const meshRef = useRef();

  useImperativeHandle(ref, () => ({
    trigger() {
      uniforms.uProgress.value = 0;
      // Only draw while the flash is live — idle stickers skip this draw entirely.
      if (meshRef.current) meshRef.current.visible = true;
    },
    setProgress(p) {
      uniforms.uProgress.value = p;
      if (p >= 1 && meshRef.current) meshRef.current.visible = false;
    }
  }), [uniforms]);

  return (
    <mesh ref={meshRef} position={[0, 0, 0.055]} renderOrder={13} visible={false}>
      <primitive object={_flashGeo} attach="geometry" />
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

FlipFlash.displayName = 'FlipFlash';
export default FlipFlash;
