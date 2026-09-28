import { makeCubies } from '../game/cubeState.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import WormChaseCamera from '../worm/WormChaseCamera.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT, ROCKET_DURATION, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import { rocketOrbitInto, rocketOrbitT } from '../worm/healerWorm/rocketOrbit.js';
import { getWindWorldPosInto } from '../worm/wormLogic.js';
import { TUNNEL_CAM_NEAR } from '../worm/tunnelCameraRails.js';

const scene = vi.hoisted(() => ({ frame: null, camera: null, size: null, mobile: true }));
vi.mock('@react-three/fiber', () => ({
  useThree: () => scene,
  useFrame: callback => { scene.frame = callback; }
}));
vi.mock('../hooks/useIsMobile.js', () => ({ useIsMobile: () => scene.mobile }));

let host, root;
const ref = current => ({ current });
const tileOnFace = (size, dirKey) => {
  const tile = { x: size - 1, y: size - 1, z: size - 1, dirKey };
  tile[dirKey[1].toLowerCase()] = dirKey[0] === 'P' ? size - 1 : 0;
  return tile;
};
function makeWorm(size, dirKey = 'PZ') {
  const pos = tileOnFace(size, dirKey);
  const head = new Vector3().fromArray(getStickerWorldPos(pos.x, pos.y, pos.z, dirKey, size, 0));
  return {
    phase: ref('crawling'), tailLength: ref(28), pos: ref(pos), moveDir: ref('up'),
    headInterpPos: ref(head), currentNormal: ref(FACE_NORMALS[dirKey].clone()),
    prevWorldPos: ref(null), curWorldPos: ref(null), activeTunnel: ref(null), tunnelProgress: ref(0),
    jumpLift() { return this.isJumping.current ? Math.sin(this.jumpT.current * Math.PI) * 1.3 : 0; },
    rocketActive: ref(false), rocketT: ref(0), isJumping: ref(false), jumpT: ref(0)
  };
}
function render(worm, size, key = 'run') {
  act(() => root.render(<WormChaseCamera key={key} worm={worm} size={size} />));
}
function tick() {
  scene.frame({}, 1 / 60);
  scene.camera.updateMatrixWorld(true);
}
function expectCentered(worm, size) {
  const head = worm.headInterpPos.current.clone();
  if (worm.phase.current === 'crawling') {
    head.addScaledVector(worm.currentNormal.current, WORM_LIFT +
      (worm.isJumping.current ? worm.jumpLift() : 0));
  }
  rocketOrbitInto(head, size, rocketOrbitT(worm.rocketActive.current, worm.rocketT.current));
  const ndc = head.project(scene.camera);
  expect(ndc.x).toBeCloseTo(0, 6);
  expect(ndc.y).toBeCloseTo(0, 6);
  expect(ndc.z).toBeGreaterThan(-1);
  expect(ndc.z).toBeLessThan(1);
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); root = createRoot(host);
  scene.mobile = true;
  scene.size = { width: 412, height: 915 };
  scene.camera = new PerspectiveCamera(70, 412 / 915, 0.1, 200);
  useGameStore.setState({ wormGamePhase: 'countdown', wormAlive: true, wormCameraHorizon: 'face',
    wormDeathDetails: null, wormStoryLevel: null, wormStoryStarted: false, wormStoryReady: false,
    wormStoryResult: null, wormCombatMode: false, demoMode: false });
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([
  ['small free play', 2, {}], ['free play', 3, {}],
  ['story', 5, { wormStoryLevel: 8, wormStoryStarted: true, wormStoryReady: true }], ['large free play', 7, {}],
  ['8x8 free play', 8, {}], ['9x9 free play', 9, {}], ['10x10 free play', 10, {}],
  ['Mega', 15, {}], ['combat', 5, { wormCombatMode: true }],
  ['practice', 3, { demoMode: true }]
])('centers the head in %s during countdown, movement and phone rotation', (_name, size, mode) => {
  useGameStore.setState(mode);
  for (const dirKey of Object.keys(FACE_NORMALS)) {
    const worm = makeWorm(size, dirKey);
    useGameStore.setState({ wormGamePhase: 'countdown' });
    render(worm, size, dirKey);
    for (let i = 0; i < 200; i++) { tick(); expectCentered(worm, size); }
    useGameStore.setState({ wormGamePhase: 'active' });
    // Move from a corner toward the middle while the positional camera lags.
    const tangent = new Vector3().fromArray(DIR_FORWARD[dirKey].up);
    for (let i = 0; i < 60; i++) {
      worm.headInterpPos.current.addScaledVector(tangent, 0.003);
      tick(); expectCentered(worm, size);
    }
    // Touch phones stay player-centered when landscape width exceeds 768px.
    scene.size = { width: 915, height: 412 };
    scene.camera.aspect = 915 / 412; scene.camera.updateProjectionMatrix();
    render(worm, size, dirKey);
    tick(); expectCentered(worm, size);
    scene.size = { width: 412, height: 915 };
    scene.camera.aspect = 412 / 915; scene.camera.updateProjectionMatrix();
  }
});

