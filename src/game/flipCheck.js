// src/game/flipCheck.js
// Flip Cube levels' Check: which tiles are not yet right. A face is aiming for the
// colour most of its tiles already show (the centre breaks a tie on odd cubes), so
// a nearly finished face marks its few strays and a scrambled one marks the
// minority. It only reads the board; it never decides the win.

const FACE_AXES = {
  PX: ['x', 'size'], NX: ['x', 0], PY: ['y', 'size'], NY: ['y', 0], PZ: ['z', 'size'], NZ: ['z', 0],
};

/** Every outer sticker on face `dir`, as { x, y, z, dirKey, curr }. */
function faceTiles(cubies, size, dir) {
  const [axis, edge] = FACE_AXES[dir];
  const fixed = edge === 'size' ? size - 1 : 0;
  const tiles = [];
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      const pos = axis === 'x' ? [fixed, a, b] : axis === 'y' ? [a, fixed, b] : [a, b, fixed];
      const sticker = cubies[pos[0]][pos[1]][pos[2]].stickers[dir];
      if (sticker) tiles.push({ x: pos[0], y: pos[1], z: pos[2], dirKey: dir, curr: sticker.curr });
    }
  }
  return tiles;
}

/** The tiles that differ from their face's target colour. */
export function flipCheckTiles(cubies, size) {
  if (cubies?.length !== size) return [];
  const wrong = [];
  const mid = (size - 1) / 2;
  for (const dir of Object.keys(FACE_AXES)) {
    const tiles = faceTiles(cubies, size, dir);
    const counts = new Map();
    for (const t of tiles) counts.set(t.curr, (counts.get(t.curr) ?? 0) + 1);
    const top = Math.max(...counts.values());
    const leaders = [...counts].filter(([, n]) => n === top).map(([c]) => c);
    let target = leaders[0];
    if (leaders.length > 1 && size % 2) {
      const centre = tiles.find(t => [t.x, t.y, t.z].filter(v => v === mid).length === 2);
      if (centre && leaders.includes(centre.curr)) target = centre.curr;
    }
    for (const t of tiles) if (t.curr !== target) wrong.push({ x: t.x, y: t.y, z: t.z, dirKey: t.dirKey });
  }
  return wrong;
}
