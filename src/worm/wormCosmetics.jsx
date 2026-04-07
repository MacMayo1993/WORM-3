// src/worm/wormCosmetics.jsx
// WormHat3D — 3D hat component for use inside a Canvas.
// Data (skins, hats, helpers) lives in wormCosmeticsData.js.

import React from 'react';

// ─── WormHat3D ────────────────────────────────────────────────────────────────
// Renders a hat in the parent's local space where +Y is the "outward" direction.
// `scale` = head sphere radius in world units.
// React.memo: type and scale rarely change, so skip re-renders when parent re-renders at 30fps.
const WormHat3D = React.memo(function WormHat3D({ type, scale = 0.28 }) {
  if (!type || type === 'none') return null;

  const s = scale;

  if (type === 'tophat') {
    return (
      <group>
        {/* Brim */}
        <mesh position={[0, s * 0.9, 0]}>
          <cylinderGeometry args={[s * 1.35, s * 1.35, s * 0.18, 16]} />
          <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.1} />
        </mesh>
        {/* Crown */}
        <mesh position={[0, s * 1.8, 0]}>
          <cylinderGeometry args={[s * 0.74, s * 0.82, s * 1.6, 16]} />
          <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.1} />
        </mesh>
        {/* Band */}
        <mesh position={[0, s * 1.08, 0]}>
          <cylinderGeometry args={[s * 0.84, s * 0.84, s * 0.22, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.3} />
        </mesh>
      </group>
    );
  }

  if (type === 'party') {
    return (
      <group>
        <mesh position={[0, s * 1.8, 0]}>
          <coneGeometry args={[s * 0.82, s * 2.4, 12]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, s * 0.85, 0]}>
          <torusGeometry args={[s * 0.72, s * 0.07, 6, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, s * 1.45, 0]}>
          <torusGeometry args={[s * 0.42, s * 0.07, 6, 16]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
        <mesh position={[0, s * 3.0, 0]}>
          <sphereGeometry args={[s * 0.2, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  if (type === 'crown') {
    const spikes = 5;
    return (
      <group position={[0, s * 0.82, 0]}>
        <mesh>
          <cylinderGeometry args={[s * 1.1, s * 1.0, s * 0.55, 20]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
        </mesh>
        {Array.from({ length: spikes }, (_, i) => {
          const angle = (i / spikes) * Math.PI * 2;
          const x = Math.cos(angle) * s * 0.95;
          const z = Math.sin(angle) * s * 0.95;
          return (
            <mesh key={i} position={[x, s * 0.65, z]}>
              <coneGeometry args={[s * 0.2, s * 0.75, 6]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} metalness={0.6} roughness={0.2} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (type === 'halo') {
    return (
      <mesh position={[0, s * 1.9, 0]}>
        <torusGeometry args={[s * 0.8, s * 0.09, 8, 32]} />
        <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={1.4} />
      </mesh>
    );
  }

  return null;
});

export default WormHat3D;
