// src/game/cubeState.js
// Cube state initialization and utilities

// Create initial cube state with all stickers in solved position
export const makeCubies = (size) => {
  if (!Number.isInteger(size) || size < 2 || size > 7) {
    throw new RangeError(`makeCubies: size must be an integer 2–7, got ${size}`);
  }
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => {
        const stickers = {};
        if (x === size - 1) stickers.PX = { curr: 5, orig: 5, flips: 0, origPos: { x, y, z }, origDir: 'PX' };
        if (x === 0) stickers.NX = { curr: 2, orig: 2, flips: 0, origPos: { x, y, z }, origDir: 'NX' };
        if (y === size - 1) stickers.PY = { curr: 3, orig: 3, flips: 0, origPos: { x, y, z }, origDir: 'PY' };
        if (y === 0) stickers.NY = { curr: 6, orig: 6, flips: 0, origPos: { x, y, z }, origDir: 'NY' };
        if (z === size - 1) stickers.PZ = { curr: 1, orig: 1, flips: 0, origPos: { x, y, z }, origDir: 'PZ' };
        if (z === 0) stickers.NZ = { curr: 4, orig: 4, flips: 0, origPos: { x, y, z }, origDir: 'NZ' };
        return { x, y, z, stickers };
      })
    )
  );
};

// Heal a sticker (reset flips and restore original color).
// Uses a targeted shallow clone — only the affected cubie is recreated,
// matching the same pattern used by flipStickerPair for consistency.
export const healSticker = (cubies, _size, x, y, z, dirKey) => {
  const next = cubies.map(L => L.map(R => R.slice()));
  const c = next[x]?.[y]?.[z];
  if (!c) return next;
  const st = c.stickers[dirKey];
  if (!st) return next;

  next[x][y][z] = {
    ...c,
    stickers: { ...c.stickers, [dirKey]: { ...st, flips: 0, curr: st.orig } },
  };
  return next;
};

// Deep clone a cubie object
const cloneCubie = (cubie) => ({
  ...cubie,
  stickers: Object.fromEntries(
    Object.entries(cubie.stickers).map(([k, st]) => [
      k,
      { ...st, origPos: { ...st.origPos } }
    ])
  )
});

// Deep clone 3D cube array (properly clones cubie objects).
// WARNING: O(size³) full clone — only use for tests, resets, or initial state setup.
// For rotation/flip operations use the targeted shallow-clone pattern in
// cubeRotation.js and manifoldLogic.js to avoid unnecessary re-renders.
export const clone3D = (arr) =>
  arr.map(L => L.map(R => R.map(cubie => cloneCubie(cubie))));

// Safe sticker accessor — returns the sticker object or undefined
export const getStickerSafe = (cubies, x, y, z, dir) => cubies[x]?.[y]?.[z]?.stickers?.[dir];
