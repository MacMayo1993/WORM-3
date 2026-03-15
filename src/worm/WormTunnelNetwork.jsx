// src/worm/WormTunnelNetwork.jsx
// Visualizes the tunnel network that the worm travels through
// Shows glowing tube paths with highlighting for target tunnels

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTunnelSideKey } from './wormLogic.js';

// Tunnel colors
const TUNNEL_COLOR = '#00ff88';
const TARGET_TUNNEL_COLOR = '#ffd700';

/**
 * Single tunnel tube visualization.
 * Has NO useFrame — all animation is driven by the single TunnelAnimator in WormTunnelNetwork.
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

function TunnelTube({ tunnel, size, explosionFactor = 0, isTarget = false, wormInTunnel = false, inactiveSideKeys = new Set(), tunnelKey, registerAnim, unregisterAnim }) {
  const tubeRef = useRef();
  const glowRef = useRef();

  // Keep mutable refs so the animator always reads current values without causing re-renders
  const isTargetRef = useRef(isTarget);
  isTargetRef.current = isTarget;
  const wormInTunnelRef = useRef(wormInTunnel);
  wormInTunnelRef.current = wormInTunnel;
  const inactiveSideKeysRef = useRef(inactiveSideKeys);
  inactiveSideKeysRef.current = inactiveSideKeys;

  const { entryKey, exitKey } = useMemo(() => ({
    entryKey: getTunnelSideKey(tunnel.entry),
    exitKey: getTunnelSideKey(tunnel.exit),
  }), [tunnel]);

  // Register refs with parent animator on mount, unregister on unmount
  useEffect(() => {
    registerAnim(tunnelKey, {
      get tube() { return tubeRef.current; },
      get glow() { return glowRef.current; },
      get isTarget() { return isTargetRef.current; },
      get wormInTunnel() { return wormInTunnelRef.current; },
      get inactiveSideKeys() { return inactiveSideKeysRef.current; },
      entryKey,
      exitKey,
      timeOffset: getStableOffset(tunnel.id),
    });
    return () => unregisterAnim(tunnelKey);
  }, [tunnelKey, entryKey, exitKey, tunnel.id, registerAnim, unregisterAnim]);

  // Calculate tunnel path
  const { entryPos, exitPos } = useMemo(() => {
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
    return { entryPos: entryCenter.toArray(), exitPos: exitCenter.toArray() };
  }, [tunnel, size, explosionFactor]);

  // Pre-compute geometries — straight-line paths need very few segments (4 is visually identical to 32).
  // Three variants pre-built so isTarget switching never reallocates GPU geometry.
  const geometries = useMemo(() => {
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
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(entryCenter, new THREE.Vector3(0, 0, 0)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), exitCenter));
    return {
      normal: new THREE.TubeGeometry(path, 4, 0.08, 8, false),
      target: new THREE.TubeGeometry(path, 4, 0.12, 8, false),
      glow:   new THREE.TubeGeometry(path, 4, 0.2,  8, false),
    };
  }, [tunnel, size, explosionFactor]);

  useEffect(() => () => {
    geometries.normal.dispose();
    geometries.target.dispose();
    geometries.glow.dispose();
  }, [geometries]);

  const color = isTarget ? TARGET_TUNNEL_COLOR : TUNNEL_COLOR;
  const entryActive = !inactiveSideKeys.has(getTunnelSideKey(tunnel.entry));
  const exitActive = !inactiveSideKeys.has(getTunnelSideKey(tunnel.exit));
  const tunnelOpacityScale = entryActive || exitActive ? 1 : 0.25;

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
  // Single animation registry — all tunnel refs stored here, driven by one useFrame.
  const animMapRef = useRef(new Map());

  const registerAnim = useCallback((key, refs) => { animMapRef.current.set(key, refs); }, []);
  const unregisterAnim = useCallback((key) => { animMapRef.current.delete(key); }, []);

  // One useFrame drives ALL tunnel animations — replaces N individual callbacks.
  useFrame((state, delta) => {
    for (const refs of animMapRef.current.values()) {
      const { tube, glow, isTarget, wormInTunnel, inactiveSideKeys: inactiveKeys, entryKey, exitKey, timeOffset } = refs;
      if (!tube) continue;

      const t = state.clock.elapsedTime + timeOffset;
      const pulseSpeed = isTarget ? 4 : 2;
      const entryActive = !inactiveKeys.has(entryKey);
      const exitActive = !inactiveKeys.has(exitKey);
      const opacityScale = entryActive || exitActive ? 1 : 0.25;

      const baseOpacity = (wormInTunnel ? 0.9 : (isTarget ? 0.7 : 0.4)) * opacityScale;
      tube.material.opacity = baseOpacity + Math.sin(t * pulseSpeed) * 0.1 * opacityScale;

      const baseEmissive = isTarget ? 0.8 : 0.4;
      tube.material.emissiveIntensity = baseEmissive + Math.sin(t * pulseSpeed) * 0.2;

      if (glow && isTarget) {
        glow.material.opacity = 0.2 + Math.sin(t * 6) * 0.1;
      }

      // Suppress unused-var warning — delta consumed intentionally to advance time via state.clock
      void delta;
    }
  });

  if (!tunnels || tunnels.length === 0) return null;

  return (
    <group>
      {tunnels.map(tunnel => (
        <TunnelTube
          key={tunnel.id}
          tunnelKey={tunnel.id}
          tunnel={tunnel}
          size={size}
          explosionFactor={explosionFactor}
          isTarget={tunnel.id === targetTunnelId}
          wormInTunnel={tunnel.id === wormTunnelId}
          inactiveSideKeys={inactiveSideKeys}
          registerAnim={registerAnim}
          unregisterAnim={unregisterAnim}
        />
      ))}
    </group>
  );
}
