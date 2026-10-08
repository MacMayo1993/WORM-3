import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Matrix4 } from 'three';
import { setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { getWormStickerWorldPos } from '../worm/wormExpansion.js';
import { wormRaisedAmount } from '../game/raisedCubie.js';
import { makeStorm, STORM } from '../worm/healerWorm/lightningStorm.js';
const { cleanups, frames } = vi.hoisted(() => ({ cleanups: [], frames: [] }));
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useEffect: fn => { cleanups.push(fn()); } }));
vi.mock('@react-three/fiber', async original => ({ ...await original(), useFrame: fn => frames.push(fn) }));
import { LightningStrikes } from '../worm/healerWorm/LightningStrikes.jsx';

let storm, worm, meshes, mouths;
const TILE = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
beforeEach(() => {
  resetLiveRotation(); frames.length = 0; cleanups.length = 0;
  storm = makeStorm();
  mouths = null;
  worm = { chargedMouths: () => mouths };
  const tree = LightningStrikes({ stormRef: { current: storm }, worm, size: 3 });
  meshes = tree.props.children.map(child => child.props.object);
});
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); resetLiveRotation(); });
const [RING, DIAMOND, DISC, COLUMN, CRACKLE] = [0, 1, 2, 3, 4];
const counts = () => meshes.map(m => m.count);

it('draws nothing while the sky is quiet', () => {
  frames[0]({ clock: { elapsedTime: 1 } });
  expect(counts()).toEqual([0, 0, 0, 0, 0]);
});

it('draws a ring, a diamond and a disc on every marked tile, closing in as the charge builds', () => {
  storm.spots.push({ id: 1, tile: TILE, age: 0, delay: STORM.telegraph });
  storm.spots.push({ id: 2, tile: { ...TILE, x: 0 }, age: 0, delay: STORM.telegraph });
  frames[0]({ clock: { elapsedTime: 1 } });
  expect(counts()).toEqual([2, 2, 2, 0, 0]);
  const early = new Matrix4(); meshes[RING].getMatrixAt(0, early);
  storm.spots[0].age = STORM.telegraph * 0.99;
  frames[0]({ clock: { elapsedTime: 1 } });
  const late = new Matrix4(); meshes[RING].getMatrixAt(0, late);
  // The ring starts wide and closes to the tile.
  expect(early.getMaxScaleOnAxis()).toBeGreaterThan(late.getMaxScaleOnAxis());
});

it('shows a landed strike as a disc and a column of light, then lets it go', () => {
  storm.flashes.push({ id: 1, tile: TILE, age: 0 });
  frames[0]({ clock: { elapsedTime: 1 } });
  expect(counts()).toEqual([0, 0, 1, 1, 0]);
  storm.flashes.length = 0; frames[0]({ clock: { elapsedTime: 1 } });
  expect(counts()).toEqual([0, 0, 0, 0, 0]);
});

it('rings both mouths of every charged tunnel, standing off the raised tile', () => {
  mouths = [{ tunnel: { entry: TILE, exit: { x: 1, y: 0, z: 0, dirKey: 'NZ' } } }];
  frames[0]({ clock: { elapsedTime: 1 } });
  expect(meshes[CRACKLE].count).toBe(2);
  const m = new Matrix4(); meshes[CRACKLE].getMatrixAt(0, m);
  // A mouth stands off its tile by the raised piece's pop and a hair more.
  expect(m.elements[14]).toBeCloseTo(getWormStickerWorldPos(1, 2, 2, 'PZ', 3, 0)[2] + wormRaisedAmount(3) + 0.12, 5);
});

it('a mark rides the layer it stands on while that layer turns', () => {
  storm.spots.push({ id: 1, tile: TILE, age: 0, delay: STORM.telegraph });
  frames[0]({ clock: { elapsedTime: 1 } });
  const rest = new Matrix4(); meshes[RING].getMatrixAt(0, rest);
  setLiveRotation('row', [2], [0.6], 1, 0.6);
  frames[0]({ clock: { elapsedTime: 1 } });
  const turned = new Matrix4(); meshes[RING].getMatrixAt(0, turned);
  expect(turned.equals(rest)).toBe(false);
});

it('caps what it draws at the storm size', () => {
  for (let i = 0; i < STORM.strikes + 4; i++) storm.spots.push({ id: i, tile: TILE, age: 0, delay: 1 });
  frames[0]({ clock: { elapsedTime: 1 } });
  expect(meshes[RING].count).toBe(STORM.strikes);
});

it('disposes every mesh, geometry and material on unmount', () => {
  const listeners = meshes.flatMap(mesh => [mesh.geometry, mesh.material]).map(resource => {
    const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener;
  });
  while (cleanups.length) cleanups.pop()?.();
  listeners.forEach(listener => expect(listener).toHaveBeenCalledTimes(1));
});
