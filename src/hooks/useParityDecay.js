/**
 * useParityDecay Hook
 *
 * Tiles that have been flipped are "forever changed" — the orientation parity
 * violation makes them unstable. Each tick, every tile with flip history has a
 * chance to spontaneously flip (probability scales with flip count). When a
 * tile flips, it may propagate the instability to neighboring tiles.
 *
 * This runs independently of chaos mode at a slower, ambient pace.
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid, getManifoldNeighbors } from '../game/manifoldLogic.js';
import { isOnEdge } from '../game/cubeUtils.js';
import { isInRefractory, markFlipped } from '../game/refractoryMap.js';
import { FLIP_CAP } from '../utils/constants.js';

// Tuning constants
const TICK_MS = 2500;            // check interval
const COOLDOWN_MS = 4000;        // cooldown after a spontaneous flip
const BASE_CHANCE = 0.018;       // probability multiplier per flip count
const MAX_CHANCE = 0.15;         // cap per-tile probability
const PROPAGATE_CHANCE = 0.012;  // neighbor propagation probability per flip
const MAX_PROPAGATE = 0.10;      // cap propagation probability

export function useParityDecay() {
  const cubies = useGameStore((s) => s.cubies);
  const setCubies = useGameStore((s) => s.setCubies);
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const showWelcome = useGameStore((s) => s.showWelcome);
  const chaosLevel = useGameStore((s) => s.chaosLevel);

  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;

  useEffect(() => {
    // Don't run during menus/welcome/animations, or while chaos mode is active.
    // DISABLING by default to ensure tile identity stability as requested.
    return;
    // if (showMainMenu || showWelcome || chaosLevel > 0) return;

    let raf = 0;
    let last = performance.now();
    let tickAcc = 0;
    let cooldownAcc = 0;
    let inCooldown = false;

    const tick = () => {
      const state = cubiesRef.current;
      if (!state) return null;
      const S = state.length;

      // Collect all tiles with flip history (surface stickers only)
      const candidates = [];
      for (let x = 0; x < S; x++)
        for (let y = 0; y < S; y++)
          for (let z = 0; z < S; z++) {
            const c = state[x][y][z];
            for (const dirKey of Object.keys(c.stickers)) {
              const st = c.stickers[dirKey];
              if (st.flips > 0 && st.flips < FLIP_CAP && isOnEdge(x, y, z, dirKey, S)) {
                candidates.push({ x, y, z, dirKey, flips: st.flips });
              }
            }
          }

      if (!candidates.length) return null;

      // Each candidate independently rolls for a spontaneous flip
      // Higher flip count = higher probability
      for (const tile of candidates) {
        // Respect per-tile refractory period
        if (isInRefractory(tile.x, tile.y, tile.z, tile.dirKey)) continue;

        const chance = Math.min(tile.flips * BASE_CHANCE, MAX_CHANCE);
        if (Math.random() >= chance) continue;

        // This tile spontaneously flips!
        const manifoldMap = buildManifoldGridMap(state, S);

        // Mark both tiles in the pair as in refractory
        const sticker = state[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
        markFlipped(tile.x, tile.y, tile.z, tile.dirKey);
        if (sticker) {
          const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, S);
          if (antipodalLoc) {
            markFlipped(antipodalLoc.x, antipodalLoc.y, antipodalLoc.z, antipodalLoc.dirKey);
          }
        }

        let next = flipStickerPair(state, S, tile.x, tile.y, tile.z, tile.dirKey, manifoldMap);

        // Propagation: check neighbors
        const neighbors = getManifoldNeighbors(tile.x, tile.y, tile.z, tile.dirKey, S);
        for (const nb of neighbors) {
          if (isInRefractory(nb.x, nb.y, nb.z, nb.dirKey)) continue;

          const nc = next[nb.x]?.[nb.y]?.[nb.z];
          if (!nc) continue;
          const nst = nc.stickers[nb.dirKey];
          if (!nst || !isOnEdge(nb.x, nb.y, nb.z, nb.dirKey, S)) continue;
          if ((nst.flips || 0) >= FLIP_CAP) continue;

          // Propagation chance scales with source flip count
          const propChance = Math.min(tile.flips * PROPAGATE_CHANCE, MAX_PROPAGATE);
          if (Math.random() < propChance) {
            const freshMap = buildManifoldGridMap(next, S);
            markFlipped(nb.x, nb.y, nb.z, nb.dirKey);
            const nbSticker = next[nb.x]?.[nb.y]?.[nb.z]?.stickers?.[nb.dirKey];
            if (nbSticker) {
              const nbAntipodal = findAntipodalStickerByGrid(freshMap, nbSticker, S);
              if (nbAntipodal) {
                markFlipped(nbAntipodal.x, nbAntipodal.y, nbAntipodal.z, nbAntipodal.dirKey);
              }
            }
            next = flipStickerPair(next, S, nb.x, nb.y, nb.z, nb.dirKey, freshMap);
          }
        }

        return next; // Only one spontaneous event per tick
      }

      return null;
    };

    const loop = (now) => {
      const dt = now - last;
      last = now;

      if (inCooldown) {
        cooldownAcc += dt;
        if (cooldownAcc >= COOLDOWN_MS) {
          inCooldown = false;
          cooldownAcc = 0;
        }
      } else {
        tickAcc += dt;
        if (tickAcc >= TICK_MS) {
          tickAcc = 0;
          // Skip if an animation is playing
          if (!useGameStore.getState().animState) {
            const result = tick();
            if (result) {
              setCubies(result);
              inCooldown = true;
              cooldownAcc = 0;
            }
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showMainMenu, showWelcome, chaosLevel, setCubies]);
}
