// src/worm/WormTunnelNetwork.jsx
// Visualizes the tunnel network that the worm travels through
// Shows glowing tube paths with highlighting for target tunnels

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTunnelSideKey } from './wormLogic.js';

// Tunnel colors
const TUNNEL_COLOR = '#00ff88';
const TARGET_TUNNEL_COLOR = '#ffd700';
const TUNNEL_GLOW = '#00ffaa';

/**
 * Single tunnel tube visualization
 */
// Generate stable random offset based on tunnel id
function getStableOffset(tunnelId) {
  let hash = 0;
  for (let i = 0; i < tunnelId.length; i++) {
    hash = ((hash << 5) - hash) + tunnelId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;
}

function TunnelTube({ tunnel, size, explosionFactor = 0, isTarget = false, wormInTunnel = false, inactiveSideKeys = new Set() }) {
  const tubeRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(getStableOffset(tunnel.id));

  // Calculate tunnel path
  const { curve, entryPos, exitPos } = useMemo(() => {
    const k = (size - 1) / 2;
    const scale = 1 + explosionFactor * 1.8;
    const entryCenter = new THREE.Vector3(
      (tunnel.entry.x - k) * scale,
      (tunnel.entry.y - k) * scale,
      (tunnel.entry.z - k) * scale
    );
    const exitCenter = new THREE.Vector3(
      (tunnel.exit.x - k) * scale,
      (tunnel.exit.y - k) * scale,
      (tunnel.exit.z - k) * scale
    );

    // Match gameplay path exactly: tile center -> void core center -> tile center.
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(entryCenter, new THREE.Vector3(0, 0, 0)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), exitCenter));

    return { curve: path, entryPos: [entryCenter.x, entryCenter.y, entryCenter.z], exitPos: [exitCenter.x, exitCenter.y, exitCenter.z] };
  }, [tunnel, size, explosionFactor]);

  // Pre-compute all three geometries based only on curve path (not isTarget).
  // This avoids reallocating GPU geometry just because the target tunnel changes.
  const geometries = useMemo(() => ({
    normal: new THREE.TubeGeometry(curve, 32, 0.08, 8, false),
    target: new THREE.TubeGeometry(curve, 32, 0.12, 8, false),
    glow: new THREE.TubeGeometry(curve, 32, 0.2, 8, false)
  }), [curve]);

  // Dispose geometries when the curve changes (prevents GPU memory leaks)
  useEffect(() => () => {
    geometries.normal.dispose();
    geometries.target.dispose();
    geometries.glow.dispose();
  }, [geometries]);

  const color = isTarget ? TARGET_TUNNEL_COLOR : TUNNEL_COLOR;
  const entryActive = !inactiveSideKeys.has(getTunnelSideKey(tunnel.entry));
  const exitActive = !inactiveSideKeys.has(getTunnelSideKey(tunnel.exit));
  const tunnelOpacityScale = entryActive || exitActive ? 1 : 0.25;

  // Animate tube
  useFrame((state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (tubeRef.current) {
      // Pulse effect - stronger for target tunnels
      const pulseSpeed = isTarget ? 4 : 2;

      // Opacity pulse
      const baseOpacity = (wormInTunnel ? 0.9 : (isTarget ? 0.7 : 0.4)) * tunnelOpacityScale;
      tubeRef.current.material.opacity = baseOpacity + Math.sin(t * pulseSpeed) * 0.1 * tunnelOpacityScale;

      // Emissive pulse
      const baseEmissive = isTarget ? 0.8 : 0.4;
      tubeRef.current.material.emissiveIntensity = baseEmissive + Math.sin(t * pulseSpeed) * 0.2;
    }

    if (glowRef.current && isTarget) {
      // Glow ring animation
      glowRef.current.material.opacity = 0.2 + Math.sin(t * 6) * 0.1;
    }
  });

  return (
    <group>
      {/* Main tunnel tube — swap between pre-computed geometries; no reallocation */}
      <mesh ref={tubeRef} geometry={isTarget ? geometries.target : geometries.normal}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 0.8 : 0.4}
          transparent
          opacity={(isTarget ? 0.7 : 0.4) * tunnelOpacityScale}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow for target tunnels — use pre-computed glow geometry */}
      {isTarget && (
        <mesh ref={glowRef} geometry={geometries.glow}>
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
            opacity={entryActive ? 0.8 : 0.18}
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
            opacity={exitActive ? 0.8 : 0.18}
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
 * @param {Set<string>} props.inactiveSideKeys - side keys already consumed by tunnel entry
 */
export default function WormTunnelNetwork({
  tunnels,
  size,
  explosionFactor = 0,
  targetTunnelId = null,
  wormTunnelId = null,
  inactiveSideKeys = new Set()
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
          inactiveSideKeys={inactiveSideKeys}
        />
      ))}
    </group>
  );
}
