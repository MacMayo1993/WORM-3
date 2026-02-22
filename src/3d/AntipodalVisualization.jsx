// src/3d/AntipodalVisualization.jsx
// 3D visualization of antipodal integrity:
// - Inner sphere whose opacity = I(T)²
// - Semi-transparent curves connecting preserved antipodal pairs
//   colored by axis: blue (U-D/Y), red (F-B/Z), green (L-R/X)

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../game/coordinates.js';

// Axis-based colors for connection curves (from the paper §7.2)
const AXIS_COLORS = {
  X: new THREE.Color('#22c55e'), // green for L-R
  Y: new THREE.Color('#3b82f6'), // blue for U-D
  Z: new THREE.Color('#ef4444')  // red for F-B
};

/**
 * Determine which axis a pair spans based on their face directions.
 */
const getPairAxis = (dirA, dirB) => {
  if (dirA === 'PX' || dirA === 'NX' || dirB === 'PX' || dirB === 'NX') return 'X';
  if (dirA === 'PY' || dirA === 'NY' || dirB === 'PY' || dirB === 'NY') return 'Y';
  return 'Z';
};

/**
 * AntipodalSphere - inner sphere with opacity proportional to I(T)².
 * Represents the inscribed sphere tangent to the six face centers.
 */
function AntipodalSphere({ integrity, size }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const targetOpacity = useRef(integrity * integrity);

  useFrame((_state, delta) => {
    if (!materialRef.current) return;
    targetOpacity.current = integrity * integrity;
    const current = materialRef.current.opacity;
    materialRef.current.opacity += (targetOpacity.current - current) * Math.min(1, delta * 4);
  });

  // Sphere radius: inscribed sphere of the cube = half the face size
  const radius = (size - 1) / 2 * 0.45;

  // Color shifts from cool (low integrity) to warm (high integrity)
  const color = useMemo(() => {
    if (integrity > 0.8) return '#fbbf24'; // gold
    if (integrity > 0.5) return '#60a5fa'; // blue
    return '#f87171'; // red
  }, [integrity]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={integrity * integrity}
        emissive={color}
        emissiveIntensity={0.3 * integrity}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * AntipodalCurve - a single semi-transparent curve connecting two antipodal stickers.
 * Uses a quadratic Bezier curve passing through the cube center.
 */
function AntipodalCurve({ posA, posB, axis }) {
  const lineRef = useRef();
  const color = AXIS_COLORS[axis] || AXIS_COLORS.Z;

  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...posA);
    const b = new THREE.Vector3(...posB);
    // Midpoint pulled toward center for a nice arc
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.5).multiplyScalar(0.3);

    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const points = curve.getPoints(20);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [posA, posB]);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.45}
        linewidth={1}
        depthWrite={false}
      />
    </line>
  );
}

/**
 * AntipodalVisualization - main component rendered inside Canvas.
 * Shows the inner sphere and connection curves for preserved pairs.
 */
export default function AntipodalVisualization({ antipodalData, size, explosionFactor = 0 }) {
  if (!antipodalData) return null;

  const { integrity, pairs } = antipodalData;
  const preservedPairs = pairs.filter((p) => p.preserved);

  return (
    <group>
      <AntipodalSphere integrity={integrity} size={size} />
      {preservedPairs.map((pair, i) => {
        const posA = getStickerWorldPos(pair.a.x, pair.a.y, pair.a.z, pair.a.dirKey, size, explosionFactor);
        const posB = getStickerWorldPos(pair.b.x, pair.b.y, pair.b.z, pair.b.dirKey, size, explosionFactor);
        const axis = getPairAxis(pair.a.dirKey, pair.b.dirKey);
        return <AntipodalCurve key={i} posA={posA} posB={posB} axis={axis} />;
      })}
    </group>
  );
}
