// The Mega renderer addresses every cubie and sticker through a precomputed slot
// mapping. A single off-by-one there paints the wrong tile the wrong colour —
// which, in Worm mode, means a wormhole that isn't where it looks like it is.
// These tests pin the mapping and the picking arithmetic.
import { describe, it, expect } from 'vitest';
import {
  getShellIndex,
  resetShellIndexCache,
  isShellCell,
  hasStickerOn,
  cellToCoords,
  pickCellFromHit,
  DIR_KEYS,
  DIR_INDEX,
  DIR_NORMALS,
} from '../3d/megaShell.js';
import { MEGA_SIZE } from '../game/sliceIndex.js';
import { makeCubies, isSurfaceSticker } from '../game/cubeState.js';

const SIZES = [2, 3, 5, 7, MEGA_SIZE];

describe('shell membership', () => {
  it('counts shell cells as size³ minus the interior', () => {
    for (const size of SIZES) {
      const inner = Math.max(0, size - 2);
      const { bodyCount } = getShellIndex(size);
      expect(bodyCount, `size ${size}`).toBe(size ** 3 - inner ** 3);
    }
    // The number that motivated the whole renderer.
    expect(getShellIndex(MEGA_SIZE).bodyCount).toBe(1178);
  });

  it('counts stickers as 6·size²', () => {
    for (const size of SIZES) {
      expect(getShellIndex(size).stickerCount, `size ${size}`).toBe(6 * size * size);
    }
    expect(getShellIndex(MEGA_SIZE).stickerCount).toBe(1350);
  });

  it('agrees with the game-logic surface test on every cell and face', () => {
    // megaShell must not develop its own opinion about what is on the surface —
    // cubeState.isSurfaceSticker is the definition the rules use.
    for (const size of [3, 5, MEGA_SIZE]) {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            for (let d = 0; d < 6; d++) {
              expect(
                hasStickerOn(x, y, z, d, size),
                `${size}: ${x},${y},${z} ${DIR_KEYS[d]}`
              ).toBe(isSurfaceSticker(x, y, z, DIR_KEYS[d], size));
            }
            // A cell is on the shell exactly when it carries at least one sticker.
            const anySticker = [0, 1, 2, 3, 4, 5].some(d => hasStickerOn(x, y, z, d, size));
            expect(isShellCell(x, y, z, size)).toBe(anySticker);
          }
        }
      }
    }
  });
});

describe('slot mapping', () => {
  it('round-trips slot → cell → slot for every body and sticker', () => {
    for (const size of SIZES) {
      const ix = getShellIndex(size);
      for (let slot = 0; slot < ix.bodyCount; slot++) {
        expect(ix.bodySlotOf[ix.bodyCell[slot]]).toBe(slot);
      }
      for (let slot = 0; slot < ix.stickerCount; slot++) {
        const cell = ix.stickerCell[slot];
        const d = ix.stickerDir[slot];
        expect(ix.stickerSlotOf[cell * 6 + d]).toBe(slot);
      }
    }
  });

  it('marks interior cells as having no body slot', () => {
    const size = 5;
    const ix = getShellIndex(size);
    const cell = 2 * size * size + 2 * size + 2; // the dead centre
    expect(ix.bodySlotOf[cell]).toBe(-1);
    for (let d = 0; d < 6; d++) expect(ix.stickerSlotOf[cell * 6 + d]).toBe(-1);
  });

  it('keeps each face contiguous, so a face is one upload run', () => {
    const size = 5;
    const ix = getShellIndex(size);
    for (let d = 0; d < 6; d++) {
      const start = ix.faceStart[d];
      for (let i = 0; i < size * size; i++) {
        expect(ix.stickerDir[start + i], `face ${DIR_KEYS[d]} slot ${i}`).toBe(d);
      }
    }
  });

  it('uses the x·size² + y·size + z order the rest of the codebase indexes by', () => {
    // liveCubies, positionCache and WormholeNetwork all address cubies this way;
    // a different order here would hand the worm the wrong tile transform.
    const size = 5;
    const out = [0, 0, 0];
    for (const [x, y, z] of [[0, 0, 0], [4, 0, 0], [0, 4, 0], [0, 0, 4], [4, 4, 4], [1, 2, 3]]) {
      const cell = x * size * size + y * size + z;
      cellToCoords(cell, size, out);
      expect(out).toEqual([x, y, z]);
    }
  });

  it('caches per size', () => {
    resetShellIndexCache();
    const a = getShellIndex(7);
    expect(getShellIndex(7)).toBe(a);
    resetShellIndexCache();
    expect(getShellIndex(7)).not.toBe(a);
  });

  it('addresses a real solved cube — every sticker has exactly one slot', () => {
    const size = MEGA_SIZE;
    const ix = getShellIndex(size);
    const cubies = makeCubies(size, { allowMega: true });
    const out = [0, 0, 0];
    let seen = 0;
    for (let slot = 0; slot < ix.stickerCount; slot++) {
      cellToCoords(ix.stickerCell[slot], size, out);
      const st = cubies[out[0]][out[1]][out[2]].stickers[DIR_KEYS[ix.stickerDir[slot]]];
      expect(st, `slot ${slot} -> ${out} ${DIR_KEYS[ix.stickerDir[slot]]}`).toBeDefined();
      seen++;
    }
    expect(seen).toBe(6 * size * size);
  });
});

