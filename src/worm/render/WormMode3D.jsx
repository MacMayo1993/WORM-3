// src/worm/render/WormMode3D.jsx
// Shared 3D render component for WORM mode (surface + tunnel)
// Includes WormTileHighlight (surface-only) and the top-level WormMode3D scene group

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import WormTrail from '../WormTrail.jsx';
import ParityOrbs from '../ParityOrb.jsx';
import WormTunnelNetwork from '../WormTunnelNetwork.jsx';
import { getSegmentWorldPos } from '../wormLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { FACE_COLORS, ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';

// Face rotation to align plane with each cube face normal (pointing outward)
const HIGHLIGHT_ROT = {
  PZ: [0, 0, 0],
  NZ: [0, Math.PI, 0],
  PX: [0, Math.PI / 2, 0],
  NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0],
};

// Face outward normals for lifting the highlight plane above the sticker surface
const HIGHLIGHT_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Sticker surface sits at 0.51 from cubie center; lift slightly above
const HIGHLIGHT_LIFT = 0.53;

const _highlightGeo = new THREE.PlaneGeometry(0.95, 0.95);

// One pre-built material per face color (keyed by hex string) — no per-frame allocation
const _highlightMats = {};
for (const hex of Object.values(FACE_COLORS)) {
  _highlightMats[hex] = new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
// Fallback material for unknown colors
const _highlightMatFallback = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#00ff88'),
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

// Precomputed flat list of all highlight materials for opacity animation (avoids per-frame Object.values call)
const _highlightMatList = [...Object.values(_highlightMats), _highlightMatFallback];

/**
 * Renders glowing tile highlights at each surface-mode worm segment position.
 * Each tile glows in the antipodal color of its sticker.
 */
function WormTileHighlight({ segments, size, explosionFactor }) {
  const cubies = useGameStore(s => s.cubies);
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);
  const timeRef = useRef(0);
  // Track whether there are tiles to animate; avoids material writes every frame when idle
  const hasTilesRef = useRef(false);

  const tileData = useMemo(() => {
    return segments
      .filter(seg => seg.dirKey) // surface segments only
      .map(seg => {
        const base = getSegmentWorldPos(seg, size, explosionFactor);
        const n = HIGHLIGHT_NORMALS[seg.dirKey] || [0, 0, 1];
        const pos = [base[0] + n[0] * HIGHLIGHT_LIFT, base[1] + n[1] * HIGHLIGHT_LIFT, base[2] + n[2] * HIGHLIGHT_LIFT];
        const rot = HIGHLIGHT_ROT[seg.dirKey] || [0, 0, 0];
        // Look up the sticker's antipodal face color using the current color scheme
        const faceId = cubies?.[seg.x]?.[seg.y]?.[seg.z]?.stickers?.[seg.dirKey]?.curr;
        const antipodalId = ANTIPODAL_COLOR[faceId];
        const hex = faceColors[antipodalId] || null;
        const mat = (hex && _highlightMats[hex]) || _highlightMatFallback;
        return { pos, rot, mat };
      });
  }, [segments, size, explosionFactor, cubies, faceColors]);

  hasTilesRef.current = tileData.length > 0;

  useFrame((_state, delta) => {
    if (!hasTilesRef.current) return; // nothing to animate — skip material writes
    timeRef.current += delta;
    const opacity = 0.25 + Math.sin(timeRef.current * 6) * 0.15;
    // Update all materials each frame using precomputed list — no per-frame allocation
    for (const mat of _highlightMatList) mat.opacity = opacity;
  });

  if (tileData.length === 0) return null;

  return (
    <group>
      {tileData.map(({ pos, rot, mat }, i) => (
        <mesh
          key={i}
          position={pos}
          rotation={rot}
          geometry={_highlightGeo}
          material={mat}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

const EMPTY_INACTIVE_TUNNEL_SIDES = new Set();

/**
 * Top-level 3D render component for WORM mode.
 * Supports both surface and tunnel modes.
 */
export function WormMode3D({
  worm,
  orbs,
  size,
  explosionFactor,
  gameState,
  mode = 'surface',
  targetTunnelId = null,
  tunnels = [],
  inactiveTunnelSides
}) {
  const isTunnelMode = mode === 'tunnel';
  const wormTunnelId = isTunnelMode && worm[0] ? worm[0].tunnelId : null;
  const inactiveSideKeys = inactiveTunnelSides || EMPTY_INACTIVE_TUNNEL_SIDES;

  return (
    <>
      {/* Tunnel network visualization (only in tunnel mode) */}
      {isTunnelMode && tunnels.length > 0 && (
        <WormTunnelNetwork
          tunnels={tunnels}
          size={size}
          explosionFactor={explosionFactor}
          targetTunnelId={targetTunnelId}
          wormTunnelId={wormTunnelId}
          inactiveSideKeys={inactiveSideKeys}
        />
      )}

      {/* Tile highlight overlay - shows which tiles the worm is pressing */}
      {!isTunnelMode && (
        <WormTileHighlight
          segments={worm}
          size={size}
          explosionFactor={explosionFactor}
        />
      )}

      <WormTrail
        segments={worm}
        size={size}
        explosionFactor={explosionFactor}
        alive={gameState === 'playing' || gameState === 'paused'}
        mode={mode}
      />
      <ParityOrbs
        orbs={orbs}
        size={size}
        explosionFactor={explosionFactor}
        mode={mode}
        targetTunnelId={targetTunnelId}
      />
    </>
  );
}
