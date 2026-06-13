import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('cubiesToKociembaString', () => {
  it('returns correct 54-char solved state', () => {
    const cubies = makeCubies(3);
    expect(cubiesToKociembaString(cubies)).toBe(SOLVED);
  });

  it('returns null for non-3x3 cube', () => {
    expect(cubiesToKociembaString(makeCubies(4))).toBeNull();
    expect(cubiesToKociembaString(null)).toBeNull();
  });

  it('produces valid face-count distribution (9 of each)', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1); // R move
    const str = cubiesToKociembaString(cubies);
    expect(str).toHaveLength(54);
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(str.split(face).length - 1).toBe(9);
    }
  });

  it('center stickers stay on correct faces after R move', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1); // R
    const str = cubiesToKociembaString(cubies);
    // Centers are at positions 4, 13, 22, 31, 40, 49 (0-indexed)
    expect(str[4]).toBe('U');   // U center = white
    expect(str[13]).toBe('R');  // R center = blue
    expect(str[22]).toBe('F');  // F center = red
    expect(str[31]).toBe('D');  // D center = yellow
    expect(str[40]).toBe('L');  // L center = green
    expect(str[49]).toBe('B');  // B center = orange
  });

  it('U move changes correct stickers', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'row', 2, -1); // U move
    const str = cubiesToKociembaString(cubies);
    // U face should remain all U stickers
    expect(str.slice(0, 9)).toBe('UUUUUUUUU');
    // D face (positions 27-35) should remain all D stickers
    expect(str.slice(27, 36)).toBe('DDDDDDDDD');
  });

  // Verified against kociemba-wasm Cube class (c.action('R').toString())
  it('R move produces exact kociemba-wasm expected string', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1); // R move
    const str = cubiesToKociembaString(cubies);
    expect(str).toBe('UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB');
  });

  // Verify L move — right column of B face gets U stickers, etc.
  it('L move produces correct face count distribution', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 0, 1); // L move
    const str = cubiesToKociembaString(cubies);
    expect(str).toHaveLength(54);
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(str.split(face).length - 1).toBe(9);
    }
    // L and R face centers unchanged
    expect(str[13]).toBe('R');
    expect(str[40]).toBe('L');
  });

  // Verify F move
  it('F move produces correct face count distribution', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'depth', 2, -1); // F move
    const str = cubiesToKociembaString(cubies);
    expect(str).toHaveLength(54);
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(str.split(face).length - 1).toBe(9);
    }
    // F face center unchanged
    expect(str[22]).toBe('F');
  });
});
