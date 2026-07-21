// src/teach/LayerHighlight.jsx
// 3D layer highlight that shows which slice will be rotated next.
// A dim translucent plane marks the slice body; a neon "worm-frame" lights up
// all four edges of the layer with bright light-worms chasing around the
// perimeter. The worms travel in the DIRECTION OF THE TURN, so the preview
// reads the upcoming rotation at a glance (same wiggle language as the flipped-
// tile neon border).

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Worm-frame shader ────────────────────────────────────────────────────────
// Lights the outer edge of the slice cross-section (a square hugging the cube in
// the slice plane) and sends light-worms racing around it. uDir flips the travel
// direction so it matches the physical turn (CW vs CCW around the rotation axis).
const layerWormVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const layerWormFragmentShader = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uDir;   // +1 / -1 → worms travel with the turn direction
  varying vec2  vUv;
  #define TAU 6.28318530718

  void main() {
    vec2 p = vUv - 0.5;
    vec2 a = abs(p);
    float m = max(a.x, a.y);
    float edgeDist = 0.5 - m;        // 0 at the square edge, grows inward
    if (edgeDist > 0.14) discard;    // only the border band lights up

    // Perimeter coordinate s ∈ [0,1) running around the square.
    float s;
    if (p.y >= a.x)       s = (p.x + 0.5) * 0.25;
    else if (p.x >= a.y)  s = 0.25 + (0.5 - p.y) * 0.25;
    else if (-p.y >= a.x) s = 0.50 + (0.5 - p.x) * 0.25;
    else                  s = 0.75 + (p.y + 0.5) * 0.25;

    // Wiggling band thickness so the frame looks alive, not a static rectangle.
    float wig = 1.0 + 0.30 * sin(s * TAU * 10.0 - uTime * 5.0);
    float bw  = 0.040 * wig;
    float band = 1.0 - smoothstep(0.0, bw, edgeDist);

    float baseGlow = band * 0.30;

    // Chasing light-worms. Travel sign = uDir so the motion matches the turn.
    const int N = 5;
    float speed   = 0.16;
    float headLen = 0.032;
    float tailLen = 0.075;
    float worms = 0.0;
    for (int i = 0; i < N; i++) {
      float fi = float(i);
      float sp = speed * (1.0 + fi * 0.06);
      float head = fract(fi / float(N) + uDir * uTime * sp);
      head = fract(head + 0.005 * sin(uTime * 9.0 + fi * 2.0)); // slither
      float sd = fract(s - head + 0.5) - 0.5;
      // Comet tail trails BEHIND the head relative to travel direction (uDir).
      float behind = sd * uDir;
      float h = exp(-(sd * sd) / (headLen * headLen));
      float tail = behind < 0.0 ? exp(behind / tailLen) * 0.55 : 0.0;
      worms += max(h, tail);
    }
    worms = clamp(worms, 0.0, 1.5) * band;

    float glow = baseGlow + worms;
    vec3 col = mix(uColor, vec3(1.0), clamp(worms - 0.4, 0.0, 1.0) * 0.75);
    float alpha = clamp(glow, 0.0, 1.0);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col * 1.7, alpha);
  }
`;

const LayerHighlight = ({ axis, sliceIndex, dir, size }) => {
  const planeRef = useRef();
  const wormMatRef = useRef();

  const k = (size - 1) / 2;
  const offset = sliceIndex - k;

  // Position and rotation based on axis
  let position, rotation;
  if (axis === 'col') {
    position = [offset, 0, 0];
    rotation = [0, 0, Math.PI / 2];
  } else if (axis === 'row') {
    position = [0, offset, 0];
    rotation = [0, 0, 0];
  } else {
    position = [0, 0, offset];
    rotation = [Math.PI / 2, 0, 0];
  }

  // Frame sits right at the cube's outer edge in the slice plane (half = size/2 = surface).
  const framePlane = size + 0.06;
  const bodyPlane = size * 0.95;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (planeRef.current) {
      planeRef.current.material.opacity = 0.06 + Math.sin(t * 3) * 0.03;
    }
    if (wormMatRef.current) {
      wormMatRef.current.uniforms.uTime.value = t;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Dim slice body — shows WHICH layer will turn */}
      <mesh ref={planeRef}>
        <planeGeometry args={[bodyPlane, bodyPlane]} />
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Neon worm-frame — lights all four edges; worms chase in the turn direction */}
      <mesh>
        <planeGeometry args={[framePlane, framePlane]} />
        <shaderMaterial
          ref={wormMatRef}
          vertexShader={layerWormVertexShader}
          fragmentShader={layerWormFragmentShader}
          uniforms={{
            uColor: { value: new THREE.Color('#00e5ff') },
            uTime: { value: 0 },
            uDir: { value: dir === 1 ? 1 : -1 }
          }}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export default LayerHighlight;
