import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { tunnelDockForCellInto, tunnelCoreScale } from '../utils/tunnelPath.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { coreCellIndex, coreLayout, coreZoomLimit } from '../3d/antipodalCore.js';

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
    hollowMode: false, perfReducedFX: false, moveHistory: [], flipPulse: { at: 1, color: '#ffffff', danger: 0 },
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
    const dock = tunnelDockForCellInto(new THREE.Vector3(), 1, 1, 2, 'PZ', 3);
    const limit = coreZoomLimit(dock, 3);
    expect(zoom.scale.x).toBeGreaterThan(limit * 0.95);
    // The entry dock is a fixed point of the swell: the worm still dives into its tile.
    expect(dock.clone().multiplyScalar(zoom.scale.x).add(zoom.position).distanceTo(dock)).toBeLessThan(1e-9);
    // Through the core and on the way out, it lets go.
    tunnelState.t = 0.9;
    for (let i = 0; i < 60; i++) frame();
    expect(zoom.scale.x).toBeCloseTo(1, 3);
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
