// Where pickups go, so a board reads as evenly stocked instead of huddled.
//
// A uniform random tile clumps by chance (two orbs side by side, a bare face
// beside them), and filling a face in raster order lines orbs up along one
// edge. These two helpers replace both: `spreadCells` orders a face's cells so
// each next one is as far as possible from those already taken, and
// `pickSpread` keeps a random pick random while steering it away from what is
// already on the board. Pure: every draw goes through the caller's `rand`.

const FACE_NORMAL = { PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1] };

/**
 * A face's cells `[a, b]`, ordered farthest-point first from `taken`: each cell
 * is the one farthest from every cell before it (the taken ones included) and
 * from the face's rim.
 * Ties go to the cell nearer the face's centre, then to raster order, so the
 * order is fixed for a board size and a starting set.
 *
 * @param {number} size
 * @param {Array<[number, number]>} [taken] cells already placed
 * @returns {Array<[number, number]>} every other cell of the face
 */
export function spreadCells(size, taken = []) {
  const centre = (size - 1) / 2;
  const cells = [];
  const used = new Set(taken.map(([a, b]) => `${a},${b}`));
  for (let b = 0; b < size; b++) for (let a = 0; a < size; a++) {
    // The rim counts as taken too, one cell outside the face: plain farthest-point
    // order runs to the four corners first and leaves the middle for last.
    const rim = Math.min(a, b, size - 1 - a, size - 1 - b) + 1;
    if (!used.has(`${a},${b}`)) cells.push({ a, b, near: 4 * rim * rim, mid: (a - centre) ** 2 + (b - centre) ** 2 });
  }
  const settle = (a, b) => { for (const cell of cells) cell.near = Math.min(cell.near, (cell.a - a) ** 2 + (cell.b - b) ** 2); };
  for (const [a, b] of taken) settle(a, b);
  const order = [];
  while (cells.length) {
    let best = 0;
    for (let i = 1; i < cells.length; i++) {
      const cell = cells[i], top = cells[best];
      if (cell.near > top.near || (cell.near === top.near && cell.mid < top.mid)) best = i;
    }
    const [cell] = cells.splice(best, 1);
    order.push([cell.a, cell.b]);
    settle(cell.a, cell.b);
  }
  return order;
}

// A sticker's centre: its cubie plus half a step out of its face, so two faces of
// one corner cubie are apart rather than on the same point.
const gapSq = (p, q) => {
  const n = FACE_NORMAL[p.dirKey] ?? [0, 0, 0], m = FACE_NORMAL[q.dirKey] ?? [0, 0, 0];
  return (p.x + n[0] / 2 - q.x - m[0] / 2) ** 2 + (p.y + n[1] / 2 - q.y - m[1] / 2) ** 2 + (p.z + n[2] / 2 - q.z - m[2] / 2) ** 2;
};

/** How many random candidates `pickSpread` weighs. More is evener and less random. */
export const SPREAD_TRIES = 5;

/**
 * A random tile from `tiles`, steered away from `others`: the best of a few
 * random draws by distance to the nearest of `others` (Mitchell's best
 * candidate). With nothing to avoid, or one tile to choose from, it is the
 * plain uniform pick.
 *
 * @param {Array<{x:number,y:number,z:number,dirKey:string}>} tiles
 * @param {Array<{x:number,y:number,z:number,dirKey:string}>} others pickups already on the board
 * @param {() => number} [rand]
 * @param {number} [tries]
 */
export function pickSpread(tiles, others = [], rand = Math.random, tries = SPREAD_TRIES) {
  if (!tiles?.length) return null;
  const draw = () => tiles[Math.min(tiles.length - 1, Math.floor(rand() * tiles.length))];
  if (tiles.length === 1 || !others.length) return draw();
  let best = null, bestGap = -1;
  for (let i = 0; i < Math.min(tries, tiles.length); i++) {
    const tile = draw();
    let near = Infinity;
    for (const other of others) near = Math.min(near, gapSq(tile, other));
    if (near > bestGap) { best = tile; bestGap = near; }
  }
  return best;
}
