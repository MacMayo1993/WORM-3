// src/3d/HealParticles.jsx
// Double-density golden burst fired when a wormhole tile is healed.
// API-compatible with FlipParticles: parent calls ref.trigger(color).
import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _sharedHealGeo = new THREE.PlaneGeometry(1, 1);
const _healDummy = new THREE.Object3D();
const _bloomWhite = new THREE.Color(1, 1, 1);
const _baseHealColor = new THREE.Color();

const HEAL_PARTICLE_COUNT = 40;

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2  vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;

    // Rounded-square SDF — same shape as FlipParticles chips
    float corner = 0.28;
    vec2  q = abs(p) - (1.0 - corner);
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
    float chipAlpha = 1.0 - smoothstep(-0.05, 0.12, dist);

    // Warm inner highlight — brighter than FlipParticles to emphasise the gold
    float highlight = 1.0 - smoothstep(0.0, 0.50, length(p));
    vec3 litColor = uColor + highlight * 0.70;

    // Crisp border
    float border = 1.0 - smoothstep(0.82, 0.98, max(abs(p.x), abs(p.y)));
    litColor += border * 0.35;

    gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), chipAlpha * uOpacity);
  }
`;

const HealParticles = React.forwardRef((_props, ref) => {
  const meshRef = useRef(null);
  const progressRef = useRef(0);
  const velocitiesRef = useRef([]);
  const isActiveRef = useRef(false);

  const uniformsRef = useRef({
    uColor: { value: new THREE.Color() },
    uOpacity: { value: 0.0 },
  });

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (isActiveRef.current) return;
      isActiveRef.current = true;
      progressRef.current = 0;
      if (meshRef.current) meshRef.current.visible = true; // draw only while live

      uniformsRef.current.uColor.value.set(color);
      _baseHealColor.set(color);
      uniformsRef.current.uOpacity.value = 1.0;

      velocitiesRef.current = Array.from({ length: HEAL_PARTICLE_COUNT }, (_, i) => {
        const angle = (i / HEAL_PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.35;
        // Faster launch than FlipParticles — more explosive outward feel
        const speed = 2.5 + Math.random() * 4.0;
        return {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: 0.4 + Math.random() * 1.8,
          drag: 0.82 + Math.random() * 0.12,
          rotX: (Math.random() - 0.5) * 24,
          rotY: (Math.random() - 0.5) * 20,
          rotZ: (Math.random() - 0.5) * 16,
          // More large chips for a chunky, satisfying look
          size: i < 8
            ? 0.11 + Math.random() * 0.11
            : 0.03 + Math.random() * 0.07,
          px: 0, py: 0, pz: 0,
          ax: 0, ay: 0, az: 0,
        };
      });
    },
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    _healDummy.scale.set(0, 0, 0);
    _healDummy.updateMatrix();
    for (let i = 0; i < HEAL_PARTICLE_COUNT; i++) {
      mesh.setMatrixAt(i, _healDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = false; // idle: not drawn until trigger()
  }, []);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !isActiveRef.current) return;

    const dt = Math.min(delta, 0.05);
    // Slower progress rate than FlipParticles (1.3 vs 1.65) → ~0.77s total
    progressRef.current += dt * 1.3;
    const p = progressRef.current;

    if (p >= 1) {
      isActiveRef.current = false;
      uniformsRef.current.uOpacity.value = 0.0;
      _healDummy.scale.set(0, 0, 0);
      _healDummy.updateMatrix();
      for (let i = 0; i < HEAL_PARTICLE_COUNT; i++) {
        mesh.setMatrixAt(i, _healDummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = false; // burst spent — stop drawing until next trigger
      return;
    }

    // Fade starts later than FlipParticles (0.5 vs 0.4) — chips stay bright longer
    const fadeStart = 0.50;
    const opacity = p < fadeStart
      ? 1.0
      : Math.pow(1 - (p - fadeStart) / (1 - fadeStart), 1.8);
    uniformsRef.current.uOpacity.value = opacity;

    // Golden → white bloom: mix toward gold at peak, then fade to white
    const bloomPeak = Math.sin(p * Math.PI);
    // Lean toward gold (warm) at the bloom peak
    const goldColor = new THREE.Color(1.0, 0.87, 0.2);
    _baseHealColor.lerp(goldColor, 0.4); // tint the base color golden
    uniformsRef.current.uColor.value.lerpColors(
      _baseHealColor,
      _bloomWhite,
      bloomPeak * 0.55
    );

    for (let i = 0; i < HEAL_PARTICLE_COUNT; i++) {
      const vel = velocitiesRef.current[i];
      if (!vel) continue;

      const dragFactor = Math.pow(vel.drag, dt * 60);
      vel.vx *= dragFactor;
      vel.vy *= dragFactor;
      vel.vz *= dragFactor;

      vel.px += vel.vx * dt;
      vel.py += vel.vy * dt;
      vel.pz += vel.vz * dt;

      vel.ax += vel.rotX * dt;
      vel.ay += vel.rotY * dt;
      vel.az += vel.rotZ * dt;

      _healDummy.position.set(vel.px, vel.py, vel.pz);
      _healDummy.rotation.set(vel.ax, vel.ay, vel.az);
      _healDummy.scale.set(vel.size, vel.size, vel.size);
      _healDummy.updateMatrix();
      mesh.setMatrixAt(i, _healDummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[_sharedHealGeo, null, HEAL_PARTICLE_COUNT]}
      position={[0, 0, 0.07]}
    >
      <shaderMaterial
        uniforms={uniformsRef.current}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
});

HealParticles.displayName = 'HealParticles';
export default HealParticles;
