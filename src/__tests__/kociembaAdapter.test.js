import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { cubiesToKociembaString, isAdmissible } from '../game/kociembaAdapter.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// Simulate a wormhole flip: recolour a sticker to its antipode, mark flipped.
function flipSticker(cubies, x, y, z, dir) {
  const st = cubies[x][y][z].stickers[dir];
  st.curr = ANTIPODAL_COLOR[st.curr]; // toggle, matching the real wormhole flip
  st.flips = (st.flips ?? 0) + 1;
}

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

describe('cubiesToKociembaString — antipodal flip tolerance', () => {
  it('rejects a flipped cube by default (strict curr reading breaks 9-of-each)', () => {
    const cubies = makeCubies(3);
    flipSticker(cubies, 0, 0, 2, 'PZ'); // red → orange: now 10 B / 8 F
    expect(cubiesToKociembaString(cubies)).toBeNull();
  });

  it('reads a flipped-but-solved cube as SOLVED when ignoreFlips is set', () => {
    const cubies = makeCubies(3);
    flipSticker(cubies, 0, 0, 2, 'PZ'); // F sticker
    flipSticker(cubies, 2, 2, 2, 'PX'); // R sticker
    flipSticker(cubies, 1, 2, 1, 'PY'); // U sticker
    expect(cubiesToKociembaString(cubies, { ignoreFlips: true })).toBe(SOLVED);
  });

  it('flips are invisible to the position string (R-move + flips === plain R-move)', () => {
    const plain = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1); // R
    const flipped = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1); // R
    flipSticker(flipped, 2, 2, 2, 'PX');
    flipSticker(flipped, 0, 0, 0, 'NZ');
    flipSticker(flipped, 1, 0, 2, 'NY');
    expect(cubiesToKociembaString(flipped, { ignoreFlips: true }))
      .toBe(cubiesToKociembaString(plain));
  });

  it('an even number of flips on one sticker reads as its home colour', () => {
    const cubies = makeCubies(3);
    flipSticker(cubies, 0, 0, 2, 'PZ');
    flipSticker(cubies, 0, 0, 2, 'PZ'); // flipped back — curr === orig again
    expect(cubiesToKociembaString(cubies, { ignoreFlips: true })).toBe(SOLVED);
  });

  it('still rejects a genuine non-flip recolour even with ignoreFlips', () => {
    const cubies = makeCubies(3);
    cubies[0][0][2].stickers.PZ.curr = 5; // red(1) → blue(5): not red's antipode(4)
    expect(cubiesToKociembaString(cubies, { ignoreFlips: true })).toBeNull();
  });

  it('rejects a COUNT-BALANCED cross-mispaint that slips past the 9-of-each check', () => {
    // Two stickers swapped into each other's non-antipodal classes: face-letter
    // counts stay at nine each, but the state is not flip-reachable. The
    // admissibility gate must still reject it (the 9-of-each count would not).
    const cubies = makeCubies(3);
    cubies[0][0][2].stickers.PZ.curr = 2; // F-face tile (orig 1) painted green(2)
    cubies[0][0][0].stickers.NX.curr = 1; // L-face tile (orig 2) painted red(1)
    expect(isAdmissible(cubies)).toBe(false);
    expect(cubiesToKociembaString(cubies, { ignoreFlips: true })).toBeNull();
  });
});