it.each([true, false])('holds the fresh briefing shot and continues into countdown without a jump (mobile=%s)', mobile => {
  scene.mobile = mobile;
  if (!mobile) {
    scene.size = { width: 1280, height: 800 };
    scene.camera.aspect = 1.6;
  }
  const size = 6, worm = makeWorm(size);
  useGameStore.setState({ wormStoryLevel: 1, wormGamePhase: 'active', wormStoryReady: true, wormStoryStarted: false });
  render(worm, size); tick();
  const opening = scene.camera.position.clone(), orientation = scene.camera.quaternion.clone(), fov = scene.camera.fov;
  for (let i = 0; i < 300; i++) tick(); // reading the briefing must not spend the dolly
  expect(scene.camera.position.distanceTo(opening)).toBeLessThan(1e-8);
  expect(scene.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-6);
  useGameStore.setState({ wormGamePhase: 'countdown', wormStoryStarted: true });
  tick();
  expect(scene.camera.position.distanceTo(opening)).toBeLessThan(.02);
  expect(scene.camera.quaternion.angleTo(orientation)).toBeLessThan(.01);
  expect(scene.camera.fov).toBe(fov);
  for (let i = 0; i < 240; i++) tick();
  expect(scene.camera.position.distanceTo(opening)).toBeGreaterThan(1);
  // Retry without remounting the camera, even after crawling on the far face.
  Object.assign(worm, makeWorm(size, 'NZ'));
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 90; i++) tick();
  Object.assign(worm, makeWorm(size));
  useGameStore.setState(s => ({ wormRunId: s.wormRunId + 1, wormStoryStarted: false }));
  tick();
  expect(scene.camera.position.distanceTo(opening)).toBeLessThan(1e-8);
  expect(scene.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-6);
});

it('uses a clean overview while a fresh Story board is still waiting to be staged', () => {
  const size = 6, worm = makeWorm(size, 'NZ');
  worm.elementalFocusT = ref(1.5);
  worm.headInterpPos.current.set(99, -40, 12);
  scene.camera.position.set(2, -3, 1);
  useGameStore.setState({ wormGamePhase: 'active', wormStoryLevel: 1, wormStoryReady: false });
  render(worm, size); tick();
  const overview = new Vector3(.6, 1.1, 1).normalize().multiplyScalar(5 + size * 4);
  expect(scene.camera.position.distanceTo(overview)).toBeLessThan(1e-8);
});

it('preserves the core aperture at the near plane and restores the surface camera afterward', () => {
  const size = 3, worm = makeWorm(size), originalNear = scene.camera.near;
  worm.activeTunnel.current = {
    entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' }
  };
  worm.phase.current = 'tunnel'; worm.tunnelProgress.current = .5;
  useGameStore.setState({ wormGamePhase: 'active' });
  render(worm, size); tick();
  expect(scene.camera.near).toBe(TUNNEL_CAM_NEAR);
  worm.phase.current = 'crawling'; worm.activeTunnel.current = null;
  tick();
  expect(scene.camera.near).toBe(originalNear);
  worm.phase.current = 'tunnel'; worm.activeTunnel.current = {
    entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' }
  };
  tick();
  act(() => root.render(null));
  expect(scene.camera.near).toBe(originalNear);
});

it('widens the portrait tunnel view and restores normal surface framing after departure', () => {
  const size = 5, worm = makeWorm(size);
  useGameStore.setState({ wormGamePhase: 'active' });
  render(worm, size);
  for (let i = 0; i < 180; i++) tick();
  const surfaceFov = scene.camera.fov;
  worm.activeTunnel.current = {
    entry: { x: 2, y: 4, z: 2, dirKey: 'PY' }, exit: { x: 2, y: 0, z: 2, dirKey: 'NY' }
  };
  worm.phase.current = 'tunnel'; worm.tunnelProgress.current = .5;
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.fov).toBeGreaterThan(100);
  expect(scene.camera.fov).toBeLessThan(103);
  worm.phase.current = 'crawling'; worm.activeTunnel.current = null;
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.fov).toBeCloseTo(surfaceFov, 0);
});

it('tracks rendered jump and rocket height through turns', () => {
  const size = 15, worm = makeWorm(size);
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active', wormCameraHorizon: 'level' });
  worm.isJumping.current = true;
  for (let i = 0; i <= 60; i++) {
    worm.jumpT.current = i / 60;
    worm.moveDir.current = i < 30 ? 'up' : 'left';
    tick(); expectCentered(worm, size);
  }
  worm.isJumping.current = false;
  worm.rocketActive.current = true;
  for (let i = 0; i <= 60; i++) {
    worm.rocketT.current = ROCKET_DURATION * i / 60;
    tick(); expectCentered(worm, size);
  }
});

