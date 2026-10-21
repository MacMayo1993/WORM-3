import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { coreLayout } from '../3d/antipodalCore.js';

vi.mock('../utils/device.js', async (importOriginal) => ({ ...(await importOriginal()), isMobile: false }));
extend(THREE);

// A view power swaps the whole cube's look for 20 seconds and then restores it.
// A material disposed on the way out releases its program, so the swap back used
// to relink the core's programs mid-run (2–4 links on every pickup and expiry).
// Each look's materials now live as long as the core does.
it('keeps the core materials of every look it has worn across view-power swaps', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({
    cubies: makeCubies(3), size: 3, wormHealerMode: true, wormViewPower: null, wormPaused: false, explosionT: 0,
    visualMode: 'classic', animState: null, hollowMode: false, perfReducedFX: false, moveHistory: [], flipPulse: null,
    settings: { ...before.settings, colorScheme: 'standard', biomeMode: { enabled: false },
      manifoldStyles: { 1: 'eyeball', 2: 'marble', 3: 'eyeball', 4: 'marble', 5: 'eyeball', 6: 'marble' } }
  });
  const refs = [];
  for (const { idx } of coreLayout(3).cells) refs[idx] = new THREE.Object3D();
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    capabilities: { isWebGL2: false }, extensions: { has: () => false },
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 8] } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<VoidCore cubieRefs={refs} />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    frame();
    const scene = () => store.getState().scene;
    const body = () => scene().getObjectByName('antipodal-core-body');
    const styled = () => scene().children[0].getObjectsByProperty('isInstancedMesh', true)
      .filter(mesh => mesh.name.startsWith('antipodal-core-style-')).map(mesh => mesh.material);
    const bodyMesh = body(), restBody = bodyMesh.material, restStyles = styled();
    const stickers = scene().getObjectByName('antipodal-core-stickers'), stickerMaterial = stickers.material;
    expect(restStyles.length).toBeGreaterThan(0);
    const spies = [restBody, stickerMaterial, ...restStyles].map(material => vi.spyOn(material, 'dispose'));

    await act(async () => useGameStore.setState({ wormViewPower: 'view-glass' })); frame();
    const glassBody = body().material;
    expect(glassBody).not.toBe(restBody);
    // The swap changes only the material: the instanced bodies keep their mesh and layout.
    expect(body()).toBe(bodyMesh);
    expect(scene().getObjectByName('antipodal-core-stickers')).toBe(stickers);
    expect(stickers.material).toBe(stickerMaterial);

    await act(async () => useGameStore.setState({ wormViewPower: null })); frame();
    expect(body().material).toBe(restBody);
    expect(styled()).toEqual(restStyles);
    await act(async () => useGameStore.setState({ wormViewPower: 'view-glass' })); frame();
    expect(body().material).toBe(glassBody);
    await act(async () => useGameStore.setState({ wormViewPower: null })); frame();
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());

    await act(async () => root.unmount());
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
  } finally {
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
