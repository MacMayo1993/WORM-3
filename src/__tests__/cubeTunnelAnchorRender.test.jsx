import React, { act, createRef } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import Cubie from '../3d/Cubie.jsx';
import { getTunnelWorldPosInto } from '../worm/wormLogic.js';
import { TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { useGameStore } from '../hooks/useGameStore.js';
// Sticker textures require a canvas; this test exercises cubie transforms, not decals.
vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
extend(THREE);
it('aligns actual 5×5 exploded Cubie anchors with both analytic tunnel mouths', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ explosionT: 1, mirrorMode: true });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas), entry = createRef(), exit = createRef();
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const tunnel = { entry: { x: 4, y: 0, z: 4, dirKey: 'PX' }, exit: { x: 0, y: 4, z: 0, dirKey: 'NX' } };
  try {
    await act(async () => { root.render(<>
      <Cubie ref={entry} position={[2,-2,2]} cubie={{ ...tunnel.entry, stickers: {} }} size={5}/>
      <Cubie ref={exit} position={[-2,2,-2]} cubie={{ ...tunnel.exit, stickers: {} }} size={5}/>
    </>); });
    for (const [ref, t, sign] of [[entry, 0, 1], [exit, 1, -1]]) {
      const anchor = ref.current.getWorldPosition(new THREE.Vector3());
      expect(anchor.x).toBeCloseTo(sign * 5.06, 10);
      anchor.x += sign * TUNNEL_ANCHOR_OFFSET;
      expect(getTunnelWorldPosInto(new THREE.Vector3(), tunnel, t, 5, 1).distanceTo(anchor)).toBeLessThan(1e-10);
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState({ explosionT: before.explosionT, mirrorMode: before.mirrorMode });
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
