import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { getGridRC } from '../game/coordinates.js';
import { ANTIPODAL_FACE } from '../utils/constants.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';

describe('antipodal grid coordinate consistency', () => {
  it('maps every sticker and its geometric antipode to the same (row, col)', () => {
    const size = 3;
    const S = size - 1;
    const cubies = makeCubies(size);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const c = cubies[x][y][z];
          for (const [dirKey, st] of Object.entries(c.stickers)) {
            const ax = S - x;
            const ay = S - y;
            const az = S - z;
            const aDir = ANTIPODAL_FACE[dirKey];
            const antiSt = cubies[ax][ay][az].stickers[aDir];

            const rc = getGridRC(st.origPos, st.origDir, size);
            const arc = getGridRC(antiSt.origPos, antiSt.origDir, size);

            expect(arc).toEqual(rc);
          }
        }
      }
    }
  });

  it('findAntipodalStickerByGrid returns the geometric antipode on solved cubes', () => {
    const size = 4;
    const S = size - 1;
    const cubies = makeCubies(size);
    const manifoldMap = buildManifoldGridMap(cubies, size);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const c = cubies[x][y][z];
          for (const [dirKey, st] of Object.entries(c.stickers)) {
            const match = findAntipodalStickerByGrid(manifoldMap, st, size);
            expect(match).toBeTruthy();
            expect(match.x).toBe(S - x);
            expect(match.y).toBe(S - y);
            expect(match.z).toBe(S - z);
            expect(match.dirKey).toBe(ANTIPODAL_FACE[dirKey]);
          }
        }
      }
    }
  });
});
