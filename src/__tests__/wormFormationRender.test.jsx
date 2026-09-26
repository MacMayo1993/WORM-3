import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import Cubie from '../3d/Cubie.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import DemoPracticeTargets from '../worm/healerWorm/DemoPracticeTargets.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { liveCubies } from '../worm/liveCubies.js';
import { TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { WORM_PIECE_POP, WORM_PAD_HEIGHT, WORM_CAUTION_TAPE_TOP, wormRaisedAmount } from '../game/raisedCubie.js';
import { makeTunnelCenterline, buildTunnelCenterlineInto, getWindWorldPosInto } from '../worm/wormLogic.js';
import { makeTunnelRideFrame, tunnelRideFrameInto } from '../utils/tunnelRide.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import { makeWormSim, resetWormSim, startJump, stepWormSim } from '../worm/healerWorm/wormSim.js';
vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
extend(THREE);

it.each([false, true])('raises real cubies, grows the band and lands after formation (demo=%s)', async demoMode => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), liveBefore = { ...liveCubies };
  const cubies = makeCubies(3), refs = [], indices = [14, 12], gridRefs = [];
  useGameStore.setState({ size: 3, cubies, explosionT: 0, wormHealerMode: true, demoMode,
    demoStep: 'worm-traversal', demoWormFinished: false, demoWormComplete: false, wormStoryLevel: null,
    wormPhase: 'crawling', demoWormTarget: { x: 1, y: 1, z: 2, dirKey: 'PZ' },
    wormPaused: false, wormPauseMenuOpen: false, mirrorMode: false, hollowMode: false, visualMode: 'solid',
    randomMode: false, chaosLevel: 0, cubiePops: {}, settings: { ...before.settings, flipPads: 'off', reducedMotion: false } });
  liveCubies.size = 3; liveCubies.refs = gridRefs;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const draw = raised => <PadProvider>
    <DemoPracticeTargets size={3} />
    {[2, 0].map((z, i) => <Cubie key={i} ref={el => { refs[i] = el; gridRefs[indices[i]] = el; }}
      cubie={cubies[1][1][z]} position={[0, 0, z - 1]} size={3} wormMode />)}
    {raised && <MobiusTunnel meshIdx1={0} meshIdx2={1} dirKey1="PZ" dirKey2="NZ" cubieRefs={refs}
      flips={1} color1="#e83a50" color2="#ffaa00" gridId1="a" gridId2="b" tunnelId="a|b" />}
  </PadProvider>;
  try {
    let store, time = 0;
    await act(async () => { store = root.render(draw(false)); });
    const frame = (dt = 1 / 60) => { time += dt; store.getState().advance(time); };
    frame();
    for (const [z, dir] of [[2, 'PZ'], [0, 'NZ']]) {
      cubies[1][1][z].stickers[dir].flips = 1;
      cubies[1][1][z] = { ...cubies[1][1][z] };
    }
    await act(async () => root.render(draw(true)));
    frame();
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeLessThan(1.001);
    const materials = [];
    store.getState().scene.traverse(o => { if (o.material?.uniforms?.uGrowT) materials.push(o.material); });
    expect(materials).toHaveLength(3);
    expect(materials[1].uniforms.uGrowT).toBe(materials[0].uniforms.uGrowT);
    expect(materials[2].uniforms.uGrowT).toBe(materials[0].uniforms.uGrowT);
    expect(materials[0].uniforms.uGrowT.value).toBeLessThan(.02);
    const sim = makeWormSim(3); resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
    sim.pos = { x: 1, y: 1, z: 2, dirKey: 'PZ' }; sim.headInterpPos.set(0, 0, 1.52);
    const ctx = { getCubies: () => cubies, getTunnelEntry: () => 'pad', feel: () => {},
      isPaused: () => false, getSpeed: () => 2, getGamePhase: () => 'active', getControlMode: () => 'non-oriented',
      getWormholeInterval: () => 9999, resolveTunnel: () => null };
    startJump(sim, ctx, 3, { allowDive: false });
    expect(sim.padFlight.duration).toBeGreaterThan(1.9);
    for (let i = 0; i < 59; i++) { frame(); stepWormSim(sim, 1 / 60, 3, ctx); }
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1 + WORM_PIECE_POP / 2, 5);
    expect(materials[0].uniforms.uGrowT.value).toBeCloseTo(.5, 5);
    expect(sim.padFlight).toBeTruthy();
    const point = raisedPortalPosition(1, 1, 2, 'PZ', 3, useGameStore.getState());
    expect(point[2]).toBeCloseTo(1 + WORM_PIECE_POP / 2 + .52 + WORM_PAD_HEIGHT, 5);
    const marker = store.getState().scene.getObjectByName('practice-target');
    if (demoMode) expect(marker.position.z).toBeCloseTo(point[2] + .035, 5);
    else expect(marker).toBeUndefined();
    await act(async () => useGameStore.setState({ wormPaused: true }));
    for (let i = 0; i < 30; i++) frame();
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1 + WORM_PIECE_POP / 2, 5);
    expect(materials[0].uniforms.uGrowT.value).toBeCloseTo(.5, 5);
    await act(async () => useGameStore.setState({ wormPaused: false }));
    for (let i = 0; i < 65; i++) { frame(); if (sim.padFlight) stepWormSim(sim, 1 / 60, 3, ctx); }
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1 + WORM_PIECE_POP, 8);
    expect(materials[0].uniforms.uGrowT.value).toBe(1);
    // The ribbon reaches the lifted tile, rather than stopping inside the body.
    const ribbon = [];
    store.getState().scene.traverse(o => { if (o.material === materials[0]) ribbon.push(o); });
    const vertices = ribbon[0].geometry.attributes.position;
    // The geometry cache rebuilds after 0.01 units of anchor movement.
    expect(Math.abs(vertices.getZ(0) - (1 + WORM_PIECE_POP + TUNNEL_ANCHOR_OFFSET + WORM_PAD_HEIGHT))).toBeLessThan(0.01);
    // The rendered raised ribbon, worm route, and mouth handoffs share anchors.
    const tunnel = { entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' },
      padExpansion: wormRaisedAmount(3), padHeight: WORM_PAD_HEIGHT };
    const path = buildTunnelCenterlineInto(makeTunnelCenterline(), tunnel, 3);
    const ride = makeTunnelRideFrame(), left = new THREE.Vector3(), right = new THREE.Vector3();
    const segments = vertices.count / 2 - 1;
    for (let i = 0; i <= segments; i += 10) {
      tunnelRideFrameInto(ride, path, path.total * i / segments);
      left.fromBufferAttribute(vertices, i * 2); right.fromBufferAttribute(vertices, i * 2 + 1);
      expect(left.lerp(right, .5).distanceTo(ride.floor)).toBeLessThan(.01);
    }
    for (const [side, arc] of [['entry', 0], ['exit', path.total]]) {
      tunnelRideFrameInto(ride, path, arc);
      expect(getWindWorldPosInto(left, tunnel, side, 1, 3).distanceTo(ride.center)).toBeLessThan(1e-7);
    }
    const shell = refs[0].children[0].children.find(o => o.isMesh);
    expect(shell.material.depthWrite).toBe(false);
    expect(shell.material.opacity).toBeLessThan(0.2);
    expect(sim.padFlight).toBeNull();
    expect(sim.headInterpPos.z).toBeCloseTo(1.52 + WORM_CAUTION_TAPE_TOP, 6);
    if (demoMode) {
      expect(marker.position.z).toBeCloseTo(1.52 + WORM_CAUTION_TAPE_TOP + .035, 6);
      await act(async () => useGameStore.setState({ demoWormComplete: true }));
      expect(store.getState().scene.getObjectByName('practice-target')).toBeUndefined();
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(liveCubies, liveBefore);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('updates both endpoint colors and rails without moving or rebuilding the band', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ wormHealerMode: true, demoMode: false,
    settings: { ...before.settings, reducedMotion: true } });
  const refs = [new THREE.Object3D(), new THREE.Object3D()];
  refs[0].position.set(-2, 0, 0); refs[1].position.set(2, 0, 0);
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const draw = (color1, color2) => <MobiusTunnel meshIdx1={0} meshIdx2={1} dirKey1="NX" dirKey2="PX"
    cubieRefs={refs} flips={1} color1={color1} color2={color2} gridId1="a" gridId2="b" tunnelId="a|b" />;
  try {
    let store;
    await act(async () => { store = root.render(draw('#3973e8', '#38c875')); });
    store.getState().advance(1 / 60);
    const meshes = [];
    store.getState().scene.traverse(o => { if (o.material?.uniforms?.uRideCore) meshes.push(o); });
    expect(meshes).toHaveLength(3);
    const uniforms = meshes[0].material.uniforms;
    const versions = meshes.map(o => o.geometry.attributes.position.version);
    for (const mesh of meshes) {
      expect(mesh.material.uniforms.uColorA).toBe(uniforms.uColorA);
      expect(mesh.material.uniforms.uColorB).toBe(uniforms.uColorB);
      expect(mesh.material.uniforms.uRideCore).toBe(uniforms.uRideCore);
    }
    expect(uniforms.uColorA.value.getHexString()).toBe('3973e8');
    expect(uniforms.uColorB.value.getHexString()).toBe('38c875');
    await act(async () => root.render(draw('#0051a2', '#009b48')));
    store.getState().advance(2 / 60);
    expect(uniforms.uColorA.value.getHexString()).toBe('0051a2');
    expect(uniforms.uColorB.value.getHexString()).toBe('009b48');
    expect(meshes.map(o => o.geometry.attributes.position.version)).toEqual(versions);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
