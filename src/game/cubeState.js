// src/game/cubeState.js
// Cube state initialization and utilities

// Create initial cube state with all stickers in solved position
export const makeCubies = (size) =>
  Array.from({ length: size }, (_, x) =>
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

// Deep clone 3D cube array (properly clones cubie objects)
export const clone3D = (arr) =>
  arr.map(L => L.map(R => R.map(cubie => cloneCubie(cubie))));
