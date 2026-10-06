// The rigid cube move remains reversible. Home alignment is a separate rule
// applied once after the complete move, with a small journal for exact undo.
import { rotateSliceCubies } from './cubeRotation.js';

const HOME_FACE = { 1: 'PZ', 2: 'NX', 3: 'PY', 4: 'NZ', 5: 'PX', 6: 'NY' };
export const isOnHomeManifold = (sticker, face) =>
  face === (sticker.origDir || HOME_FACE[sticker.orig]);

function writeSticker(cubies, next, x, y, z, face, sticker) {
  if (next[x] === cubies[x]) next[x] = cubies[x].slice();
  if (next[x][y] === cubies[x][y]) next[x][y] = cubies[x][y].slice();
  const cell = next[x][y][z];
  next[x][y][z] = { ...cell, stickers: { ...cell.stickers, [face]: sticker } };
}

export function alignHomeTiles(cubies, previous = null) {
  let next = cubies;
  const orientationResets = [];
  for (let x = 0; x < cubies.length; x++) for (let y = 0; y < cubies.length; y++) {
    for (let z = 0; z < cubies.length; z++) {
      const cell = cubies[x][y][z];
      if (previous?.[x]?.[y]?.[z] === cell) continue;
      for (const [face, sticker] of Object.entries(cell.stickers)) {
        const turns = sticker.uvTurns ?? 0;
        if (!turns || !isOnHomeManifold(sticker, face)) continue;
        orientationResets.push({ x, y, z, face, turns });
        const aligned = { ...sticker };
        delete aligned.uvTurns;
        if (next === cubies) next = cubies.slice();
        writeSticker(cubies, next, x, y, z, face, aligned);
      }
    }
  }
  return { cubies: next, orientationResets };
}

function restoreResets(cubies, resets = []) {
  if (!resets?.length) return cubies;
  const next = cubies.slice();
  for (const { x, y, z, face, turns } of resets) {
    const sticker = cubies[x]?.[y]?.[z]?.stickers[face];
    if (!sticker) continue;
    writeSticker(cubies, next, x, y, z, face, { ...sticker, uvTurns: turns });
  }
  return next;
}

export function applyTileMove(cubies, size, move) {
  const { axis, dir, sliceIndex, sliceIndices, sliceDirs, numTurns = 1, isUndo = false } = move;
  const layers = sliceIndices?.length ? sliceIndices : [sliceIndex];
  const dirs = sliceDirs?.length ? sliceDirs : layers.map(() => dir);
  // Undo's directions are already inverted by the caller. Restore what the
  // FORWARD move erased before rotating back; never run home alignment on undo.
  let next = isUndo ? restoreResets(cubies, move.orientationResets) : cubies;
  for (let li = 0; li < layers.length; li++) for (let i = 0; i < numTurns; i++) {
    next = rotateSliceCubies(next, size, axis, layers[li], dirs[li]);
  }
  return isUndo ? { cubies: next, orientationResets: [] } : alignHomeTiles(next, cubies);
}

// For setup builders that apply independent single-quarter-turn moves.
export function rotateAlignedSlice(cubies, size, axis, sliceIndex, dir) {
  return applyTileMove(cubies, size, { axis, sliceIndex, dir }).cubies;
}

export function inverseTileMove(move) {
  return { ...move, dir: -move.dir, sliceDirs: move.sliceDirs?.map(dir => -dir), isUndo: true };
}
