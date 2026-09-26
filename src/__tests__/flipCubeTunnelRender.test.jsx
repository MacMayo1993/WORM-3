import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import { PadProvider, FlipPadOffset } from '../3d/PadSprings.jsx';
import { padMotion } from '../3d/padMotionBridge.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';

extend(THREE);
async function sceneTest(check) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ size: 5, chaosLevel: 0, wormHealerMode: false, demoMode: false, mirrorMode: false,
    settings: { ...before.settings, flipPads: 'full', reducedMotion: true } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 430, height: 932 } });
  try { await check(root); }
  finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

it('keeps the colored ribbon welded to both raised tile mouths during bounce and a live turn', () => sceneTest(async root => {
  const a = new THREE.Group(), b = new THREE.Group();
  a.position.set(0, 0, 2.55); b.position.set(0, 0, -2.55);
  const id = 'flip-cube-anchor-test', motion = { lift: 0.3 };
  padMotion.set(id, motion);
  const draw = active2 => <MobiusTunnel meshIdx1={0} meshIdx2={1} dirKey1="PZ" dirKey2="NZ" cubieRefs={[a, b]}
    tunnelId={id} flips={1} color1="#1234ff" color2="#12ff34" raisedPresentation active1 active2={active2} />;
  let store;
  try {
    await act(async () => { store = root.render(draw(true)); });
    const ribbon = store.getState().scene.children[0].children[0];
    expect(ribbon.material.transparent).toBe(false);
    expect(ribbon.geometry.index.count).toBe(64 * 6); // Continuous through the half twist.
    const checkMouth = (mesh, sign, vertex, lift) => {
      const normal = new THREE.Vector3(0, 0, sign).applyQuaternion(mesh.quaternion);
      const mouth = mesh.position.clone().addScaledVector(normal, TUNNEL_ANCHOR_OFFSET + lift);
      const rendered = new THREE.Vector3().fromBufferAttribute(ribbon.geometry.attributes.position, vertex);
      expect(rendered.distanceTo(mouth)).toBeLessThan(1e-5);
    };
    for (const [frame, lift, angle] of [[1, .3, 0], [2, .39, .4], [3, .31, Math.PI / 2]]) {
      motion.lift = lift;
      a.position.set(2.55 * Math.sin(angle), 0, 2.55 * Math.cos(angle));
      a.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      store.getState().advance(frame / 60);
      checkMouth(a, 1, 0, lift); checkMouth(b, -1, 128, lift);
    }
    expect(ribbon.material.uniforms.uColorA.value.getHexString()).toBe('1234ff');
    expect(ribbon.material.uniforms.uColorB.value.getHexString()).toBe('12ff34');
    // A lone pad's unflipped partner must remain on its original surface.
    await act(async () => root.render(draw(false)));
    store.getState().advance(4 / 60);
    checkMouth(a, 1, 0, motion.lift); checkMouth(b, -1, 128, 0);
  } finally { padMotion.delete(id); }
}));

it('renders all 150 portal columns on a fully flipped 5x5 instead of dropping everything after pad 64', () => sceneTest(async root => {
  const tiles = [];
  for (const plane of makeCubies(5)) for (const row of plane) for (const cubie of row) {
    for (const meta of Object.values(cubie.stickers)) tiles.push({ ...meta, flips: 1 });
  }
  let store;
  await act(async () => { store = root.render(<PadProvider>{tiles.map((meta, i) =>
    <FlipPadOffset key={i} meta={meta} size={5} pos={[i, 0, .51]} rot={[0, 0, 0]}><group /></FlipPadOffset>
  )}</PadProvider>); });
  store.getState().advance(1 / 60);
  const columns = [];
  store.getState().scene.traverse(o => { if (o.isInstancedMesh && o.material.isShaderMaterial) columns.push(o); });
  expect(tiles).toHaveLength(150);
  expect(columns.map(o => o.count)).toEqual([150, 150]);
  for (const mesh of columns) {
    const last = new THREE.Matrix4(); mesh.getMatrixAt(149, last);
    expect(new THREE.Vector3().setFromMatrixPosition(last).x).toBe(149);
  }
}));
