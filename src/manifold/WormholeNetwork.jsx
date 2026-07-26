import React, { useMemo, useState, useDeferredValue } from 'react';
import { useFrame } from '@react-three/fiber';
import MobiusTunnel from './MobiusTunnel.jsx';
import RestingCords from './RestingCords.jsx';
import { FACE_COLORS, FLIP_CAP } from '../utils/constants.js';
import { getManifoldGridId } from '../game/coordinates.js';
import { findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';

// B2: Cap the number of rendered tunnels.
// At peak 5×5 chaos there can be ~75 active antipodal pairs; each renders
// up to 30 animated strands × 30 pts per tunnel.
// 150 (was 300) keeps GPU work tighter; during Worm mode the extra clutter
// of 300 tunnels hurts both performance and readability.
const MAX_TUNNELS = 150;

// How many tunnels may render at full Möbius detail at once.
//
// This is the whole point of the two-tier split: the old render gave every
// active pair the hero treatment, so nothing stood out and the frame cost
// scaled linearly with a number the player cannot control. Now the resting
// majority is one cheap merged draw (RestingCords) and only a handful of
// tunnels — the one the worm is in, plus the most recent flip events — get
// ribbons, bumpers and portals.
const FOCUS_BUDGET = 3;

// Static direction list — avoids Object.entries() allocating a new array of
// arrays on every iteration of the O(N³) loop (GC pressure in chaos mode).
const DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

const WormholeNetwork = ({ manifoldMap, cubieRefs }) => {
  const { cubies, size, showTunnels, tunnelDetail, settings, tunnelBirths, tunnelPulses } = useGameStore(
    useShallow(s => ({
      cubies: s.cubies,
      size: s.size,
      showTunnels: s.showTunnels,
      tunnelDetail: s.tunnelDetail,
      settings: s.settings,
      // Subscribed once here and passed down, rather than once per MobiusTunnel.
      // These maps are pruned to in-flight animations only, so they are small.
      tunnelBirths: s.tunnelBirths,
      tunnelPulses: s.tunnelPulses,
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

  // The worm's current tunnel lives in mutable module state (written by
  // WormChaseCamera on the Three.js RAF, not through the store). Poll it and
  // lift it into React state only when it actually changes — that happens once
  // per traversal, so this costs a comparison per frame and nothing else.
  const [wormTunnelId, setWormTunnelId] = useState(null);
  useFrame(() => {
    const id = tunnelState.active ? tunnelState.activeTunnelId : null;
    if (id !== wormTunnelId) setWormTunnelId(id);
  });

  // Focus set: which pairs earn full Möbius detail this render.
  //
  //  • 'hints' — the worm's tunnel only. Flips still register through the cord
  //    heat ramp, but nothing permanent is ever drawn at hero fidelity.
  //  • 'full'  — additionally the most recent flip events (births first, since
  //    a pair's first identification is the moment worth spending on), and then
  //    the hottest pairs by flip count to fill any remaining budget.
  //
  // That last fallback matters: without it, switching to Full while nothing is
  // happening leaves the budget unspent and the toggle appears to do nothing.
  // Topping up with the highest-flip pairs means Full always shows something,
  // and the ribbons land on the pairs closest to FLIP_CAP — the ones actually
  // worth looking at.
  const focusIds = useMemo(() => {
    const ids = new Set();
    if (!showTunnels) return ids;

    if (wormTunnelId) ids.add(wormTunnelId);

    if (tunnelDetail === 'full') {
      const events = [];
      for (const k in tunnelBirths) events.push([k, tunnelBirths[k].startMs + 1e9]); // births outrank pulses
      for (const k in tunnelPulses) events.push([k, tunnelPulses[k].startMs]);
      events.sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < events.length && ids.size < FOCUS_BUDGET; i++) ids.add(events[i][0]);

      // tunnelData is already sorted by flips descending, so the front of the
      // list is the hottest pairs.
      for (let i = 0; i < tunnelData.length && ids.size < FOCUS_BUDGET; i++) ids.add(tunnelData[i].pairId);
    }
    return ids;
  }, [showTunnels, tunnelDetail, wormTunnelId, tunnelBirths, tunnelPulses, tunnelData]);

  const focusTunnels = useMemo(
    () => (focusIds.size ? tunnelData.filter((t) => focusIds.has(t.pairId)) : []),
    [tunnelData, focusIds]
  );

  if (!showTunnels) return null;

  return (
    <group>
      {/* Resting tier — every active pair in a single merged draw call. */}
      <RestingCords
        tunnels={tunnelData}
        cubieRefs={cubieRefs}
        focusIds={focusIds}
        maxStrands={MAX_TUNNELS}
      />

      {/* Focus tier — full ribbon, bumpers and portal, capped at FOCUS_BUDGET. */}
      {focusTunnels.map((t) => (
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
          tunnelBirths={tunnelBirths}
          tunnelPulses={tunnelPulses}
        />
      ))}
    </group>
  );
};

export default WormholeNetwork;
