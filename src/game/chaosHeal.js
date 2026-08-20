// src/game/chaosHeal.js
// The player's chaos-mode heal wave, as a pure function so it can be tested
// without a pointer event and a Three.js canvas.
//
// Tapping a damaged tile during a Disparity round heals it and every damaged
// tile reachable from it across the manifold (chaos chains hop seams, so a
// face-local heal left orphaned damage on the neighbouring faces the chain had
// jumped to). The result is grouped into waves by BFS depth; the caller plays
// one wave per animation beat.
//
// Dead tiles (flips at the cap) are NOT healed and do not conduct the wave.
// A tombstone is final — it is what the winner check, the death ledger and the
// ALIVE counter all agree on. Healing one resurrected it on the render thread
// only, leaving a tile that looked healthy but was already struck from the
// simulation's living set.

import { getManifoldNeighbors } from './manifoldLogic.js';

const isHealable = (st, flipCap) => !!st && st.curr !== st.orig && (st.flips || 0) < flipCap;

/**
 * Collect the heal wave rooted at one sticker.
 *
 * @param {Array} cubies      cube state
 * @param {number} size       cube size
 * @param {{x:number,y:number,z:number,dirKey:string}} origin  tapped sticker
 * @param {number} flipCap    effective flip cap — tiles at or over it are dead
 * @returns {Array<Array<{x,y,z,dirKey}>>} waves by BFS depth, [] if not healable
 */
export function collectHealWave(cubies, size, origin, flipCap) {
  const { x, y, z, dirKey } = origin;
  const root = cubies[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!isHealable(root, flipCap)) return [];

  const waves = [[{ x, y, z, dirKey }]];
  const visited = new Set([`${x},${y},${z},${dirKey}`]);
  let frontier = [{ x, y, z, dirKey }];

  while (frontier.length > 0) {
    const nextFrontier = [];
    const wave = [];
    for (const cur of frontier) {
      for (const n of getManifoldNeighbors(cur.x, cur.y, cur.z, cur.dirKey, size)) {
        const key = `${n.x},${n.y},${n.z},${n.dirKey}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (isHealable(cubies[n.x]?.[n.y]?.[n.z]?.stickers?.[n.dirKey], flipCap)) {
          wave.push(n);
          nextFrontier.push(n);
        }
      }
    }
    if (wave.length > 0) waves.push(wave);
    frontier = nextFrontier;
  }

  return waves;
}

export { isHealable };
