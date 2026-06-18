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

  if (type === 'beanie') {
    return (
      <group>
        {/* Snug knit dome (top hemisphere only) */}
        <mesh position={[0, s * 0.78, 0]}>
          <sphereGeometry args={[s * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.9} metalness={0} />
        </mesh>
        {/* Folded brim */}
        <mesh position={[0, s * 0.84, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[s * 0.98, s * 0.22, 10, 24]} />
          <meshStandardMaterial color="#5b21b6" roughness={0.95} />
        </mesh>
        {/* Pom-pom */}
        <mesh position={[0, s * 1.72, 0]}>
          <sphereGeometry args={[s * 0.28, 10, 10]} />
          <meshStandardMaterial color="#ede9fe" roughness={1} />
        </mesh>
      </group>
    );
  }

  if (type === 'wizard') {
    const stars = [
      [s * 0.34, s * 1.6, s * 0.55],
      [-s * 0.42, s * 2.35, s * 0.32],
      [s * 0.12, s * 2.95, -s * 0.4]
    ];
    return (
      <group>
        {/* Wide brim */}
        <mesh position={[0, s * 0.88, 0]}>
          <cylinderGeometry args={[s * 1.55, s * 1.55, s * 0.1, 24]} />
          <meshStandardMaterial color="#3b0764" roughness={0.6} />
        </mesh>
        {/* Tall pointed cone */}
        <mesh position={[0, s * 2.15, 0]}>
          <coneGeometry args={[s * 0.95, s * 2.6, 24]} />
          <meshStandardMaterial color="#4c1d95" emissive="#1e1b4b" emissiveIntensity={0.25} roughness={0.6} />
        </mesh>
        {/* Glowing stars */}
        {stars.map((p, i) => (
          <mesh key={i} position={p}>
            <octahedronGeometry args={[s * 0.16, 0]} />
            <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === 'flower') {
    const petals = 6;
    return (
      <group position={[0, s * 1.1, 0]}>
        {/* Short green stem */}
        <mesh position={[0, -s * 0.45, 0]}>
          <cylinderGeometry args={[s * 0.06, s * 0.06, s * 0.7, 8]} />
          <meshStandardMaterial color="#16a34a" roughness={0.7} />
        </mesh>
        {/* Petals */}
        {Array.from({ length: petals }, (_, i) => {
          const a = (i / petals) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * s * 0.5, 0, Math.sin(a) * s * 0.5]} scale={[s * 0.42, s * 0.16, s * 0.26]}>
              <sphereGeometry args={[1, 10, 10]} />
              <meshStandardMaterial color="#f472b6" roughness={0.55} />
            </mesh>
          );
        })}
        {/* Center pollen */}
        <mesh>
          <sphereGeometry args={[s * 0.3, 12, 12]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.45} />
        </mesh>
      </group>
    );
  }

  if (type === 'grad') {
    return (
      <group position={[0, s * 0.95, 0]}>
        {/* Cap base */}
        <mesh>
          <cylinderGeometry args={[s * 0.78, s * 0.86, s * 0.5, 16]} />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
        {/* Mortarboard */}
        <mesh position={[0, s * 0.3, 0]}>
          <boxGeometry args={[s * 2.0, s * 0.12, s * 2.0]} />
          <meshStandardMaterial color="#111827" roughness={0.55} />
        </mesh>
        {/* Center button */}
        <mesh position={[0, s * 0.4, 0]}>
          <sphereGeometry args={[s * 0.12, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Tassel cord + knob hanging off one corner */}
        <mesh position={[s * 0.9, s * 0.16, s * 0.9]}>
          <cylinderGeometry args={[s * 0.03, s * 0.03, s * 0.7, 6]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[s * 0.9, -s * 0.18, s * 0.9]}>
          <sphereGeometry args={[s * 0.14, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
        </mesh>
      </group>
    );
  }

  return null;
});

export default WormHat3D;
