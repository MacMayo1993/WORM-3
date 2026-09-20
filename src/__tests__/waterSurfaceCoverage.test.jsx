import { it, expect, vi } from 'vitest';
import * as THREE from 'three';

const rig = vi.hoisted(() => ({ frame: null, state: { wormElementalTheme: 'water', wormPaused: false } }));
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useRef: value => ({ current: value }) }));
vi.mock('@react-three/fiber', () => ({ useFrame: fn => { rig.frame = fn; } }));
vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: Object.assign(fn => fn(rig.state), { getState: () => rig.state }) }));
vi.mock('../worm/ElementalFireSkin.jsx', () => ({ default: () => null }));
vi.mock('../worm/ElementalGrassSkin.jsx', () => ({ default: () => null }));
vi.mock('../worm/wormHelpers.js', () => ({ readLiveTile: vi.fn(() => false) }));
import ElementalCubeSkin from '../worm/ElementalCubeSkin.jsx';
import { getElementalSurfaceGeo, getElementalSurfaceMaterial, WATER_HEIGHT } from '../worm/ElementalSurface.jsx';
import { wormBuffs, resetWormBuffs } from '../worm/wormBuffs.js';
import { readLiveTile } from '../worm/wormHelpers.js';

it.each([3, 5, 15])('keeps water coverage continuous through claim and expiry on a %s cube', size => {
  resetWormBuffs(); readLiveTile.mockReturnValue(false);
  wormBuffs.elementalT = 10;
  wormBuffs.elementalOrigin = { x: 0, y: 0, z: size - 1, dirKey: 'PZ' };
  const surface = ElementalCubeSkin({ size });
  const { count, meshRef } = surface.props;
  const material = getElementalSurfaceMaterial('water', '#00aaff', '#88eeff');
  const mesh = new THREE.InstancedMesh(getElementalSurfaceGeo(), material, count);
  meshRef.current = mesh;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const widths = [];
  // Record settled coverage, then compare it with both ends of the animation.
  for (let i = 0; i < 30; i++) rig.frame({}, 0.1);
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
    widths.push([scale.x, scale.y]);
  }
  // A fresh origin restarts the claim clock, including replacement by water.
  wormBuffs.elementalOrigin = { ...wormBuffs.elementalOrigin };
  for (const remaining of [10, 0.8, 0.1, 0]) {
    wormBuffs.elementalT = remaining;
    rig.frame({}, 0.1);
    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
      expect(scale.x).toBeCloseTo(widths[i][0]);
      expect(scale.y).toBeCloseTo(widths[i][1]);
      expect(scale.z).toBeGreaterThan(0);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
    }
  }
  // Live slice transforms still carry the surface rather than leaving it behind.
  readLiveTile.mockImplementation((_tile, pos, normal) => {
    pos.set(4, 5, 6); normal.set(1, 0, 0); return true;
  });
  rig.frame({}, 0.1);
  mesh.getMatrixAt(0, matrix); matrix.decompose(position, rotation, scale);
  expect(position.toArray()).toEqual([4, 5, 6]);
  expect(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-6);
  mesh.dispose();
});

it('keeps even simultaneous water troughs above the tile surface', () => {
  expect(WATER_HEIGHT.base - 4 * WATER_HEIGHT.ripple - WATER_HEIGHT.swell).toBeGreaterThan(0);
  expect(WATER_HEIGHT.base + 4 * WATER_HEIGHT.ripple + WATER_HEIGHT.swell).toBeLessThan(0.25);
});
