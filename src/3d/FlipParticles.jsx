// src/3d/FlipParticles.jsx
// Tile-shard burst effect during flip animation.
// Drop-in API compatibility: parent calls ref.trigger(color).
import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _sharedParticleGeometry = new THREE.PlaneGeometry(1, 1);
const _particleDummy = new THREE.Object3D();
const _bloomWhite = new THREE.Color(1, 1, 1);
const _baseBurstColor = new THREE.Color();

const PARTICLE_COUNT = 20;

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

    // Rounded-square signed-distance
    float corner = 0.28;
    vec2  q = abs(p) - (1.0 - corner);
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
    float chipAlpha = 1.0 - smoothstep(-0.05, 0.12, dist);

    // Inner highlight radiates from center
    float highlight = 1.0 - smoothstep(0.0, 0.55, length(p));
    vec3 litColor = uColor + highlight * 0.55;

    // Crisp sticker-edge border
    float border = 1.0 - smoothstep(0.82, 0.98, max(abs(p.x), abs(p.y)));
    litColor += border * 0.3;

    gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), chipAlpha * uOpacity);
  }
`;

const FlipParticles = React.forwardRef((_props, ref) => {
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

      uniformsRef.current.uColor.value.set(color);
      _baseBurstColor.set(color);
      uniformsRef.current.uOpacity.value = 1.0;

      velocitiesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 1.8 + Math.random() * 3.2;
        return {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: 0.3 + Math.random() * 1.4,
          drag: 0.80 + Math.random() * 0.14,
          rotX: (Math.random() - 0.5) * 22,
          rotY: (Math.random() - 0.5) * 18,
          rotZ: (Math.random() - 0.5) * 14,
          size: i < 3
            ? 0.10 + Math.random() * 0.10
            : 0.03 + Math.random() * 0.07,
          px: 0,
          py: 0,
          pz: 0,
          ax: 0,
          ay: 0,
          az: 0,
        };
      });
    },
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    _particleDummy.scale.set(0, 0, 0);
    _particleDummy.updateMatrix();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      mesh.setMatrixAt(i, _particleDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !isActiveRef.current) return;

    const dt = Math.min(delta, 0.05);
    progressRef.current += dt * 1.65;
    const p = progressRef.current;

    if (p >= 1) {
      isActiveRef.current = false;
      uniformsRef.current.uOpacity.value = 0.0;
      _particleDummy.scale.set(0, 0, 0);
      _particleDummy.updateMatrix();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        mesh.setMatrixAt(i, _particleDummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    const fadeStart = 0.40;
    const opacity = p < fadeStart
      ? 1.0
      : Math.pow(1 - (p - fadeStart) / (1 - fadeStart), 1.8);
    uniformsRef.current.uOpacity.value = opacity;

    const bloomPeak = Math.sin(p * Math.PI);
    uniformsRef.current.uColor.value.lerpColors(
      _baseBurstColor,
      _bloomWhite,
      bloomPeak * 0.45
    );

    for (let i = 0; i < PARTICLE_COUNT; i++) {
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

      _particleDummy.position.set(vel.px, vel.py, vel.pz);
      _particleDummy.rotation.set(vel.ax, vel.ay, vel.az);
      _particleDummy.scale.set(vel.size, vel.size, vel.size);
      _particleDummy.updateMatrix();
      mesh.setMatrixAt(i, _particleDummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[_sharedParticleGeometry, null, PARTICLE_COUNT]}
      position={[0, 0, 0.06]}
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

FlipParticles.displayName = 'FlipParticles';
export default FlipParticles;
