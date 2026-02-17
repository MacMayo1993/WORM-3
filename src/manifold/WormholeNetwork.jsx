import React, { useMemo, useState, useEffect } from 'react';
import WormholeTunnel from './WormholeTunnel.jsx';
import { FACE_COLORS, FLIP_CAP } from '../utils/constants.js';
import { getManifoldGridId } from '../game/coordinates.js';
import { findAntipodalStickerByGrid } from '../game/manifoldLogic.js';

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
    return connections;
  }, [debouncedCubies, size, showTunnels, manifoldMap, fc]);

  if (!showTunnels) return null;

  return (
    <group>
      {tunnelData.map((t) => (
        <WormholeTunnel
          key={t.id}
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
        />
      ))}
    </group>
  );
};

export default WormholeNetwork;
