// src/3d/megaShell.js
//
// Pure index math for the Mega shell renderer.
//
// The ordinary renderer mounts one React component per cubie and one per
// sticker. At 15³ that is 1,178 cubie subtrees — each with its own drei
// RoundedBox, which builds a unique ExtrudeGeometry per instance — plus 1,350
// sticker subtrees of ~16 scene nodes each. Measured in-browser: ~1,037 draw
// calls and 571k triangles, against a 250-draw budget.
//
// The Mega path draws the same shell as two InstancedMeshes. To do that it needs
// a stable, precomputed mapping in both directions:
//
//   slot → which cell/face it draws        (to write matrices)
//   cell/face → which slot draws it        (to write colours on a flip)
//
// Both are flat typed arrays built once per size. Nothing here touches Three.js
// or React, so it is directly testable.
//
// Linear cell indices use the repo-wide `x*size² + y*size + z` order — the same
// order `liveCubies.refs`, CubeAssembly's `positionCache` and WormholeNetwork
// index by. Sticker slots are ordered face-major (all PX, then NX, …) so a whole
// face is a contiguous range, which makes per-face colour uploads a single run.

/** Face order used by every slot index in this module. */
export const DIR_KEYS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

/** Outward normal per face, as a flat [x,y,z] triple. */
export const DIR_NORMALS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export const DIR_INDEX = { PX: 0, NX: 1, PY: 2, NY: 3, PZ: 4, NZ: 5 };

/** Is this cell on the shell (i.e. does it carry at least one sticker)? */
export function isShellCell(x, y, z, size) {
  const last = size - 1;
  return x === 0 || x === last || y === 0 || y === last || z === 0 || z === last;
}

/** Does this cell carry a sticker on this face? */
export function hasStickerOn(x, y, z, dirIndex, size) {
  const last = size - 1;
  switch (dirIndex) {
    case 0: return x === last;
    case 1: return x === 0;
    case 2: return y === last;
    case 3: return y === 0;
    case 4: return z === last;
    default: return z === 0;
  }
}

// One index per size. Membership depends only on the size, never on cube state,
// so this is built once and shared by every consumer for the life of the process.
const _cache = new Map();

/**
 * Build (or fetch) the slot ↔ cell mapping for a cube of this size.
 *
 * @returns {{
 *   size: number,
 *   bodyCount: number,
 *   stickerCount: number,
 *   bodyCell: Int32Array,      // body slot → linear cell index
 *   bodySlotOf: Int32Array,    // linear cell index → body slot, or -1
 *   stickerCell: Int32Array,   // sticker slot → linear cell index
 *   stickerDir: Uint8Array,    // sticker slot → face index
 *   stickerSlotOf: Int32Array, // (cell*6 + face) → sticker slot, or -1
 *   faceStart: Int32Array,     // face index → first sticker slot of that face
 * }}
 */
export function getShellIndex(size) {
  const hit = _cache.get(size);
  if (hit) return hit;

  const cells = size * size * size;
  const bodySlotOf = new Int32Array(cells).fill(-1);
  const stickerSlotOf = new Int32Array(cells * 6).fill(-1);

  // Bodies: every shell cell, in linear order.
  const bodyCellList = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (!isShellCell(x, y, z, size)) continue;
        const cell = x * size * size + y * size + z;
        bodySlotOf[cell] = bodyCellList.length;
        bodyCellList.push(cell);
      }
    }
  }

  // Stickers: face-major, so each face occupies one contiguous slot range.
  const stickerCellList = [];
  const stickerDirList = [];
  const faceStart = new Int32Array(6);
  for (let d = 0; d < 6; d++) {
    faceStart[d] = stickerCellList.length;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (!hasStickerOn(x, y, z, d, size)) continue;
          const cell = x * size * size + y * size + z;
          stickerSlotOf[cell * 6 + d] = stickerCellList.length;
          stickerCellList.push(cell);
          stickerDirList.push(d);
        }
      }
    }
  }

  const index = {
    size,
    bodyCount: bodyCellList.length,
    stickerCount: stickerCellList.length,
    bodyCell: Int32Array.from(bodyCellList),
    bodySlotOf,
    stickerCell: Int32Array.from(stickerCellList),
    stickerDir: Uint8Array.from(stickerDirList),
    stickerSlotOf,
    faceStart,
  };
  _cache.set(size, index);
  return index;
}

/** Drop cached indices. Tests only. */
export function resetShellIndexCache() {
  _cache.clear();
}

/** Decompose a linear cell index back into grid coordinates, into `out`. */
export function cellToCoords(cell, size, out) {
  out[2] = cell % size;
  out[1] = Math.floor(cell / size) % size;
  out[0] = Math.floor(cell / (size * size));
  return out;
}

/**
 * Convert a world-space hit on the cube's surface into a grid cell + face.
 *
 * This is the whole point of "keep hit testing mathematical": one raycast against
 * a single box, then arithmetic — instead of raycasting 1,350 sticker meshes.
 *
 * @param {number[]} point - world hit point [x,y,z] (cube centred on the origin)
 * @param {number[]} normal - world surface normal at the hit
 * @param {number} size
 * @param {number} expansion - explosion factor already applied to cell spacing
 * @returns {{x:number,y:number,z:number,dirKey:string}|null}
 */
export function pickCellFromHit(point, normal, size, expansion = 1) {
  // Largest normal component wins — the box's own faces are axis-aligned, so this
  // is exact rather than a tolerance.
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  let axis, dirIndex;
  if (ax >= ay && ax >= az) { axis = 0; dirIndex = normal[0] > 0 ? 0 : 1; }
  else if (ay >= az) { axis = 1; dirIndex = normal[1] > 0 ? 2 : 3; }
  else { axis = 2; dirIndex = normal[2] > 0 ? 4 : 5; }

  const k = (size - 1) / 2;
  const last = size - 1;
  const coords = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    // Cell centres sit at (index - k) * expansion, so invert that and round.
    const v = Math.round(point[i] / (expansion || 1) + k);
    coords[i] = Math.min(last, Math.max(0, v));
  }
  // The hit axis is pinned to the face it landed on: rounding the coordinate the
  // ray entered through can land one cell off when the hit is right on a seam.
  coords[axis] = (dirIndex % 2 === 0) ? last : 0;

  return { x: coords[0], y: coords[1], z: coords[2], dirKey: DIR_KEYS[dirIndex] };
}
