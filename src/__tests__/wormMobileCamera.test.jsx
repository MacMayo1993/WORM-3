import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import WormChaseCamera from '../worm/WormChaseCamera.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT, ROCKET_DURATION } from '../worm/healerWorm/constants.js';
import { rocketOrbitInto, rocketOrbitT } from '../worm/healerWorm/rocketOrbit.js';
import { getWindWorldPosInto } from '../worm/wormLogic.js';

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
      (worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0));
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
    wormDeathDetails: null, wormStoryLevel: null, wormCombatMode: false, demoMode: false });
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([
  ['small free play', 2, {}], ['free play', 3, {}],
  ['story', 5, { wormStoryLevel: 8 }], ['large free play', 7, {}],
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
