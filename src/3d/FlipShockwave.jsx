import { shockVertex as VERTEX_SHADER, shockFragment as FRAGMENT_SHADER } from './flipBurstShaders.js';
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

const FlipShockwave = React.forwardRef((_props, ref) => {
  const [uniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uProgress: { value: 1 }, // idle = spent = transparent (must NOT start at 0)
  }));
  const matRef = useRef();
  const meshRef = useRef();

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (color) uniforms.uColor.value.set(color);
      uniforms.uProgress.value = 0;
      // Only draw while the burst is live — idle stickers skip this draw entirely.
      if (meshRef.current) meshRef.current.visible = true;
    },
    // Advanced 0→1 by the parent tick (active-registry driven); ≥1 = transparent.
    setProgress(p) {
      uniforms.uProgress.value = p;
      if (p >= 1 && meshRef.current) meshRef.current.visible = false;
    },
  }), [uniforms]);

  return (
    <mesh ref={meshRef} position={[0, 0, 0.05]} renderOrder={12} visible={false}>
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
