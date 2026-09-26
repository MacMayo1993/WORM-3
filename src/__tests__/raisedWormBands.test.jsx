import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import WormholeNetwork from '../manifold/WormholeNetwork.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { resolveColors } from '../utils/colorSchemes.js';

vi.mock('../manifold/MobiusTunnel.jsx', () => ({ default: props => <group name="mobius-band" userData={props} /> }));
vi.mock('../manifold/RestingCords.jsx', () => ({ default: () => null }));
vi.mock('../manifold/TunnelSnap.jsx', () => ({ default: () => null }));
extend(THREE);

it.each([true, false])('shows live raised bands with Off/Hints, drops healed pairs, and restores other-mode settings (WORM=%s)', async wormHealerMode => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), size = 7;
  let cubies = makeCubies(size);
  const manifoldMap = buildManifoldGridMap(cubies, size);
  for (let z = 1; z <= 5; z++) cubies = flipStickerPair(cubies, size, 0, 3, z, 'NX', manifoldMap);
  useGameStore.setState({ cubies, size, wormHealerMode, chaosLevel: 0, mirrorMode: false, demoMode: false, showTunnels: false,
    tunnelDetail: 'hints', tunnelBirths: {}, tunnelPulses: {}, tunnelDeaths: {},
    settings: { ...before.settings, flipPads: wormHealerMode ? 'off' : 'full' } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let store;
  const draw = async () => act(async () => { store = root.render(<WormholeNetwork manifoldMap={manifoldMap} cubieRefs={[]} />); });
  const bands = () => { const found = []; store.getState().scene.traverse(o => { if (o.name === 'mobius-band') found.push(o); }); return found; };
  try {
    await draw();
    expect(bands()).toHaveLength(5);
    const colors = resolveColors(useGameStore.getState().settings);
    for (const { userData: band } of bands()) {
      expect([band.color1, band.color2]).toEqual([colors[5], colors[2]]); // Outward blue to antipodal green after the flip.
      expect(band.color1).not.toBe(band.color2);
      for (const side of [1, 2]) {
        const index = band[`meshIdx${side}`];
        const tile = cubies[Math.floor(index / (size * size))][Math.floor(index / size) % size][index % size];
        expect(band[`color${side}`]).toBe(colors[tile.stickers[band[`dirKey${side}`]].curr]);
      }
    }
    expect(new Set(bands().map(b => b.userData.tunnelId)).size).toBe(5);
    expect(useGameStore.getState().showTunnels).toBe(false);
    await act(async () => useGameStore.setState({ showTunnels: true }));
    expect(bands()).toHaveLength(5); // Hints must not demote the raised connections.
    cubies = flipStickerPair(cubies, size, 0, 3, 1, 'NX', manifoldMap);
    await act(async () => useGameStore.setState({ cubies })); await draw();
    expect(bands()).toHaveLength(4);
    await act(async () => useGameStore.setState({ wormHealerMode: false, showTunnels: false, settings: { ...useGameStore.getState().settings, flipPads: 'off' } }));
    expect(bands()).toHaveLength(0);
    await act(async () => useGameStore.setState({ wormHealerMode: true, demoMode: true }));
    expect(bands()).toHaveLength(0);
    await act(async () => useGameStore.setState({ wormHealerMode: false, demoMode: false, showTunnels: true, tunnelDetail: 'full' }));
    expect(bands()).toHaveLength(3); // Preserve the ordinary view's detail budget.
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
