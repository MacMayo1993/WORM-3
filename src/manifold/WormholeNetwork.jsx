import React, { useMemo, useState, useEffect } from 'react';
import WormholeTunnel from './WormholeTunnel.jsx';
import { FACE_COLORS, FLIP_CAP } from '../utils/constants.js';
import { getManifoldGridId } from '../game/coordinates.js';
import { findAntipodalStickerByGrid } from '../game/manifoldLogic.js';

// B2: Cap the number of rendered tunnels.
// At peak 5×5 chaos there can be ~75 active antipodal pairs; each renders
// up to 50 animated strands × 30 pts = 1 125 GPU line vertices per tunnel.
// Keeping only the most active MAX_TUNNELS connections bounds GPU work to a
// fixed budget and keeps the visually interesting pairs on screen.
const MAX_TUNNELS = 24;

const WormholeNetwork = ({ cubies, size, showTunnels, manifoldMap, cubieRefs, faceColors, explosionFactor = 0 }) => {
  const fc = faceColors || FACE_COLORS;

  // B4: debounce cubies so tunnel geometry only rebuilds at most every 150ms
  // instead of on every sticker flip (~12×/s at L4 chaos).
  const [debouncedCubies, setDebouncedCubies] = useState(cubies);
  useEffect(() => {
    if (!showTunnels) return;
    const timer = setTimeout(() => setDebouncedCubies(cubies), 150);
    return () => clearTimeout(timer);
  }, [cubies, showTunnels]);

  const tunnelData = useMemo(() => {
    if (!showTunnels) return [];
    // Guard against size/cubies mismatch during size transitions
    if (debouncedCubies.length !== size) return [];

    const connections = [];
    const processed = new Set();

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = debouncedCubies[x][y][z];

          Object.entries(cubie.stickers).forEach(([dirKey, sticker]) => {
            if (sticker.flips === 0) return;
            // Dead tiles — sever the tunnel, connection is gone
            if (sticker.flips >= FLIP_CAP) return;

            const gridId = getManifoldGridId(sticker, size);
            if (processed.has(gridId)) return;
            processed.add(gridId);

            const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
            if (!antipodalLoc) return;
            // Also sever if the antipodal side is dead
            if ((antipodalLoc.sticker?.flips || 0) >= FLIP_CAP) return;

            const idx1 = ((x * size) + y) * size + z;
            const idx2 = ((antipodalLoc.x * size) + antipodalLoc.y) * size + antipodalLoc.z;

            connections.push({
              id: gridId,
              gridId2: antipodalLoc.sticker ? getManifoldGridId(antipodalLoc.sticker, size) : null,
              meshIdx1: idx1,
              meshIdx2: idx2,
              dirKey1: dirKey,
              dirKey2: antipodalLoc.dirKey,
              flips: sticker.flips,
              intensity: Math.min(sticker.flips / 10, 1),
              color1: fc[sticker.orig],
              color2: fc[antipodalLoc.sticker.orig]
            });
          });
        }
      }
    }
    // B2: sort by activity (flip count) descending and take the top MAX_TUNNELS.
    // Most-active pairs stay visible; low-activity tail is dropped silently.
    connections.sort((a, b) => b.flips - a.flips);
    return connections.slice(0, MAX_TUNNELS);
  }, [debouncedCubies, size, showTunnels, manifoldMap, fc]);

  // B3: adaptive strand-count LOD based on how many tunnels are visible.
  // With more tunnels each tunnel needs fewer strands to maintain a playable
  // frame rate — the total GPU line-vertex budget stays roughly constant.
  //  1–12 tunnels  → full density (50 strands max)
  // 13–24 tunnels  → half density (25 strands max)
  const maxStrands = tunnelData.length > 12 ? 25 : 50;

  if (!showTunnels) return null;

  return (
    <group>
      {tunnelData.map((t) => (
        <WormholeTunnel
          key={t.id}
          gridId1={t.id}
          gridId2={t.gridId2}
          meshIdx1={t.meshIdx1}
          meshIdx2={t.meshIdx2}
          dirKey1={t.dirKey1}
          dirKey2={t.dirKey2}
          cubieRefs={cubieRefs}
          intensity={t.intensity}
          flips={t.flips}
          color1={t.color1}
          color2={t.color2}
          size={size}
          explosionFactor={explosionFactor}
          maxStrands={maxStrands}
        />
      ))}
    </group>
  );
};

export default WormholeNetwork;
