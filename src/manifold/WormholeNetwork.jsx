import React, { useMemo, useDeferredValue } from 'react';
import MobiusTunnel from './MobiusTunnel.jsx';
import { FACE_COLORS, FLIP_CAP } from '../utils/constants.js';
import { getManifoldGridId } from '../game/coordinates.js';
import { findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';

// B2: Cap the number of rendered tunnels.
// At peak 5×5 chaos there can be ~75 active antipodal pairs; each renders
// up to 30 animated strands × 30 pts per tunnel.
// 150 (was 300) keeps GPU work tighter; during Worm mode the extra clutter
// of 300 tunnels hurts both performance and readability.
const MAX_TUNNELS = 150;

// Static direction list — avoids Object.entries() allocating a new array of
// arrays on every iteration of the O(N³) loop (GC pressure in chaos mode).
const DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

const WormholeNetwork = ({ manifoldMap, cubieRefs }) => {
  const { cubies, size, showTunnels, settings } = useGameStore(
    useShallow(s => ({
      cubies: s.cubies,
      size: s.size,
      showTunnels: s.showTunnels,
      settings: s.settings,
    }))
  );
  // Narrow deps: only the two settings fields that affect face-color resolution.
  // Avoids re-running the lookup on every unrelated settings change (e.g. background theme).
  const fc = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings?.colorScheme, settings?.biomeMode?.faceAssignment]
  );

  // B4: useDeferredValue lets React keep the UI responsive while allowing
  // this heavy tunnel geometry calculation to lag safely behind the main thread,
  // without ever starving under continuous rapid state updates (chaos mode).
  const deferredCubies = useDeferredValue(cubies);

  const tunnelData = useMemo(() => {
    if (!showTunnels) return [];
    // Guard against size/cubies mismatch during size transitions
    if (deferredCubies.length !== size) return [];

    const connections = [];
    const processed = new Set();

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = deferredCubies[x][y][z];

          for (let i = 0; i < DIRS.length; i++) {
            const dirKey = DIRS[i];
            const sticker = cubie.stickers[dirKey];
            if (!sticker || sticker.flips === 0 || sticker.flips >= FLIP_CAP) continue;

            const gridId = getManifoldGridId(sticker, size);
            if (processed.has(gridId)) continue;
            processed.add(gridId);

            const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
            if (!antipodalLoc || !antipodalLoc.sticker) continue;
            // Also sever if the antipodal side is dead
            if (antipodalLoc.sticker.flips >= FLIP_CAP) continue;

            const antipodalGridId = getManifoldGridId(antipodalLoc.sticker, size);
            // Prevent the reverse-direction tunnel when the loop reaches the antipodal sticker.
            // Without this, each pair is rendered twice (once per endpoint), doubling draw calls.
            processed.add(antipodalGridId);

            const idx1 = ((x * size) + y) * size + z;
            const idx2 = ((antipodalLoc.x * size) + antipodalLoc.y) * size + antipodalLoc.z;

            const centerCoord = Math.floor(size / 2);
            const isCenter = (
              (x === centerCoord && y === centerCoord) ||
              (x === centerCoord && z === centerCoord) ||
              (y === centerCoord && z === centerCoord)
            );

            const pairId = [gridId, antipodalGridId].sort().join('|');
            connections.push({
              id: gridId,
              gridId2: antipodalGridId,
              pairId,
              meshIdx1: idx1,
              meshIdx2: idx2,
              dirKey1: dirKey,
              dirKey2: antipodalLoc.dirKey,
              flips: sticker.flips,
              active1: sticker.curr !== sticker.orig,
              active2: antipodalLoc.sticker.curr !== antipodalLoc.sticker.orig,
              isCenter,
              intensity: Math.min(sticker.flips / 10, 1),
              color1: fc[sticker.curr],
              color2: fc[antipodalLoc.sticker.curr]
            });
          }
        }
      }
    }
    // B2: sort by activity (flip count) descending and take the top MAX_TUNNELS.
    // Most-active pairs stay visible; low-activity tail is dropped silently.
    connections.sort((a, b) => b.flips - a.flips);
    return connections.slice(0, MAX_TUNNELS);
  }, [deferredCubies, size, showTunnels, manifoldMap, fc]);

  if (!showTunnels) return null;

  return (
    <group>
      {tunnelData.map((t) => (
        <MobiusTunnel
          key={t.id}
          tunnelId={t.pairId}
          meshIdx1={t.meshIdx1}
          meshIdx2={t.meshIdx2}
          dirKey1={t.dirKey1}
          dirKey2={t.dirKey2}
          cubieRefs={cubieRefs}
          flips={t.flips}
          color1={t.color1}
          color2={t.color2}
        />
      ))}
    </group>
  );
};

export default WormholeNetwork;
