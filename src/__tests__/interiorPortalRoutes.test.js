import { afterEach, expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getWormTunnelSnapshot, resetWormTunnelSnapshots } from '../worm/tunnelSnapshot.js';
import { resetManifoldMap } from '../game/manifoldMapStore.js';
import { interiorPortalRoutes } from '../worm/healerWorm/interiorPortalRoutes.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

afterEach(() => { resetWormTunnelSnapshots(); resetManifoldMap(); });

it('shares topology, deduplicates reversed occupied routes, refreshes geometry, and excludes exhausted pairs', () => {
  let cubies = makeCubies(3);
  cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
  const tunnel = getWormTunnelSnapshot(cubies, 3, 0).tunnels[0].tunnel;
  const active = { ...tunnel, padHeight: .45, padExpansion: .2 };
  const passages = [{ tunnel: { ...tunnel, entry: tunnel.exit, exit: tunnel.entry } }];
  const cache = {};
  const first = interiorPortalRoutes(cache, cubies, 3, 0, 4, 0, active, passages);
  expect(first).toEqual([active]);
  expect(interiorPortalRoutes(cache, cubies, 3, 0, 4, 0, active, passages)).toBe(first);
  active.padHeight = .3;
  expect(interiorPortalRoutes(cache, cubies, 3, 0, 4, 0, active, passages)).not.toBe(first);
  // Cap changes can exhaust the pair without changing the cube identity.
  expect(interiorPortalRoutes(cache, cubies, 3, 0, 1, 0, null, [])).toHaveLength(0);
  expect(interiorPortalRoutes(cache, cubies, 3, 0, 1, 0, active, passages)).toHaveLength(1);
  const live = interiorPortalRoutes(cache, cubies, 3, 0, 4, .6, null, []);
  expect(live[0].padExpansion).toBe(.6);
  cubies = rotateSliceCubies(cubies, 3, 'row', 1, 1);
  const rotated = interiorPortalRoutes(cache, cubies, 3, 1, 4, .6, null, []);
  expect(rotated).not.toBe(live);
  expect(rotated.map(t => [t.entry, t.exit])).toEqual(getWormTunnelSnapshot(cubies, 3, 1).tunnels.map(({ tunnel: t }) => [t.entry, t.exit]));
});
