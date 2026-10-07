import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import WormholeNetwork from '../manifold/WormholeNetwork.jsx';
import { TunnelInteriorView } from '../worm/healerWorm/TunnelInteriorView.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { resetWormTunnelSnapshots } from '../worm/tunnelSnapshot.js';
import { resetManifoldMap } from '../game/manifoldMapStore.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { ANTIPODAL_COLOR, FACE_COLORS } from '../utils/constants.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it('shows every live connection and both interior mouths through traversal, then removes healed pairs', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  const size = 6;
  let cubies = makeCubies(size);
  const cells = [
    [0, 1, 1, 'NX'], [2, 5, 3, 'PY'], [4, 2, 5, 'PZ'], [5, 3, 1, 'PX'],
  ];
  for (const cell of cells) cubies = flipStickerPair(cubies, size, ...cell, buildManifoldGridMap(cubies, size));
  const routes = getActiveTunnels(cubies, size);
  expect(routes).toHaveLength(4);
  const current = { ...routes[0], padHeight: WORM_PAD_HEIGHT, padExpansion: 0 };
  const worm = { phase: { current: 'windup' }, activeTunnel: { current }, tunnelPassages: { current: [] } };
  Object.assign(tunnelState, { active: true, activeTunnelId: current.pairId, occupiedTunnelIds: new Set(), coreZoom: 1 });
  useGameStore.setState({ cubies, size, rotationEpoch: 0, wormHealerMode: true, wormAlive: true,
    wormPaused: false, wormPhase: 'windup', showTunnels: false, tunnelDetail: 'hints',
    chaosLevel: 0, showCutawayLens: false, settings: { ...before.settings, colorScheme: 'standard',
      manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 'carbonFiber'])), biomeMode: { enabled: false }, reducedMotion: false } });
  const refs = cubies.flat(2).map(c => {
    const group = new THREE.Group();
    group.position.set(c.x, c.y, c.z).addScalar(-(size - 1) / 2);
    return group;
  });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 1] } });
  let store, time = 0;
  const render = async () => act(async () => {
    store = root.render(<>
      <WormholeNetwork manifoldMap={buildManifoldGridMap(cubies, size)} cubieRefs={refs} />
      <TunnelInteriorView worm={worm} size={size} />
    </>);
  });
  const frame = async () => act(async () => store.getState().advance(time += 1 / 60));
  const visibleInScene = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
  const connections = () => {
    const found = [];
    store.getState().scene.traverse(o => { if (o.name === 'tunnel-styled-half-0' && visibleInScene(o)) found.push(o); });
    return found;
  };
  const mouths = () => store.getState().scene.getObjectByName('tunnel-interior').children
    .filter(o => o.name.startsWith('tunnel-interior-mouth-') && visibleInScene(o));
  try {
    await render();
    for (const phase of ['windup', 'entering', 'tunnel', 'exiting', 'windout']) {
      worm.phase.current = phase;
      await act(async () => useGameStore.setState({ wormPhase: phase }));
      await frame();
      expect(connections()).toHaveLength(4);
      expect(mouths()).toHaveLength(8);
      const wall = store.getState().scene.getObjectByName('tunnel-interior-0-1-1-NX');
      expect(wall.material.uniforms.uInteriorCount.value).toBe(8);
      for (const connection of connections()) expect(connection.material.uniforms.uCameraClearance.value).toBe(1);
    }
    const mouth = mouths()[0], entry = current.entry;
    const sticker = cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey];
    expect(mouth.material.uniforms.uColor.value.getHexString()).toBe(FACE_COLORS[ANTIPODAL_COLOR[sticker.curr]].slice(1).toLowerCase());
    const other = routes[1].entry;
    cubies = flipStickerPair(cubies, size, other.x, other.y, other.z, other.dirKey, buildManifoldGridMap(cubies, size));
    await act(async () => useGameStore.setState({ cubies }));
    await render(); await frame();
    expect(connections()).toHaveLength(3);
    expect(mouths()).toHaveLength(6);
    // Keep the ridden passage open after its pair heals until the traversal ends.
    cubies = flipStickerPair(cubies, size, entry.x, entry.y, entry.z, entry.dirKey, buildManifoldGridMap(cubies, size));
    await act(async () => useGameStore.setState({ cubies }));
    await render(); await frame();
    expect(mouths()).toHaveLength(6);
    worm.phase.current = 'crawling'; worm.activeTunnel.current = null;
    tunnelState.active = false; tunnelState.activeTunnelId = null;
    await act(async () => useGameStore.setState({ wormPhase: 'crawling' }));
    await frame();
    expect(mouths()).toHaveLength(0);
    expect(connections()).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(tunnelState, bridge);
    resetWormTunnelSnapshots(); resetManifoldMap();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
