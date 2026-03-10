// src/3d/QuantumRealmBG.jsx
//
// Quantum Realm Background
//
// An ambient, fully-procedural background inspired by the sub-atomic "Quantum Realm"
// aesthetic: swirling violet/cyan particle fields, rotating orbital shells, and
// gravitational lensing bands that radiate from the cube's position.
//
// Everything is drawn with additive blending so it glows without lighting
// calculations, giving a true bioluminescent deep-space feel.
//
// Architecture:
//   1. NebulaCloud   — large random point cloud forming the deep background
//   2. OrbitalRings  — 5 concentric rings rotating at different speeds/tilts
//   3. QuantumBands  — thin radial bands that pulse in brightness
//   4. CoreGlow      — a central glow sphere at the origin

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Palette ───────────────────────────────────────────────────────────────────
const NEBULA_COLORS = [
  new THREE.Color(0x7c3aed), // deep violet
  new THREE.Color(0x4f46e5), // indigo
  new THREE.Color(0x0ea5e9), // sky blue
  new THREE.Color(0x06b6d4), // cyan
  new THREE.Color(0xa855f7), // purple
  new THREE.Color(0xe879f9), // fuchsia
  new THREE.Color(0x818cf8), // soft indigo
];

// ── Nebula Cloud ──────────────────────────────────────────────────────────────
// 8,000 randomly placed tiny points forming a diffuse background particle field.
function NebulaCloud() {
  const pointsRef = useRef(null);

  const geometry = useMemo(() => {
    const COUNT = 8000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      // Distribute on a large sphere shell (hollow interior so the cube is clear)
      const r = 35 + Math.random() * 65;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const c = NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)];
      // Vary brightness so close particles are brighter
      const bright = 0.3 + Math.random() * 0.7;
      col[i * 3]     = c.r * bright;
      col[i * 3 + 1] = c.g * bright;
      col[i * 3 + 2] = c.b * bright;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  // Slowly rotate the entire nebula
  useFrame((_s, dt) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += dt * 0.008;
      pointsRef.current.rotation.x += dt * 0.003;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ── Orbital Ring ──────────────────────────────────────────────────────────────
// A single glowing torus ring built from a dense point cloud.
function OrbitalRing({ radius, tubeRadius, rotAxis, rotSpeed, color, tilt, pointCount = 1200 }) {
  const ringRef = useRef(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(pointCount * 3);
    const col = new Float32Array(pointCount * 3);

    const c = new THREE.Color(color);
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      // Slight radial jitter to make ring look organic not mechanical
      const r = radius + (Math.random() - 0.5) * tubeRadius * 2;
      const height = (Math.random() - 0.5) * tubeRadius;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      const bright = 0.4 + Math.random() * 0.6;
      col[i * 3]     = c.r * bright;
      col[i * 3 + 1] = c.g * bright;
      col[i * 3 + 2] = c.b * bright;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [radius, tubeRadius, color, pointCount]);

  useFrame((_s, dt) => {
    if (!ringRef.current) return;
    if (rotAxis === 'x') ringRef.current.rotation.x += dt * rotSpeed;
    else if (rotAxis === 'y') ringRef.current.rotation.y += dt * rotSpeed;
    else ringRef.current.rotation.z += dt * rotSpeed;
  });

  return (
    <points
      ref={ringRef}
      geometry={geometry}
      rotation={[tilt[0], tilt[1], tilt[2]]}
    >
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ── Quantum Bands ─────────────────────────────────────────────────────────────
// Thin disc-plane of particles that pulses in brightness — like sub-atomic orbital bands.
function QuantumBand({ radius, thickness, speed, phaseOffset, color }) {
  const matRef = useRef(null);
  const groupRef = useRef(null);

  const geometry = useMemo(() => {
    const COUNT = 2400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);

    const c = new THREE.Color(color);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.92 + Math.random() * 0.16);
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * thickness;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [radius, thickness, color]);

  useFrame(({ clock }) => {
    if (!matRef.current || !groupRef.current) return;
    const t = clock.elapsedTime;
    // Opacity pulses smoothly, each band at its own phase
    matRef.current.opacity = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * speed + phaseOffset));
    // Slow rotation
    groupRef.current.rotation.y += 0.001 * speed;
  });

  return (
    <points ref={groupRef} geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={0.05}
        vertexColors
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ── Core Glow ─────────────────────────────────────────────────────────────────
// A dense inner cluster of particles at origin, giving the impression the cube
// sits inside a glowing quantum energy source.
function CoreGlow() {
  const matRef = useRef(null);
  const pointsRef = useRef(null);

  const geometry = useMemo(() => {
    const COUNT = 1500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      // Gaussian-like distribution around origin — denser in center
      const r = Math.abs(THREE.MathUtils.randFloatSpread(18));
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Closer particles are more cyan, further ones shift to violet
      const frac = r / 18;
      const c = new THREE.Color().lerpColors(
        new THREE.Color(0x22d3ee), // cyan core
        new THREE.Color(0x7c3aed), // violet edge
        frac
      );
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!matRef.current || !pointsRef.current) return;
    const t = clock.elapsedTime;
    matRef.current.opacity = 0.12 + 0.1 * Math.sin(t * 0.7);
    pointsRef.current.rotation.y += 0.002;
    pointsRef.current.rotation.x += 0.0007;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={0.06}
        vertexColors
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuantumRealmBG() {
  return (
    <group>
      {/* Deep background nebula */}
      <NebulaCloud />

      {/* 5 orbital rings at different radii, tilts, and rotation speeds */}
      <OrbitalRing radius={22} tubeRadius={0.8} rotAxis="y" rotSpeed={0.04}  color={0x7c3aed} tilt={[0.3, 0, 0.1]}         pointCount={1400} />
      <OrbitalRing radius={30} tubeRadius={1.0} rotAxis="x" rotSpeed={0.025} color={0x06b6d4} tilt={[0, 0.5, 0.2]}         pointCount={1600} />
      <OrbitalRing radius={16} tubeRadius={0.6} rotAxis="z" rotSpeed={0.06}  color={0xa855f7} tilt={[0.8, 0.3, 0]}         pointCount={1000} />
      <OrbitalRing radius={38} tubeRadius={1.4} rotAxis="y" rotSpeed={0.015} color={0x4f46e5} tilt={[0.15, 0, 0.7]}        pointCount={1800} />
      <OrbitalRing radius={12} tubeRadius={0.4} rotAxis="x" rotSpeed={0.09}  color={0xe879f9} tilt={[0.5, 0.8, 0.3]}       pointCount={800}  />

      {/* Pulsing orbital bands */}
      <QuantumBand radius={25} thickness={2} speed={0.4} phaseOffset={0}         color={0x818cf8} />
      <QuantumBand radius={34} thickness={3} speed={0.6} phaseOffset={Math.PI}   color={0x0ea5e9} />
      <QuantumBand radius={18} thickness={1.5} speed={0.9} phaseOffset={Math.PI * 0.7} color={0xc084fc} />

      {/* Central glow cloud */}
      <CoreGlow />
    </group>
  );
}
