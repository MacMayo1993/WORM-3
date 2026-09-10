// Every surface sticker appears in exactly one antipodal pair.
export const FACES = [
  { axis: 2, sign: 1, color: 1, rotation: [0, 0, 0] },
  { axis: 2, sign: -1, color: 4, rotation: [0, Math.PI, 0] },
  { axis: 0, sign: 1, color: 5, rotation: [0, Math.PI / 2, 0] },
  { axis: 0, sign: -1, color: 2, rotation: [0, -Math.PI / 2, 0] },
  { axis: 1, sign: 1, color: 3, rotation: [-Math.PI / 2, 0, 0] },
  { axis: 1, sign: -1, color: 6, rotation: [Math.PI / 2, 0, 0] }
];
export const CELLS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (x || y || z) CELLS.push([x, y, z]);
}
export const TILES = CELLS.flatMap(position => FACES.flatMap((face, faceIndex) =>
  position[face.axis] === face.sign ? [{ position, face, faceIndex }] : []));
export const PAIRS = TILES.filter(tile => tile.face.sign === 1);
export const flippedColor = (faceIndex, angle) => FACES[angle >= Math.PI / 2 ? faceIndex ^ 1 : faceIndex].color;

// Bow each connection away from the common center. Both coordinates in the
// sticker plane reverse at the far endpoint as well as the face normal.
export function pairPoint(pair, u, spacing, out, offset = 0.51) {
  const p = Math.max(0, Math.min(1, u));
  const f = pair.face.axis;
  const x = pair.position[0] * spacing + (f === 0 ? offset : 0);
  const y = pair.position[1] * spacing + (f === 1 ? offset : 0);
  const z = pair.position[2] * spacing + (f === 2 ? offset : 0);
  const axis = (pair.face.axis + 1) % 3;
  const next = (axis + 1) % 3;
  const bow = Math.sin(Math.PI * p);
  out.set(x * (1 - 2 * p), y * (1 - 2 * p), z * (1 - 2 * p));
  out.setComponent(axis, out.getComponent(axis) + bow * (0.8 + pair.position[axis] * 0.24));
  out.setComponent(next, out.getComponent(next) + bow * pair.position[next] * 0.24);
  return out;
}
