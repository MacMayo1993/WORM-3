/**
 * AntipodalModeEffects.jsx
 *
 * Visual effects for Antipodal Mode (Mirror Quotient):
 * - Echo Tethers: Glowing plasma tubes connecting rotating face to antipodal
 * - Flow particles showing reverse direction
 * - Pulse effects during echo delay
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';

/**
 * Get face center position for a given axis and slice
 */
function getFaceCenterPosition(axis, sliceIndex, size) {
  const offset = sliceIndex - (size - 1) / 2;
  const scale = 1.05; // Slightly outside the cube

  switch (axis) {
    case 'row': // Y-axis
      return [0, offset * scale, 0];
    case 'col': // X-axis
      return [offset * scale, 0, 0];
    case 'depth': // Z-axis
      return [0, 0, offset * scale];
    default:
      return [0, 0, 0];
  }
}

/**
 * EchoTether - A glowing tube connecting original and antipodal rotation points
 */
function EchoTether({ echo, size }) {
  const lineRef = useRef();
  const materialRef = useRef();
  const particlesRef = useRef();

  const { curve, particlePositions } = useMemo(() => {
    const posA = new THREE.Vector3(...getFaceCenterPosition(echo.axis, echo.originalSlice, size));
    const posB = new THREE.Vector3(...getFaceCenterPosition(echo.axis, echo.sliceIndex, size));

    // Create a curved path (quadratic bezier through center)
    const mid = new THREE.Vector3().lerpVectors(posA, posB, 0.5).multiplyScalar(0.3);
    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);

    // Particle positions along the curve
    const particleCount = 20;
    const particlePositions = [];
    for (let i = 0; i < particleCount; i++) {
      particlePositions.push(curve.getPoint(i / particleCount));
    }

    return { curve, particlePositions };
  }, [echo.axis, echo.originalSlice, echo.sliceIndex, size]);

  // Animate tether appearance and particles
  useFrame(() => {
    if (!materialRef.current) return;

    const elapsed = (Date.now() - echo.startTime) / 1000;
    const progress = Math.min(1, elapsed / 0.5); // Fade in over 0.5s

    // Pulsing glow
    const pulse = Math.sin(elapsed * 8) * 0.3 + 0.7;
    materialRef.current.opacity = progress * pulse * 0.6;
    materialRef.current.emissiveIntensity = pulse * 2;

    // Animate particles flowing in reverse direction (from antipodal to original)
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position;
      for (let i = 0; i < particlePositions.length; i++) {
        const t = ((elapsed * 2 + i / particlePositions.length) % 1);
        const point = curve.getPoint(1 - t); // Reverse direction
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
    }
  });

  const geometry = useMemo(() => {
    const points = curve.getPoints(50);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve]);

  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particlePositions.length * 3);
    particlePositions.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [particlePositions]);

  // Color based on axis (matching AntipodalVisualization)
  const color = useMemo(() => {
    switch (echo.axis) {
      case 'col': return '#22c55e'; // green for X
      case 'row': return '#3b82f6'; // blue for Y
      case 'depth': return '#ef4444'; // red for Z
      default: return '#ffffff';
    }
  }, [echo.axis]);

  return (
    <group>
      {/* Tether line */}
      <line ref={lineRef} geometry={geometry}>
        <lineBasicMaterial
          ref={materialRef}
          color={color}
          transparent
          opacity={0.6}
          linewidth={3}
          depthWrite={false}
        />
      </line>

      {/* Flow particles */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color={color}
          size={0.1}
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Emissive tube for glow effect */}
      <mesh>
        <tubeGeometry args={[curve, 50, 0.02, 8, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          emissive={color}
          emissiveIntensity={1.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * PulseRing - A pulsing ring that appears at the antipodal rotation point
 */
function PulseRing({ echo, size }) {
  const ringRef = useRef();
  const materialRef = useRef();

  const position = useMemo(() => {
    return getFaceCenterPosition(echo.axis, echo.sliceIndex, size);
  }, [echo.axis, echo.sliceIndex, size]);

  useFrame(() => {
    if (!ringRef.current || !materialRef.current) return;

    const elapsed = (Date.now() - echo.startTime) / 1000;
    const scale = 1 + elapsed * 2;
    ringRef.current.scale.setScalar(scale);
    materialRef.current.opacity = Math.max(0, 0.8 - elapsed * 2);
  });

  const color = useMemo(() => {
    switch (echo.axis) {
      case 'col': return '#22c55e';
      case 'row': return '#3b82f6';
      case 'depth': return '#ef4444';
      default: return '#ffffff';
    }
  }, [echo.axis]);

  return (
    <mesh ref={ringRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.35, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * AntipodalModeEffects - Main component
 * Renders all active echo effects
 */
export default function AntipodalModeEffects() {
  const antipodalMode = useGameStore((state) => state.antipodalMode);
  const pendingEchoRotations = useGameStore((state) => state.pendingEchoRotations);
  const antipodalVizIntensity = useGameStore((state) => state.antipodalVizIntensity);
  const size = useGameStore((state) => state.size);

  if (!antipodalMode || antipodalVizIntensity === 'low') {
    return null;
  }

  return (
    <group>
      {pendingEchoRotations.map((echo) => (
        <React.Fragment key={echo.id}>
          <EchoTether echo={echo} size={size} />
          {antipodalVizIntensity === 'high' && <PulseRing echo={echo} size={size} />}
        </React.Fragment>
      ))}
    </group>
  );
}
