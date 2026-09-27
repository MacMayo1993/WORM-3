import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  TUNNEL_MINI_FACE_R, TUNNEL_MOUTH_WIDTH, TUNNEL_FLARE, tunnelCoreScale, tunnelDockInto, tunnelDockForCellInto,
  tunnelDockForMeshInto, tunnelDockWidth, tunnelMouthWidth, tunnelGaugeAt, tunnelArmFractionAt
} from '../utils/tunnelPath.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildTunnelCenterlineInto, makeTunnelCenterline } from '../worm/wormLogic.js';
import {
  CORE_DIRS, CORE_HALF, CORE_STICKER_OFFSET, CORE_STICKER, CORE_STICKER_LOCAL, CORE_ZOOM_MARGIN,
  coreLayout, coreCellIndex, coreCubieMatrixInto, corePartnerColorId,
  coreZoomLimit, coreZoomAt, coreZoomReach,
  networkCharge, countFlippedStickers, interiorExposure
} from '../3d/antipodalCore.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SIZES = [2, 3, 4, 5, 7];
const dockOf = (cell, size) => tunnelDockForCellInto(new THREE.Vector3(), cell.x, cell.y, cell.z, cell.dirKey, size);
const stickerCentre = (cell, size) => {
  const k = (size - 1) / 2;
  return V(cell.x - k, cell.y - k, cell.z - k).addScaledVector(V(...CORE_DIRS[cell.dirKey]), CORE_STICKER_OFFSET);
};
const colourUnder = (cubies, size, cell) =>
  corePartnerColorId(cubies, buildManifoldGridMap(cubies, size), size, cell, findAntipodalStickerByGrid);

describe('the antipodal core layout', () => {
  it('draws every surface cubie and every sticker of the play cube', () => {
    for (const size of SIZES) {
      const { cells, stickers } = coreLayout(size);
      expect(cells).toHaveLength(size ** 3 - Math.max(0, size - 2) ** 3);
      expect(stickers).toHaveLength(6 * size * size);
      for (const s of stickers) expect(cells[s.cell].idx).toBe(coreCellIndex(s.x, s.y, s.z, size));
    }
  });

  it('is the play cube shrunk to the core, each sticker sitting on its tile\'s dock', () => {
    const cubie = new THREE.Matrix4(), sticker = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const size of SIZES) {
      const s = tunnelCoreScale(size);
      expect(s * size).toBeCloseTo(2 * TUNNEL_MINI_FACE_R, 12);
      for (const cell of coreLayout(size).stickers) {
        coreCubieMatrixInto(cubie, cell.x, cell.y, cell.z, size);
        p.setFromMatrixPosition(sticker.multiplyMatrices(cubie, CORE_STICKER_LOCAL[cell.dirKey]));
        expect(p.distanceTo(dockOf(cell, size))).toBeLessThan(1e-12);
      }
    }
  });
});

