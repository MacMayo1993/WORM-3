import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { MenuPortalScene, MenuPortalAnchor } from '../components/menus/MenuPortalScene.jsx';
import { MENU_FLIP_PAIRS, MENU_PORTAL_OVERLAY_Z } from '../components/menus/menuCenterPortals.js';
import MenuFlipWave from '../components/menus/MenuFlipWave.jsx';
import { setCarouselActive } from '../components/menus/menuCarouselState.js';

extend(THREE);
it('renders three worms from one coordinator, pauses together, and completes once after all tails disappear', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 430, height: 932 } });
  const complete = vi.fn();
  const origins = MENU_FLIP_PAIRS.flat().map(face => ({ dir: face.dir, color: '#88ff88' }));
  try {
    let store;
    await act(async () => { store = root.render(<MenuPortalScene>
      {MENU_FLIP_PAIRS.flat().map(face => <group key={face.dir} position={face.pos} rotation={face.rot}>
        <group position={[0, 0, 0.35 - MENU_PORTAL_OVERLAY_Z]}><MenuPortalAnchor dir={face.dir} /></group>
      </group>)}
      <MenuFlipWave origins={origins} onComplete={complete} characterCycle={0} />
    </MenuPortalScene>); });
    const rigs = [];
    store.getState().scene.traverse(node => { if (node.name.startsWith('menu-character-')) rigs.push(node); });
    expect(rigs).toHaveLength(3);
    let frame = 1;
    for (; frame < 90; frame++) store.getState().advance(frame / 60);
    expect(complete).not.toHaveBeenCalled();
    const firstBeads = rigs.map(rig => rig.children[0]);
    const held = firstBeads.map(bead => bead.position.clone());
    setCarouselActive(true);
    for (let i = 0; i < 30; i++) store.getState().advance(frame++ / 60);
    expect(rigs.every(rig => !rig.visible)).toBe(true);
    firstBeads.forEach((bead, i) => expect(bead.position.equals(held[i])).toBe(true));
    setCarouselActive(false);
    for (; frame < 1200; frame++) store.getState().advance(frame / 60);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(rigs.every(rig => !rig.visible)).toBe(true);
    store.getState().scene.updateMatrixWorld(true);
    rigs.forEach(rig => rig.traverse(node => expect(node.matrixWorld.elements.every(Number.isFinite)).toBe(true)));
  } finally {
    await act(async () => root.unmount());
    setCarouselActive(false);
    vi.restoreAllMocks();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
