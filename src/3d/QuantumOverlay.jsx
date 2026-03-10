// src/3d/QuantumOverlay.jsx
//
// Quantum Superposition visual overlay.
//
// When Quantum Mode is active, stickers that are in superposition are shown as
// ghostly translucent planes hovering just above the real sticker, pulsing between
// visibility states to convey quantum uncertainty.  The ghost uses the sticker's
// *alternate* (antipodal) color — the one it might collapse to on the next rotation.
//
// Each ghost has a unique flicker frequency derived from its seed so the overlay
// looks chaotically "alive" rather than uniformly blinking.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { getStickerWorldPos } from '../game/coordinates.js';

// Direction → outward face normal (unit vector)
const DIR_NORMAL = {
  PX: new THREE.Vector3(1, 0, 0),
  NX: new THREE.Vector3(-1, 0, 0),
  PY: new THREE.Vector3(0, 1, 0),
  NY: new THREE.Vector3(0, -1, 0),
  PZ: new THREE.Vector3(0, 0, 1),
  NZ: new THREE.Vector3(0, 0, -1),
};

// Pre-compute stable quaternion for each direction (plane faces the normal)
const _up = new THREE.Vector3(0, 1, 0);
const DIR_QUAT = {};
for (const [dir, norm] of Object.entries(DIR_NORMAL)) {
  DIR_QUAT[dir] = new THREE.Quaternion().setFromUnitVectors(_up, norm).clone();
}

// Ghost geometry — slightly smaller than real sticker to avoid z-fighting
const GHOST_GEO = new THREE.PlaneGeometry(0.82, 0.82);

// ── Individual ghost sticker ──────────────────────────────────────────────────
function GhostSticker({ entry, hexColor, size }) {
  const matRef = useRef(null);
  const { x, y, z, dirKey, seed } = entry;

  // World position: use a tiny extra offset so the ghost floats above real sticker
  const pos = useMemo(() => {
    const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
    const norm = DIR_NORMAL[dirKey];
    return [
      wp[0] + norm.x * 0.04,
      wp[1] + norm.y * 0.04,
      wp[2] + norm.z * 0.04,
    ];
  }, [x, y, z, dirKey, size]);

  const quat = DIR_QUAT[dirKey];

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.elapsedTime;
    // Each ghost pulses at a unique frequency in range [1.1, 2.7] Hz
    const freq = 1.1 + seed * 1.6;
    const phase = seed * Math.PI * 2;
    // Opacity: 0.15 (almost invisible) → 0.65 (clearly visible), smooth sine
    matRef.current.opacity = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(t * freq + phase));
  });

  return (
    <mesh position={pos} quaternion={quat} geometry={GHOST_GEO}>
      <meshBasicMaterial
        ref={matRef}
        color={hexColor}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Outer ring for "entanglement" beacon ─────────────────────────────────────
// A thin ring that pulses outward from a quantum sticker to hint at the
// connected antipodal ghost on the other side of the manifold.
function EntanglementRing({ entry, hexColor, size }) {
  const matRef = useRef(null);
  const meshRef = useRef(null);
  const { x, y, z, dirKey, seed } = entry;

  const pos = useMemo(() => {
    const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
    const norm = DIR_NORMAL[dirKey];
    return [wp[0] + norm.x * 0.06, wp[1] + norm.y * 0.06, wp[2] + norm.z * 0.06];
  }, [x, y, z, dirKey, size]);

  const quat = DIR_QUAT[dirKey];

  useFrame(({ clock }) => {
    if (!matRef.current || !meshRef.current) return;
    const t = clock.elapsedTime;
    // Ring pulses at half the ghost's rate so they feel independent
    const freq = 0.55 + seed * 0.8;
    const phase = seed * Math.PI * 2 + Math.PI; // offset from ghost pulse
    const pulse = 0.5 + 0.5 * Math.sin(t * freq + phase);
    // Grow from 1× to 1.5× scale, fade as it expands
    const scl = 1.0 + pulse * 0.5;
    meshRef.current.scale.setScalar(scl);
    matRef.current.opacity = (1 - pulse) * 0.4;
  });

  return (
    <mesh ref={meshRef} position={pos} quaternion={quat}>
      <ringGeometry args={[0.4, 0.46, 24]} />
      <meshBasicMaterial
        ref={matRef}
        color={hexColor}
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuantumOverlay() {
  const { quantumMode, superposedStickers, size, settings } = useGameStore(
    useShallow(s => ({
      quantumMode: s.quantumMode,
      superposedStickers: s.superposedStickers,
      size: s.size,
      settings: s.settings,
    }))
  );

  const resolvedColors = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment),
    [settings]
  );

  const entries = useMemo(() => Object.values(superposedStickers || {}), [superposedStickers]);

  if (!quantumMode || !entries.length) return null;

  return (
    <>
      {entries.map(entry => {
        const hexColor = resolvedColors?.[entry.color2] || '#a855f7';
        const key = `${entry.x}-${entry.y}-${entry.z}-${entry.dirKey}`;
        return (
          <React.Fragment key={key}>
            <GhostSticker entry={entry} hexColor={hexColor} size={size} />
            {/* Show entanglement ring only on ~40% of stickers to avoid visual clutter */}
            {entry.seed > 0.6 && (
              <EntanglementRing entry={entry} hexColor={hexColor} size={size} />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
