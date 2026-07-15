import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { getGridRC, getManifoldGridId } from '../game/coordinates.js';
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

  // Regression: the on-cube grid LABEL a player reads must name the same tile
  // the flip logic actually targets. A duplicate/drifted `faceRCFor` plus a
  // GRID_FACE swap hack in Cubie.jsx once made the label disagree with the
  // flip — tapping the tile shown as "M1-001" flipped "M4-007". Both the label
  // (getManifoldGridId) and the flip partner (findAntipodalStickerByGrid) now
  // route through the ONE canonical formula, so the index is preserved and the
  // face maps to its antipode: M1-001 -> M4-001, never M4-007.
  it('the tile labeled M1-001 flips to the tile labeled M4-001 (index-preserving)', () => {
    for (const size of [2, 3, 4, 5]) {
      const cubies = makeCubies(size);
      const manifoldMap = buildManifoldGridMap(cubies, size);

      // Antipodal face-id pairing: 1<->4, 2<->5, 3<->6.
      const ANTI_FACE_ID = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };
      const parse = (id) => {
        const [, f, idx] = id.match(/^M(\d+)-(\d+)$/);
        return { faceId: Number(f), idx: Number(idx) };
      };

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            const c = cubies[x][y][z];
            for (const st of Object.values(c.stickers)) {
              const label = getManifoldGridId(st, size);
              const match = findAntipodalStickerByGrid(manifoldMap, st, size);
              expect(match).toBeTruthy();
              const partnerLabel = getManifoldGridId(match.sticker, size);

              const a = parse(label);
              const b = parse(partnerLabel);
              // same index (top-left of one face flips top-left of the other)
              expect(b.idx).toBe(a.idx);
              // and the face is the antipodal face
              expect(b.faceId).toBe(ANTI_FACE_ID[a.faceId]);
            }
          }
        }
      }
    }
  });
});