it.each(['PY', 'NX'])('keeps Mega centered at a tunnel mouth and after a %s exit', exitFace => {
  const size = 15, worm = makeWorm(size, 'PY');
  const tunnel = { entry: tileOnFace(size, 'PY'), exit: tileOnFace(size, exitFace) };
  // Same-manifold case uses two distinct openings.
  tunnel.exit.x = exitFace === 'PY' ? 1 : tunnel.exit.x;
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  worm.activeTunnel.current = tunnel;
  for (const phase of ['windup', 'windout']) {
    worm.phase.current = phase;
    const exiting = phase === 'windout';
    worm.currentNormal.current.copy(FACE_NORMALS[exiting ? exitFace : 'PY']);
    for (let i = 0; i <= 30; i++) {
      worm.tunnelProgress.current = i / 30;
      getWindWorldPosInto(worm.headInterpPos.current, tunnel, exiting ? 'exit' : 'entry', i / 30, size);
      tick(); expectCentered(worm, size);
    }
  }
  worm.phase.current = 'crawling'; worm.activeTunnel.current = null;
  worm.pos.current = tunnel.exit;
  for (let i = 0; i < 60; i++) { tick(); expectCentered(worm, size); }
});

it('retains whole-board framing on desktop', () => {
  scene.mobile = false;
  scene.size = { width: 1440, height: 900 };
  scene.camera.aspect = 1440 / 900; scene.camera.updateProjectionMatrix();
  const worm = makeWorm(5);
  render(worm, 5); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  tick();
  const origin = new Vector3().project(scene.camera);
  expect(origin.x).toBeCloseTo(0, 6);
  expect(origin.y).toBeCloseTo(0.06, 6);
});

it('does not pump the camera out and back on a Mega orb pickup', () => {
  const worm = makeWorm(15);
  render(worm, 15); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 360; i++) tick();
  const head = worm.headInterpPos.current;
  let previous = scene.camera.position.distanceTo(head);
  worm.tailLength.current += ORB_SEGMENT_GROWTH;
  for (let i = 0; i < 180; i++) {
    tick();
    const distance = scene.camera.position.distanceTo(head);
    // Growth can gently widen the shot, but a pickup must not reverse it.
    expect(distance).toBeGreaterThanOrEqual(previous - 1e-8);
    previous = distance;
    expectCentered(worm, 15);
  }
});

it('settles the same camera offset after equal elapsed time at different frame rates', () => {
  const results = [];
  for (const hz of [30, 60, 120]) {
    const worm = makeWorm(15);
    useGameStore.setState({ wormGamePhase: 'countdown' });
    render(worm, 15, String(hz)); tick();
    useGameStore.setState({ wormGamePhase: 'active' });
    for (let i = 0; i < 360; i++) tick();
    worm.headInterpPos.current.x += 1;
    for (let i = 0; i < hz / 5; i++) scene.frame({}, 1 / hz);
    results.push(scene.camera.position.clone());
  }
  expect(results[0].distanceTo(results[1])).toBeLessThan(1e-7);
  expect(results[1].distanceTo(results[2])).toBeLessThan(1e-7);
});

it('does not snap the chase position to its target after a long frame', () => {
  const worm = makeWorm(15);
  render(worm, 15); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 360; i++) tick();
  const before = scene.camera.position.clone();
  worm.headInterpPos.current.x += 1;
  scene.frame({}, 2);
  const movement = scene.camera.position.x - before.x;
  expect(movement).toBeGreaterThan(0);
  expect(movement).toBeLessThan(0.8);
  scene.camera.updateMatrixWorld(true);
  expectCentered(worm, 15);
});

it.each([3, 7, 15])('keeps a full collection close and centered on a %s cube', size => {
  const worm = makeWorm(size);
  worm.tailLength.current = BASE_TAIL_LENGTH;
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 360; i++) tick();
  const head = worm.headInterpPos.current;
  const startingDistance = scene.camera.position.distanceTo(head);
  for (const orbs of [20, 50, 100, 250]) {
    worm.tailLength.current = BASE_TAIL_LENGTH + orbs * ORB_SEGMENT_GROWTH;
    for (let i = 0; i < 360; i++) tick();
    expect(scene.camera.position.distanceTo(head)).toBeLessThan(startingDistance * 1.5);
    expectCentered(worm, size);
  }
});


it.each([3, 7, 15])('frames the head and a raised cubie together on a portrait size-%i board', size => {
  const before = useGameStore.getState();
  const cubies = makeCubies(size);
  const worm = makeWorm(size);
  const tile = worm.pos.current;
  cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey].flips = 1;
  cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey].curr = 4;
  useGameStore.setState({ cubies, size, wormHealerMode: true, demoMode: false, explosionT: 0,
    wormGamePhase: 'active', settings: { ...before.settings, flipPads: 'off' } });
  try {
    render(worm, size);
    for (let i = 0; i < 180; i++) tick();
    const raised = new Vector3().fromArray(raisedPortalPosition(tile.x, tile.y, tile.z, tile.dirKey, size, useGameStore.getState()));
    for (const point of [worm.headInterpPos.current.clone(), raised]) {
      const screen = point.project(scene.camera);
      expect(Math.abs(screen.x)).toBeLessThan(0.85);
      expect(Math.abs(screen.y)).toBeLessThan(0.85);
      expect(screen.z).toBeGreaterThan(-1);
      expect(screen.z).toBeLessThan(1);
    }
  } finally { useGameStore.setState(before, true); }
});