describe('tunnel docks on the core', () => {
  it('puts each dock on the core surface, on the ray from the centre through its tile', () => {
    for (const size of SIZES) {
      for (const cell of coreLayout(size).stickers) {
        const dock = dockOf(cell, size);
        expect(Math.max(...dock.toArray().map(Math.abs))).toBeCloseTo(CORE_HALF + (CORE_STICKER_OFFSET - 0.5) * tunnelCoreScale(size), 12);
        expect(dock.clone().normalize().distanceTo(stickerCentre(cell, size).normalize())).toBeLessThan(1e-12);
      }
    }
  });

  it('seats face-centre docks on the sticker front of an odd cube', () => {
    for (const size of [3, 5, 7]) {
      const c = (size - 1) / 2;
      expect(dockOf({ x: c, y: size - 1, z: c, dirKey: 'PY' }, size).toArray()).toEqual([0, (c + CORE_STICKER_OFFSET) * tunnelCoreScale(size), 0]);
    }
  });

  it('turns with a slice: a rotated cell docks where the core draws its rotated sticker', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.7);
    const cubie = new THREE.Matrix4(), sticker = new THREE.Matrix4(), p = new THREE.Vector3();
    const dock = tunnelDockForCellInto(new THREE.Vector3(), 2, 2, 0, 'NZ', 3, q);
    coreCubieMatrixInto(cubie, 2, 2, 0, 3, q);
    p.setFromMatrixPosition(sticker.multiplyMatrices(cubie, CORE_STICKER_LOCAL.NZ));
    expect(p.distanceTo(dock)).toBeLessThan(1e-12);
    expect(dock.distanceTo(dockOf({ x: 2, y: 2, z: 0, dirKey: 'NZ' }, 3).applyQuaternion(q))).toBeLessThan(1e-12);
  });

  it('reads a mesh index the way CubeAssembly lays cubies out', () => {
    const mesh = new THREE.Object3D();
    const a = tunnelDockForMeshInto(new THREE.Vector3(), coreCellIndex(3, 0, 1, 4), 'PX', 4, mesh);
    expect(a.toArray()).toEqual(dockOf({ x: 3, y: 0, z: 1, dirKey: 'PX' }, 4).toArray());
    expect(tunnelDockInto(new THREE.Vector3(), V(1, 1, 1), V(0, 0, 1), 3).toArray()).toEqual([1 / 6, 1 / 6, (1 + CORE_STICKER_OFFSET) / 6]);
  });

  it('joins antipodal docks through the centre on every solved-cube tunnel', () => {
    for (const size of [3, 4]) {
      const cubies = makeCubies(size);
      const map = buildManifoldGridMap(cubies, size);
      for (const cell of coreLayout(size).stickers) {
        const loc = findAntipodalStickerByGrid(map, cubies[cell.x][cell.y][cell.z].stickers[cell.dirKey], size);
        const path = buildTunnelCenterlineInto(makeTunnelCenterline(), { entry: cell, exit: loc }, size);
        expect(path.midA.distanceTo(dockOf(cell, size))).toBeLessThan(1e-12);
        expect(path.midB.clone().add(path.midA).length()).toBeLessThan(1e-12); // docks are antipodes
        expect(path.core.length()).toBe(0);
      }
    }
  });
});

describe('tunnel gauge', () => {
  it('plugs every tunnel into its core tile at exactly that tile\'s width', () => {
    for (const size of [2, 3, 4, 5, 7, 15]) {
      expect(tunnelDockWidth(size)).toBeCloseTo(CORE_STICKER * tunnelCoreScale(size), 12);
      expect(tunnelGaugeAt(0, tunnelMouthWidth(size), tunnelDockWidth(size))).toBeCloseTo(tunnelDockWidth(size), 12);
    }
  });

  it('flares only gently toward its own tile, and never past half the old band', () => {
    for (const size of [2, 3, 4, 5, 7, 15]) {
      const mouth = tunnelMouthWidth(size), dock = tunnelDockWidth(size);
      expect(mouth).toBeGreaterThanOrEqual(dock);
      expect(mouth).toBeLessThanOrEqual(TUNNEL_FLARE * dock + 1e-12);
      expect(mouth).toBeLessThanOrEqual(TUNNEL_MOUTH_WIDTH);
      let prev = -1;
      for (let a = 0; a <= 1.0001; a += 0.1) {
        const w = tunnelGaugeAt(a, mouth, dock);
        expect(w).toBeGreaterThanOrEqual(prev);
        prev = w;
      }
      expect(tunnelGaugeAt(1, mouth, dock)).toBeCloseTo(mouth, 12);
    }
    expect(TUNNEL_MOUTH_WIDTH).toBeLessThanOrEqual(0.72 / 2);
  });

  it('measures each arm from its dock (0) to its mouth (1), and holds 0 through the crossing', () => {
    const path = buildTunnelCenterlineInto(makeTunnelCenterline(),
      { entry: { x: 2, y: 2, z: 2, dirKey: 'PZ' }, exit: { x: 0, y: 0, z: 0, dirKey: 'NZ' } }, 3);
    expect(tunnelArmFractionAt(path, 0)).toBe(1);
    expect(tunnelArmFractionAt(path, path.armALen)).toBeCloseTo(0, 12);
    expect(tunnelArmFractionAt(path, path.legArc0[3])).toBe(0);
    expect(tunnelArmFractionAt(path, path.total - path.armBLen)).toBeCloseTo(0, 12);
    expect(tunnelArmFractionAt(path, path.total)).toBeCloseTo(1, 12);
  });
});

