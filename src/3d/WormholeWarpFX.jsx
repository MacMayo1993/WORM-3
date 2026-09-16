import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { prefersReducedMotion } from '../utils/device.js';

const PHASE_BOOST = {
  crawling: 0.0,
  windup: 0.45,
  windout: 0.35,
  entering: 1.0,
  tunnel: 1.0,
  exiting: 0.8,
  dead: 0.0,
};

/**
 * WormholeWarpFX
 *
 * Full-screen NDC quad with a tunnel shader.
 * The vertex shader writes directly to clip space — no camera alignment needed,
 * always fills the screen, zero depth-test / frustum-cull issues.
 */
export default function WormholeWarpFX({ wormPhase = 'crawling', enabled = true, healMoment = 0 }) {
  const meshRef = useRef(null);
  const prevEnabledRef = useRef(false);
  const prevHealMomentRef = useRef(healMoment);
  const healFlashRef = useRef(0); // 1→0, drives reverse pressure flash
  const { size } = useThree();

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color('#00bbff') },
          uColorB: { value: new THREE.Color('#ff7700') },
          uBoost: { value: 0 },
          uAspect: { value: 1 },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            // Bypass all camera transforms — position is already in NDC clip space.
            gl_Position = vec4(position.xy, 0.999, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uBoost;
          uniform float uAspect;
          uniform float uOpacity;

          void main() {
            // Centre at (0,0), correct for aspect ratio so rings are circular.
            vec2 p = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
            float r = length(p);
            float angle = atan(p.y, p.x);

            // Long, sparse edge streaks suggest forward travel without painting
            // over the worm. Their color is the actual entry/exit palette pair.
            float lane = pow(0.5 + 0.5 * sin(angle * 28.0 + sin(angle * 7.0)), 24.0);
            float run = pow(0.5 + 0.5 * sin(r * 18.0 - uTime * (2.0 + uBoost * 3.0)), 5.0);
            float sweep = 0.5 + 0.5 * sin(angle - 0.35);
            vec3 col = mix(uColorA, uColorB, sweep);
            col = mix(col, vec3(1.0), lane * run * 0.28);
            float edgeMask = smoothstep(0.72, 1.35, r);
            float alpha = min(0.12, edgeMask * (0.045 + lane * run * 0.28) * uOpacity);

            if (alpha < 0.001) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    []
  );

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const state = useGameStore.getState();
    const active = enabled && state.wormAlive;
    const reduced = prefersReducedMotion();
    const dt = Math.min(delta, 0.05);
    const uniforms = material.uniforms;
    if (active && state.wormPaused) return;

    if (healMoment !== prevHealMomentRef.current) {
      prevHealMomentRef.current = healMoment;
      if ((active || prevEnabledRef.current) && !reduced) healFlashRef.current = 0.45;
    }
    healFlashRef.current = Math.max(0, healFlashRef.current - dt * 2.5);
    const target = Math.max(active ? (reduced ? 0.18 : 0.65) : 0, healFlashRef.current);
    uniforms.uOpacity.value += (target - uniforms.uOpacity.value) * (1 - Math.exp(-dt * (active ? 8 : 6)));
    uniforms.uBoost.value = active ? (PHASE_BOOST[wormPhase] ?? 0) : 0;
    uniforms.uAspect.value = size.width / Math.max(1, size.height);
    if (state.wormActiveTunnelColors) {
      uniforms.uColorA.value.set(state.wormActiveTunnelColors.entryColor);
      uniforms.uColorB.value.set(state.wormActiveTunnelColors.exitColor);
    }
    if (active && !reduced) uniforms.uTime.value += dt;
    mesh.visible = uniforms.uOpacity.value > 0.004;
    prevEnabledRef.current = active;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={999}
    />
  );
}