describe('pickCellFromHit', () => {
  const size = MEGA_SIZE;
  const k = (size - 1) / 2;

  // Where the renderer actually puts a given tile's outer surface.
  const surfacePoint = (x, y, z, d) => {
    const n = DIR_NORMALS[d];
    return [(x - k) + n[0] * 0.52, (y - k) + n[1] * 0.52, (z - k) + n[2] * 0.52];
  };

  it('recovers the tile under a hit at every face centre', () => {
    for (let d = 0; d < 6; d++) {
      const last = size - 1;
      const cx = d === 0 ? last : d === 1 ? 0 : 7;
      const cy = d === 2 ? last : d === 3 ? 0 : 7;
      const cz = d === 4 ? last : d === 5 ? 0 : 7;
      const hit = pickCellFromHit(surfacePoint(cx, cy, cz, d), DIR_NORMALS[d], size, 1);
      expect(hit, DIR_KEYS[d]).toEqual({ x: cx, y: cy, z: cz, dirKey: DIR_KEYS[d] });
    }
  });

  it('recovers corner and edge tiles, not just face centres', () => {
    const last = size - 1;
    const cases = [
      [0, 0, last, DIR_INDEX.PZ],
      [last, last, last, DIR_INDEX.PZ],
      [0, last, 0, DIR_INDEX.NZ],
      [last, 0, 7, DIR_INDEX.PX],
      [0, 7, last, DIR_INDEX.NX],
    ];
    for (const [x, y, z, d] of cases) {
      const hit = pickCellFromHit(surfacePoint(x, y, z, d), DIR_NORMALS[d], size, 1);
      expect(hit, `${x},${y},${z} ${DIR_KEYS[d]}`).toEqual({ x, y, z, dirKey: DIR_KEYS[d] });
    }
  });

  it('resolves every tile of a face, so no tile is unclickable', () => {
    const last = size - 1;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const hit = pickCellFromHit(surfacePoint(x, y, last, DIR_INDEX.PZ), DIR_NORMALS[DIR_INDEX.PZ], size, 1);
        expect(hit).toEqual({ x, y, z: last, dirKey: 'PZ' });
      }
    }
  });

  it('pins the hit axis to the face, so a seam hit cannot land one cell deep', () => {
    // A ray grazing the PZ face right at the boundary rounds z to 14 anyway.
    const hit = pickCellFromHit([0, 0, 7.0], [0, 0, 1], size, 1);
    expect(hit.z).toBe(size - 1);
    expect(hit.dirKey).toBe('PZ');
  });

  it('clamps a hit that lands slightly outside the lattice', () => {
    const hit = pickCellFromHit([99, -99, 7.5], [0, 0, 1], size, 1);
    expect(hit.x).toBe(size - 1);
    expect(hit.y).toBe(0);
    expect(hit.z).toBe(size - 1);
  });

  it('accounts for the explosion factor', () => {
    const exp = 1.5;
    const x = 3, y = 11, z = size - 1;
    const p = [(x - k) * exp, (y - k) * exp, (z - k) * exp + 0.52];
    expect(pickCellFromHit(p, [0, 0, 1], size, exp)).toEqual({ x, y, z, dirKey: 'PZ' });
  });
});