describe('what the core shows', () => {
  it('shows each tile\'s partner, which on a solved cube is the antipodal colour', () => {
    const cubies = makeCubies(3);
    for (const cell of coreLayout(3).stickers) {
      expect(colourUnder(cubies, 3, cell)).toBe(ANTIPODAL_COLOR[cubies[cell.x][cell.y][cell.z].stickers[cell.dirKey].curr]);
    }
  });

  it('follows a flip on both ends of the pair', () => {
    let cubies = makeCubies(3);
    cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
    const a = { x: 0, y: 1, z: 1, dirKey: 'NX' }, b = { x: 2, y: 1, z: 1, dirKey: 'PX' };
    expect(colourUnder(cubies, 3, a)).toBe(cubies[2][1][1].stickers.PX.curr);
    expect(colourUnder(cubies, 3, b)).toBe(cubies[0][1][1].stickers.NX.curr);
  });

  it('keeps showing partners after a turn, where partners stop being point reflections', () => {
    const size = 3;
    const cubies = rotateSliceCubies(makeCubies(size), size, 'row', 2, 1);
    const map = buildManifoldGridMap(cubies, size);
    const opposite = { PX: 'NX', NX: 'PX', PY: 'NY', NY: 'PY', PZ: 'NZ', NZ: 'PZ' };
    let displaced = 0;
    for (const cell of coreLayout(size).stickers) {
      const loc = findAntipodalStickerByGrid(map, cubies[cell.x][cell.y][cell.z].stickers[cell.dirKey], size);
      expect(colourUnder(cubies, size, cell)).toBe(cubies[loc.x][loc.y][loc.z].stickers[loc.dirKey].curr);
      const reflected = loc.x === size - 1 - cell.x && loc.y === size - 1 - cell.y && loc.z === size - 1 - cell.z &&
        loc.dirKey === opposite[cell.dirKey];
      if (!reflected) displaced++;
    }
    // One turned layer moves 12 tiles away from their (unturned) partners' reflections.
    expect(displaced).toBeGreaterThan(0);
  });
});

describe('the approach zoom', () => {
  it('never grows the core past the outer cube\'s hollow, anchored on any dock', () => {
    for (const size of SIZES) {
      const h = size / 2 - CORE_ZOOM_MARGIN;
      for (const cell of coreLayout(size).stickers) {
        const dock = dockOf(cell, size);
        const g = coreZoomLimit(dock, size);
        expect(g).toBeGreaterThanOrEqual(1);
        for (const corner of [-1, 1]) {
          for (let axis = 0; axis < 3; axis++) {
            const edge = dock.getComponent(axis) + g * (corner * CORE_HALF - dock.getComponent(axis));
            expect(Math.abs(edge)).toBeLessThanOrEqual(h + 1e-9);
          }
        }
      }
    }
    expect(coreZoomLimit(V(0, 0, CORE_HALF), 3)).toBeGreaterThan(3); // a real swell on a 3×3
  });

  it('grows as the lens closes on the entry face and lets go on the way out', () => {
    const limit = 3, size = 3;
    expect(coreZoomAt(coreZoomReach(size) + 1, limit, size)).toBe(1);
    let prev = 1;
    for (let h = coreZoomReach(size); h >= 0; h -= 0.05) {
      const g = coreZoomAt(h, limit, size);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    expect(coreZoomAt(0, limit, size)).toBe(limit);
    expect(coreZoomAt(-0.4, limit, size)).toBe(limit);
    expect(coreZoomAt(0, limit, size, 1)).toBe(1);
    expect(coreZoomAt(0, limit, size, 0.5)).toBeCloseTo(2, 12);
  });
});

describe('network state', () => {
  it('charges up with the live network without ever saturating', () => {
    expect(networkCharge(0)).toBe(0);
    expect(networkCharge(-3)).toBe(0);
    expect(networkCharge(20)).toBeGreaterThan(networkCharge(2));
    expect(networkCharge(1000)).toBeLessThanOrEqual(1);
  });

  it('counts flipped stickers across a pair flip', () => {
    let cubies = makeCubies(3);
    expect(countFlippedStickers(cubies)).toBe(0);
    cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
    expect(countFlippedStickers(cubies)).toBe(2);
  });

  it('lights the surroundings only once the inside can be seen', () => {
    expect(interiorExposure({})).toBe(0);
    expect(interiorExposure({ explosionT: 0.4 })).toBe(0.4);
    expect(interiorExposure({ visualMode: 'glass' })).toBe(1);
    expect(interiorExposure({ hollowMode: true })).toBe(1);
    expect(interiorExposure({ visualMode: 'gap' })).toBe(0.6);
  });
});
