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
