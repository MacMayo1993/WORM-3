// src/game/chaosMetrics.js
// Surface-sticker enumeration and chaos health metrics, shared between the
// chaos worker and main-thread hooks so the two can't drift apart.

// All (x,y,z) coordinates whose cubie has at least one exposed face.
export const buildSurfaceCoords = (size) => {
  const coords = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1) {
          coords.push([x, y, z]);
        }
      }
    }
  }
  return coords;
};

// One O(surface) scan producing every chaos HUD/game metric.
// flipCap defaults to Infinity so callers that don't track dead tiles
// (main-thread seeding) get deadTiles = 0 without passing a cap.
export const computeChaosMetrics = (cubeState, surfCoords, flipCap = Infinity) => {
  let disparity = 0;
  let flipActive = 0;
  let edgeTotal = 0;
  let totalFlips = 0;
  let deadTiles = 0;
  for (const [x, y, z] of surfCoords) {
    const c = cubeState[x][y][z];
    for (const key of Object.keys(c.stickers)) {
      const st = c.stickers[key];
      edgeTotal++;
      if (st.curr !== st.orig) disparity++;
      const flips = st.flips || 0;
      totalFlips += flips;
      if (flips > 0) flipActive++;
      if (flips >= flipCap) deadTiles++;
    }
  }
  return { disparity, flipActive, edgeTotal, totalFlips, deadTiles };
};

// Dead-tile count read straight off a cube, using the SAME predicate the
// renderer uses to draw a tombstone (flips at or over the cap). The ALIVE
// counter is derived from this rather than from the death ledger's length so
// the number on the HUD can never disagree with the tiles on screen.
// Walks the surface inline rather than via buildSurfaceCoords: this runs inside
// a Zustand selector, i.e. on every store write, so it must not allocate.
export const countDeadTiles = (cubeState, size, flipCap) => {
  if (!cubeState || !(flipCap > 0)) return 0;
  let dead = 0;
  const last = size - 1;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (x !== 0 && x !== last && y !== 0 && y !== last && z !== 0 && z !== last) continue;
        const c = cubeState[x]?.[y]?.[z];
        if (!c) continue;
        for (const key in c.stickers) {
          if ((c.stickers[key].flips || 0) >= flipCap) dead++;
        }
      }
    }
  }
  return dead;
};
