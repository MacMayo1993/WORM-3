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
import { useShallow } from 'zustand/react/shallow';

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

// How many smoke rings billow out per pulse. More = denser, puffier smoke.
const SMOKE_RING_COUNT = 3;
// Seconds between each successive ring launch — controls how spread-out the billow is.
const SMOKE_RING_STAGGER = 0.12;
// Each ring lives this long (seconds) before fully fading.
const SMOKE_RING_DURATION = 0.55;

/**
 * PulseRing - Smoky billowing rings that expand from the antipodal rotation point.
 * Three wide, semi-transparent rings launch in quick succession with additive
 * blending so overlapping layers build up into a soft, hazy smoke puff.
 */
function PulseRing({ echo, size }) {
  const ringsRef = useRef([]);
  const matsRef = useRef([]);

  const position = useMemo(() => {
    return getFaceCenterPosition(echo.axis, echo.sliceIndex, size);
  }, [echo.axis, echo.sliceIndex, size]);

  const color = useMemo(() => {
    switch (echo.axis) {
      case 'col': return '#22c55e';
      case 'row': return '#3b82f6';
      case 'depth': return '#ef4444';
      default: return '#ffffff';
    }
  }, [echo.axis]);

  useFrame(() => {
    for (let i = 0; i < SMOKE_RING_COUNT; i++) {
      const ring = ringsRef.current[i];
      const mat = matsRef.current[i];
      if (!ring || !mat) continue;

      // Each ring starts `i * STAGGER` seconds after the echo fires.
      const elapsed = (Date.now() - echo.startTime) / 1000 - i * SMOKE_RING_STAGGER;
      if (elapsed < 0) { ring.visible = false; continue; }

      ring.visible = true;
      // Slower expansion than the original crisp ring — smoke drifts rather than snaps.
      ring.scale.setScalar(1 + elapsed * 1.3);
      // Fade out over the ring's lifetime; innermost ring slightly more opaque.
      const peakOpacity = 0.38 - i * 0.06;
      mat.opacity = Math.max(0, peakOpacity - (elapsed / SMOKE_RING_DURATION) * peakOpacity);
    }
  });

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: SMOKE_RING_COUNT }, (_, i) => (
        <mesh key={i} ref={el => { ringsRef.current[i] = el; }} visible={false}>
          {/* Wide ring (inner 0.10, outer 0.48) gives a diffuse smoke band rather than a sharp line */}
          <ringGeometry args={[0.10, 0.48, 48]} />
          <meshBasicMaterial
            ref={el => { matsRef.current[i] = el; }}
            color={color}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * AntipodalModeEffects - Main component
 * Renders all active echo effects
 */
export default function AntipodalModeEffects() {
  const { antipodalMode, pendingEchoRotations, antipodalVizIntensity, size } = useGameStore(
    useShallow((s) => ({
      antipodalMode: s.antipodalMode,
      pendingEchoRotations: s.pendingEchoRotations,
      antipodalVizIntensity: s.antipodalVizIntensity,
      size: s.size,
    }))
  );

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
