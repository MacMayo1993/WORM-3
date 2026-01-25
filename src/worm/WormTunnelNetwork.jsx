// src/worm/WormTunnelNetwork.jsx
// Visualizes the tunnel network that the worm travels through
// Shows glowing tube paths with highlighting for target tunnels

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../game/coordinates.js';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

// Tunnel colors
const TUNNEL_COLOR = '#00ff88';
const TARGET_TUNNEL_COLOR = '#ffd700';
const TUNNEL_GLOW = '#00ffaa';

/**
 * Single tunnel tube visualization
 */
function TunnelTube({ tunnel, size, explosionFactor = 0, isTarget = false, wormInTunnel = false }) {
  const tubeRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(Math.random() * Math.PI * 2);

  // Calculate tunnel path
  const { curve, entryPos, exitPos } = useMemo(() => {
    const entry = getStickerWorldPos(
      tunnel.entry.x, tunnel.entry.y, tunnel.entry.z,
      tunnel.entry.dirKey, size, explosionFactor
    );
    const exit = getStickerWorldPos(
      tunnel.exit.x, tunnel.exit.y, tunnel.exit.z,
      tunnel.exit.dirKey, size, explosionFactor
    );

    const controlPoint = calculateSmartControlPoint(entry, exit, size, 0);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...entry),
      controlPoint,
      new THREE.Vector3(...exit)
    );

    return { curve, entryPos: entry, exitPos: exit };
  }, [tunnel, size, explosionFactor]);

  // Create tube geometry
  const tubeGeometry = useMemo(() => {
    const radius = isTarget ? 0.12 : 0.08;
    return new THREE.TubeGeometry(curve, 32, radius, 8, false);
  }, [curve, isTarget]);

  // Animate tube
  useFrame((state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (tubeRef.current) {
      // Pulse effect - stronger for target tunnels
      const pulseIntensity = isTarget ? 0.4 : 0.2;
      const pulseSpeed = isTarget ? 4 : 2;
      const scale = 1 + Math.sin(t * pulseSpeed) * pulseIntensity * 0.1;

      // Opacity pulse
      const baseOpacity = wormInTunnel ? 0.9 : (isTarget ? 0.7 : 0.4);
      tubeRef.current.material.opacity = baseOpacity + Math.sin(t * pulseSpeed) * 0.1;

      // Emissive pulse
      const baseEmissive = isTarget ? 0.8 : 0.4;
      tubeRef.current.material.emissiveIntensity = baseEmissive + Math.sin(t * pulseSpeed) * 0.2;
    }

    if (glowRef.current && isTarget) {
      // Glow ring animation
      glowRef.current.material.opacity = 0.2 + Math.sin(t * 6) * 0.1;
    }
  });

  const color = isTarget ? TARGET_TUNNEL_COLOR : TUNNEL_COLOR;

  return (
    <group>
      {/* Main tunnel tube */}
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 0.8 : 0.4}
          transparent
          opacity={isTarget ? 0.7 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow for target tunnels */}
      {isTarget && (
        <mesh ref={glowRef} geometry={new THREE.TubeGeometry(curve, 32, 0.2, 8, false)}>
          <meshBasicMaterial
            color={TARGET_TUNNEL_COLOR}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Entry portal ring */}
      <group position={entryPos}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.04, 8, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>

      {/* Exit portal ring */}
      <group position={exitPos}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.04, 8, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Complete tunnel network visualization
 * @param {Object} props
 * @param {Array} props.tunnels - Array of tunnel objects
 * @param {number} props.size - Cube size
 * @param {number} props.explosionFactor - Explosion animation factor
 * @param {string} props.targetTunnelId - ID of tunnel to highlight
 * @param {string} props.wormTunnelId - ID of tunnel the worm is currently in
 */
export default function WormTunnelNetwork({
  tunnels,
  size,
  explosionFactor = 0,
  targetTunnelId = null,
  wormTunnelId = null
}) {
  if (!tunnels || tunnels.length === 0) return null;

  return (
    <group>
      {tunnels.map(tunnel => (
        <TunnelTube
          key={tunnel.id}
          tunnel={tunnel}
          size={size}
          explosionFactor={explosionFactor}
          isTarget={tunnel.id === targetTunnelId}
          wormInTunnel={tunnel.id === wormTunnelId}
        />
      ))}
    </group>
  );
}
