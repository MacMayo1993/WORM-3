import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const PHASE_BOOST = {
  crawling: 0.0,
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
export default function WormholeWarpFX({ wormPhase = 'crawling', enabled = true }) {
  const meshRef = useRef(null);
  const prevEnabledRef = useRef(false);
  const { size } = useThree();

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBoost: { value: 0 },
          uAspect: { value: 1 },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
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
          uniform float uBoost;
          uniform float uAspect;
          uniform float uOpacity;

          void main() {
            // Centre at (0,0), correct for aspect ratio so rings are circular.
            vec2 p = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
            float r = length(p);
            float angle = atan(p.y, p.x);

            // Rings scrolling inward (= forward tunnel motion).
            float speed = mix(0.5, 3.2, uBoost);
            float rings = sin(r * 10.0 - uTime * speed) * 0.5 + 0.5;

            // Gentle spiral twist.
            float twist = angle + uTime * mix(0.1, 0.7, uBoost) + r * 3.0;
            float spiral = sin(twist * 6.0) * 0.5 + 0.5;

            // Cyan ↔ purple colour blend.
            vec3 colA = vec3(0.0, 0.75, 1.0);
            vec3 colB = vec3(0.55, 0.05, 1.0);
            vec3 col = mix(colA, colB, spiral) * (rings * 0.75 + 0.35);

            // EDGE-ONLY vignette — transparent in the centre so the camera
            // animation is always visible, glowing only at the screen perimeter.
            float edgeMask = smoothstep(0.55, 1.3, r);  // 0 at centre, 1 near edges
            float alpha = edgeMask * (rings * 0.6 + 0.25) * uOpacity;
            alpha = clamp(alpha, 0.0, 0.9);

            if (alpha < 0.001) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    []
  );

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    const boost = enabled ? (PHASE_BOOST[wormPhase] ?? 0) : 0;

    if (enabled && !prevEnabledRef.current) {
      // Snap to full opacity the instant the wormhole activates — no fade-in delay.
      material.uniforms.uOpacity.value = 1.0;
    } else if (!enabled) {
      // Slow fade-out so the exit feels natural.
      material.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        material.uniforms.uOpacity.value,
        0.0,
        delta * 4.0
      );
    }
    prevEnabledRef.current = enabled;

    material.uniforms.uTime.value += delta;
    material.uniforms.uBoost.value = boost;
    material.uniforms.uAspect.value = size.width / size.height;
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
