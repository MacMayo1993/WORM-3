import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { tunnelDockForCellInto, tunnelCoreScale } from '../utils/tunnelPath.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { coreCellIndex, coreLayout, coreZoomLimit } from '../3d/antipodalCore.js';
import { CHROME_TILE_FINISH } from '../3d/cubeViewStyles.js';
import { CORE_MIRROR_HALF } from '../3d/corePassage.js';
import { mirrorSubjects } from '../3d/mirrorSubjects.js';

// jsdom has touch events, so it reads as mobile; the core's light is desktop-only.
vi.mock('../utils/device.js', async (importOriginal) => ({ ...(await importOriginal()), isMobile: false }));

extend(THREE);

it('mirrors the live cube, flashes both docked tiles, lights only an opened cube and swells on a ride', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const bridge = { ...tunnelState };
  let cubies = makeCubies(3);
  cubies = flipStickerPair(cubies, 3, 2, 1, 1, 'PX', buildManifoldGridMap(cubies, 3));
  // A pulse left over from earlier play must not fire when the core mounts.
  useGameStore.setState({
    cubies, size: 3, wormHealerMode: false, wormPaused: false, explosionT: 0, visualMode: 'classic', animState: null,
    hollowMode: false, perfReducedFX: false, showCutawayLens: false, captureMode: false,
    moveHistory: [], flipPulse: { at: 1, color: '#ffffff', danger: 0 },
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, biomeMode: { enabled: false } }
  });
  // Stand-ins for CubeAssembly's cubie meshes, at their x-major indices.
  const refs = [];
  for (const { idx } of coreLayout(3).cells) refs[idx] = new THREE.Object3D();
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 8] } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<VoidCore cubieRefs={refs} />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    frame();
    const scene = store.getState().scene;
    const stickers = scene.getObjectByName('antipodal-core-stickers');
    const bodies = scene.getObjectByName('antipodal-core-body');
    const light = scene.getObjectByName('antipodal-core-light');
    for (const mesh of [stickers, bodies]) {
      expect(mesh.material.userData.coreLightning).toBeUndefined();
      expect(mesh.material.customProgramCacheKey()).not.toContain('lightning');
    }
    const zoom = bodies.parent;
    const layout = coreLayout(3);
    const tile = (x, y, z, dirKey) => layout.stickers.findIndex(s => s.x === x && s.y === y && s.z === z && s.dirKey === dirKey);
    const colour = (i) => new THREE.Color().fromArray(stickers.instanceColor.array, i * 3);
    const own = tile(2, 1, 1, 'PX'), partner = tile(0, 1, 1, 'NX'), other = tile(1, 2, 1, 'PY');
    const rest = [own, partner, other].map(colour);
    // The flipped pair shows each other's current colours, which now differ.
    expect(rest[0].equals(rest[1])).toBe(false);
    expect(zoom.scale.x).toBe(1);

    // Closed cube: the core must not light the groove walls between pieces.
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(light.intensity).toBe(0);
    const antiverse = scene.getObjectByName('antiverse');
    const universe = scene.getObjectByName('antiverse-space').material.uniforms;
    expect(antiverse.visible).toBe(false);

    // A flip flashes the two core tiles its tunnel runs between, and nothing else.
    await act(async () => useGameStore.setState({
      moveHistory: [{ type: 'flip', pos: { x: 2, y: 1, z: 1 }, dirKey: 'PX', timestamp: 50 }],
      flipPulse: { at: 50, color: '#3973e8', danger: 0 }
    }));
    frame();
    const whiteness = (c) => Math.min(c.r, c.g, c.b);
    expect(whiteness(colour(own))).toBeGreaterThan(whiteness(rest[0]) + 0.3);
    expect(whiteness(colour(partner))).toBeGreaterThan(whiteness(rest[1]) + 0.3);
    expect(colour(other).equals(rest[2])).toBe(true);
    for (let i = 0; i < 240; i++) frame();
    expect(colour(own).equals(rest[0])).toBe(true); // and settles back

    // Chrome stays on the outward core tiles regardless of equipped outer patterns.
    await act(async () => useGameStore.setState({ settings: {
      ...useGameStore.getState().settings, colorScheme: 'custom', customColors: { 5: '#b24bde', 2: '#28be80' },
      manifoldStyles: { 5: 'checkerboard', 2: 'circuit' }
    } })); frame();
    expect(scene.getObjectByName('antipodal-core-style-5-checkerboard')).toBeUndefined();
    expect(stickers.material).toMatchObject(CHROME_TILE_FINISH);
    expect(stickers.count).toBe(54);
    expect(colour(own).getHexString()).toBe('b24bde');
    expect(universe.uPalette.value[4].getHexString()).toBe('b24bde');
    const dock = tunnelDockForCellInto(new THREE.Vector3(), 2, 1, 1, 'PX', 3);
    const batchPosition = new THREE.Vector3(), batchMatrix = new THREE.Matrix4();
    stickers.getMatrixAt(own, batchMatrix);
    expect(batchPosition.setFromMatrixPosition(batchMatrix).distanceTo(dock)).toBeLessThan(tunnelCoreScale(3) * 0.01);
    expect(batchMatrix.determinant()).toBeGreaterThan(0);
    const chromeMaterial = stickers.material;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
    refs[coreCellIndex(2, 1, 1, 3)].quaternion.copy(turn);
    await act(async () => useGameStore.setState({ animState: { axis: 'row', sliceIndex: 1, dir: 1, t: 0.4 } })); frame();
    stickers.getMatrixAt(own, batchMatrix);
    const turnedNormal = new THREE.Vector3(0, 0, 1).transformDirection(batchMatrix);
    expect(turnedNormal.distanceTo(new THREE.Vector3(1, 0, 0).applyQuaternion(turn))).toBeLessThan(1e-6);
    refs[coreCellIndex(2, 1, 1, 3)].quaternion.identity();
    await act(async () => useGameStore.setState({ cubies: rotateSliceCubies(cubies, 3, 'row', 2, 1), animState: null })); frame();
    expect(stickers.material).toBe(chromeMaterial);

    await act(async () => useGameStore.setState({ cubies, settings: {
      ...useGameStore.getState().settings, colorScheme: 'standard', customColors: null, manifoldStyles: {}
    } })); frame();
    expect(scene.getObjectByName('antipodal-core-style-5-checkerboard')).toBeUndefined();
    stickers.getMatrixAt(own, batchMatrix);
    expect(batchMatrix.determinant()).toBeGreaterThan(0); // plain tile restored

    // A slice turn turns the same slice of the core.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
    refs[coreCellIndex(2, 2, 2, 3)].quaternion.copy(q);
    await act(async () => useGameStore.setState({ animState: { axis: 'row', dir: 1, sliceIndex: 2, t: 0.4 } })); frame();
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), r = new THREE.Quaternion(), sc = new THREE.Vector3();
    const cellIndex = layout.cells.findIndex(c => c.x === 2 && c.y === 2 && c.z === 2);
    bodies.getMatrixAt(cellIndex, m);
    m.decompose(p, r, sc);
    expect(r.angleTo(q)).toBeLessThan(1e-6);
    expect(p.distanceTo(new THREE.Vector3(1, 1, 1).applyQuaternion(q).multiplyScalar(tunnelCoreScale(3)))).toBeLessThan(1e-6);
    refs[coreCellIndex(2, 2, 2, 3)].quaternion.identity();
    await act(async () => useGameStore.setState({ animState: null })); frame();

    await act(async () => useGameStore.setState({ explosionT: 1 })); frame();
    expect(light.intensity).toBeGreaterThan(0);
    expect(antiverse.visible).toBe(true);
    const initialTime = universe.uTime.value; frame();
    expect(universe.uTime.value).toBeGreaterThan(initialTime);
    // Capture hides UI, while the same 3D field keeps drawing and animating.
    await act(async () => useGameStore.getState().setCaptureMode(true));
    const captureTime = universe.uTime.value; frame();
    expect(antiverse.visible).toBe(true);
    expect(universe.uOpacity.value).toBe(1);
    expect(universe.uTime.value).toBeGreaterThan(captureTime);
    await act(async () => useGameStore.getState().setCaptureMode(false));
    await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } }));
    const heldTime = universe.uTime.value; frame(); frame();
    expect(universe.uTime.value).toBe(heldTime);
    await act(async () => useGameStore.setState({ perfReducedFX: true })); frame();
    expect(scene.getObjectByName('antiverse-pairs').visible).toBe(false);
    await act(async () => useGameStore.setState({ perfReducedFX: false,
      settings: { ...useGameStore.getState().settings, reducedMotion: false } })); frame();

    // WORM: the core is solid (it hides the worm's crossing) and the light stays
    // mounted, dark, so the scene's light count never changes.
    await act(async () => useGameStore.setState({ wormHealerMode: true, explosionT: 0 })); frame();
    expect(bodies.material.transparent).toBe(false);
    expect(bodies.material.depthWrite).toBe(true);
    expect(scene.getObjectByName('antipodal-core-light')).toBe(light);
    expect(light.intensity).toBe(0);

    // Riding a tunnel into the +Z centre tile: far away the core is its own size;
    // with the lens at the entry face it swells, anchored on the entry dock.
    const entry = { x: 1, y: 1, z: 2, dirKey: 'PZ' };
    Object.assign(tunnelState, { active: true, t: 0.4, activeTunnelId: 'ride', tunnel: { entry, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' } } });
    const camera = store.getState().camera;
    camera.position.set(0, 0, 8);
    for (let i = 0; i < 30; i++) frame();
    expect(zoom.scale.x).toBeCloseTo(1, 3);
    camera.position.set(0, 0.3, 0.3);
    for (let i = 0; i < 60; i++) frame();
    const rideDock = tunnelDockForCellInto(new THREE.Vector3(), 1, 1, 2, 'PZ', 3);
    const limit = coreZoomLimit(rideDock, 3);
    expect(zoom.scale.x).toBeGreaterThan(limit * 0.95);
    // The entry dock is a fixed point of the swell: the worm still dives into its tile.
    expect(rideDock.clone().multiplyScalar(zoom.scale.x).add(zoom.position).distanceTo(rideDock)).toBeLessThan(1e-9);
    // The head can already be near the exit while the trailing lens is still
    // inside. Hold the room open until the CAMERA has crossed its far wall.
    tunnelState.t = 0.9;
    camera.position.set(0, 0, 0);
    for (let i = 0; i < 60; i++) frame();
    expect(zoom.scale.x).toBeGreaterThan(limit * 0.99);
    const room = scene.getObjectByName('anticube-mirror-room');
    expect(room.visible).toBe(true);
    expect(room.parent).toBe(zoom);
    const roomUniforms = bodies.material.userData.portalCutout;
    expect(roomUniforms.uCoreRoomCenter.value.distanceTo(zoom.position)).toBeLessThan(1e-9);
    const subject = new THREE.Vector3(.1, .02, 0);
    tunnelState.rideHead = subject; frame();
    expect(roomUniforms.uSightEnd.value.equals(subject)).toBe(true);
    expect(roomUniforms.uSightStart.value.equals(camera.position)).toBe(true);
    expect(roomUniforms.uSightRadius.value).toBeGreaterThan(0);
    tunnelState.rideHead = null; frame();
    expect(roomUniforms.uSightRadius.value).toBe(0);
    camera.position.set(0, 0, -3);
    for (let i = 0; i < 60; i++) frame();
    expect(zoom.scale.x).toBeCloseTo(1, 2);
    // Reduced motion never swells it.
    tunnelState.t = 0.4; tunnelState.activeTunnelId = 'ride-2';
    await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } }));
    for (let i = 0; i < 60; i++) frame();
    expect(zoom.scale.x).toBeCloseTo(1, 3);
  } finally {
    Object.assign(tunnelState, bridge);
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('updates bent opening geometry before its light anchors and keeps calm modes steady in the real frame hook', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  const tunnel = { entry: { x: 1, y: 2, z: 1, dirKey: 'PY' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' }, entryColor: 1, exitColor: 2 };
  useGameStore.setState({ cubies: makeCubies(3), size: 3, wormHealerMode: true, wormAlive: true, wormPaused: false,
    wormGamePhase: 'playing', wormStoryLevel: null, explosionT: 0, animState: null, perfReducedFX: false,
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, reduceFlashing: false } });
  Object.assign(tunnelState, { tunnel, portalTunnel: tunnel, active: true, t: .55, lensT: .47, activeTunnelId: 'bent-prism-integration' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, .2, 0] } });
  let inner;
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<VoidCore />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    const scene = store.getState().scene;
    const room = scene.getObjectByName('anticube-mirror-room'), tiles = scene.getObjectByName('anticube-mirror-tiles');
    inner = scene.getObjectByName('anticube-inner-rims');
    const u = tiles.material.uniforms, matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    expect(mirrorSubjects().has(inner)).toBe(true);
    for (let frameIndex = 0; frameIndex < 30; frameIndex++) {
      frame(); room.updateWorldMatrix(true, false);
      for (const endpoint of [u.uChamberEntry.value, u.uChamberExit.value]) {
        const world = endpoint.clone().multiplyScalar(CORE_MIRROR_HALF).applyMatrix4(room.matrixWorld);
        let nearest = Infinity;
        for (let i = 0; i < inner.count; i++) {
          inner.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
          nearest = Math.min(nearest, position.distanceTo(world));
        }
        // Rims sit 0.2% of the bore radius inward to avoid z-fighting.
        expect(nearest).toBeLessThan(u.uPassageRadius.value * .003);
      }
    }
    expect(room.parent.scale.x).toBeGreaterThan(1.1);
    expect(u.uChamberProgress.value).toBeCloseTo(.35); // lens .47, head .55
    expect(inner.material.uniforms.uChamberReveal).toBe(u.uChamberReveal);
    const held = u.uChamberProgress.value;
    await act(async () => useGameStore.setState({ wormPaused: true }));
    tunnelState.lensT = .56; frame(); frame(); expect(u.uChamberProgress.value).toBe(held);
    await act(async () => useGameStore.setState({ wormPaused: false, wormAlive: false }));
    frame(); frame(); expect(u.uChamberProgress.value).toBe(held);
    for (const setting of ['reduceFlashing', 'reducedMotion']) {
      await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings,
        reducedMotion: setting === 'reducedMotion', reduceFlashing: setting === 'reduceFlashing' } }));
      frame(); expect(u.uChamberCrest.value).toBe(0); expect(u.uChamberCalm.value).toBe(1);
      expect(u.uChamberLevel.value).toBe(.34);
    }
    await act(async () => useGameStore.setState({ wormHealerMode: false })); frame();
    expect(room.visible).toBe(false); expect(inner.parent.visible).toBe(false); expect(u.uChamberLevel.value).toBe(0);
  } finally {
    Object.assign(tunnelState, bridge);
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
  expect(mirrorSubjects().has(inner)).toBe(false);
});
