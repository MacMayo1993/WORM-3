// src/game/antipodalIntegrity.js
// Antipodal integrity metric I(T) from the paper:
// "Discrete Quotient Structures and Regime Transitions in Combinatorial Puzzles"
//
// For each of the 27 antipodal position-pairs on the cube surface,
// check whether the colors currently at those two positions are antipodal.
// I(T) = (# preserved pairs) / 27

import { ANTIPODAL_COLOR } from '../utils/constants.js';

// The critical threshold from the paper: k* = 1/(2 ln 2) ≈ 0.7213
export const K_STAR = 1 / (2 * Math.LN2);

// Map direction key to its antipodal direction
const ANTIPODAL_DIR = {
  PX: 'NX', NX: 'PX',
  PY: 'NY', NY: 'PY',
  PZ: 'NZ', NZ: 'PZ'
};

/**
 * Compute the antipodal integrity of the current cube state.
 *
 * The antipodal map sends position (x, y, z) → (S-1-x, S-1-y, S-1-z)
 * and direction D → opposite(D).
 *
 * For each surface position (only counting one side of each pair),
 * check if the color at that position and the color at its antipodal
 * position are conjugate under ANTIPODAL_COLOR.
 *
 * Returns { integrity, preserved, broken, total, pairs }
 */
export const computeAntipodalIntegrity = (cubies, size) => {
  const S = size - 1;
  const pairs = [];
  const visited = new Set();

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          // Build a unique key for this surface position
          const posKey = `${x},${y},${z},${dirKey}`;

          // Compute the antipodal surface position
          const ax = S - x;
          const ay = S - y;
          const az = S - z;
          const aDir = ANTIPODAL_DIR[dirKey];
          const antiKey = `${ax},${ay},${az},${aDir}`;

          // Skip if we already processed this pair from the other side
          if (visited.has(posKey) || visited.has(antiKey)) continue;
          visited.add(posKey);
          visited.add(antiKey);

          // Get the sticker at the antipodal position
          const antiCubie = cubies[ax]?.[ay]?.[az];
          const antiSt = antiCubie?.stickers?.[aDir];

          if (antiSt) {
            const isPreserved = ANTIPODAL_COLOR[st.curr] === antiSt.curr;
            pairs.push({
              a: { x, y, z, dirKey },
              b: { x: ax, y: ay, z: az, dirKey: aDir },
              preserved: isPreserved
            });
          }
        }
      }
    }
  }

  const preserved = pairs.filter((p) => p.preserved).length;
  const total = pairs.length || 1;
  const broken = total - preserved;
  const integrity = preserved / total;

  return { integrity, preserved, broken, total, pairs };
};

/**
 * Compute the commutator norm C(T) — the number of stickers that violate
 * the antipodal commutativity condition T∘A = A∘T.
 *
 * C(T) ≈ 54 * (1 - I(T))
 */
export const computeCommutatorNorm = (cubies, size) => {
  const { integrity } = computeAntipodalIntegrity(cubies, size);
  const totalStickers = size * size * 6;
  return Math.round(totalStickers * (1 - integrity));
};

/**
 * Determine the regime based on integrity vs k*.
 * Returns 'structure' if I(T) > k*, 'entropy' if I(T) < k*, 'critical' if near k*.
 */
export const getRegime = (integrity) => {
  const epsilon = 0.02;
  if (integrity > K_STAR + epsilon) return 'structure';
  if (integrity < K_STAR - epsilon) return 'entropy';
  return 'critical';
};
