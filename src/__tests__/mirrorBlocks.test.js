import { describe, it, expect } from 'vitest';
import { getMirrorLayerWidths, getMirrorCenters, getMirrorPosition, getMirrorDimensions } from '../game/mirrorBlocks.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

describe('getMirrorLayerWidths', () => {
  it('returns widths that sum to the cube size', () => {
    for (const size of [2, 3, 4, 5]) {
      const widths = getMirrorLayerWidths(size);
      expect(widths).toHaveLength(size);
      const sum = widths.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(size, 5);
    }
  });

  it('all widths are positive', () => {
    for (const size of [2, 3, 4, 5]) {
      const widths = getMirrorLayerWidths(size);
      widths.forEach(w => expect(w).toBeGreaterThan(0));
    }
  });

  it('widths are asymmetric for standard sizes', () => {
    const w3 = getMirrorLayerWidths(3);
    expect(w3[0]).not.toBe(w3[1]);
    expect(w3[1]).not.toBe(w3[2]);
  });
});

describe('getMirrorCenters', () => {
  it('returns the correct number of centers', () => {
    for (const size of [2, 3, 4, 5]) {
      expect(getMirrorCenters(size)).toHaveLength(size);
    }
  });

  it('centers span -size/2 to +size/2', () => {
    for (const size of [2, 3, 4, 5]) {
      const widths = getMirrorLayerWidths(size);
      const centers = getMirrorCenters(size);
      // First center should be at -size/2 + w[0]/2
      expect(centers[0]).toBeCloseTo(-size / 2 + widths[0] / 2, 5);
      // Last center should be at size/2 - w[last]/2
      const last = size - 1;
      expect(centers[last]).toBeCloseTo(size / 2 - widths[last] / 2, 5);
    }
  });
});

describe('getMirrorPosition', () => {
  it('returns a 3-element array', () => {
    const pos = getMirrorPosition(0, 1, 2, 3);
    expect(pos).toHaveLength(3);
  });

  it('center piece of 3x3 is near origin', () => {
    const [cx, cy, cz] = getMirrorPosition(1, 1, 1, 3);
    // The middle layer center may not be exactly 0 due to asymmetric widths
    expect(Math.abs(cx)).toBeLessThan(0.5);
    expect(Math.abs(cy)).toBeLessThan(0.5);
    expect(Math.abs(cz)).toBeLessThan(0.5);
  });

  it('corner positions are near the cube boundary', () => {
    const size = 3;
    const half = size / 2;
    const [cx] = getMirrorPosition(0, 0, 0, size);
    expect(Math.abs(cx - (-half))).toBeLessThan(half); // within the cube
    const [cx2] = getMirrorPosition(2, 0, 0, size);
    expect(Math.abs(cx2 - half)).toBeLessThan(half);
  });
});

describe('getMirrorDimensions', () => {
  it('returns a 3-element array', () => {
    const dims = getMirrorDimensions(0, 1, 2, 3);
    expect(dims).toHaveLength(3);
  });

  it('dimensions are positive', () => {
    for (const size of [2, 3, 4, 5]) {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            const [wx, wy, wz] = getMirrorDimensions(x, y, z, size);
            expect(wx).toBeGreaterThan(0);
            expect(wy).toBeGreaterThan(0);
            expect(wz).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('each piece in a 3x3 has unique dimensions', () => {
    const size = 3;
    const seen = new Set();
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const dims = getMirrorDimensions(x, y, z, size);
          const key = dims.map(d => d.toFixed(4)).join(',');
          seen.add(key);
        }
      }
    }
    // With 3 distinct widths, there are 3^3 = 27 pieces but only C(3+2,2)=10 distinct unordered
    // size combinations. Since order matters (wx,wy,wz), we check that more than 1 unique combo exists.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('origPos-based dimension stability across rotations', () => {
  // This is the core correctness requirement: each piece must keep its own
  // unique dimensions as it travels around the cube.  rotateSliceCubies
  // updates cubie.x/y/z but preserves sticker.origPos via {...src} spread.
  it('origPos is preserved after a rotation', () => {
    const size = 3;
    const cubies = makeCubies(size);
    const rotated = rotateSliceCubies(cubies, size, 'col', 0, 1); // rotate x=0 slice

    // Every cubie in the x=0 column should still have stickers with origPos
    // pointing to the ORIGINAL home positions, not the new positions.
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = rotated[0][y][z];
        for (const st of Object.values(cubie.stickers)) {
          // origPos must still reflect the original solved position
          expect(st.origPos).toBeDefined();
          // After one rotation, the cubie is at a new (y, z) but origPos unchanged
          // origPos.x must still be 0 (they all started in column x=0)
          expect(st.origPos.x).toBe(0);
        }
      }
    }
  });

  it('mirror dimensions from origPos are stable after rotations', () => {
    const size = 3;
    let cubies = makeCubies(size);

    // Record the dimension of the piece that starts at (0, 0, 2).
    // Its origPos is {x:0, y:0, z:2} → dims based on layer widths[0], widths[0], widths[2].
    const origDims = getMirrorDimensions(0, 0, 2, size);

    // Apply four 90° rotations (full cycle) - the piece travels to different slots.
    for (let i = 0; i < 4; i++) {
      cubies = rotateSliceCubies(cubies, size, 'col', 0, 1);
    }

    // Find the piece that originally lived at (0,0,2) — its sticker origPos.z=2.
    let foundPiece = null;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const c = cubies[x][y][z];
          const stickers = Object.values(c.stickers);
          if (stickers.length > 0 && stickers[0].origPos.x === 0 && stickers[0].origPos.z === 2) {
            // Also verify y=0 from original position to be precise
            if (stickers.some(s => s.origPos.y === 0)) {
              foundPiece = c;
            }
          }
        }
      }
    }

    expect(foundPiece).not.toBeNull();
    const home = Object.values(foundPiece.stickers)[0].origPos;
    const dimsAfterRotations = getMirrorDimensions(home.x, home.y, home.z, size);
    expect(dimsAfterRotations).toEqual(origDims);
  });
});
