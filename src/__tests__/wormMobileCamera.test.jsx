import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import WormChaseCamera from '../worm/WormChaseCamera.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT, ROCKET_DURATION, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH, CUT_FOCUS_DURATION } from '../worm/healerWorm/constants.js';
import { rocketOrbitInto, rocketOrbitT } from '../worm/healerWorm/rocketOrbit.js';
import { getWindWorldPosInto } from '../worm/wormLogic.js';
import { sliceShotInto } from '../worm/sliceShot.js';

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
function expectInFrame(point) {
  const ndc = point.clone().project(scene.camera);
  expect(Math.abs(ndc.x)).toBeLessThan(0.95);
  expect(Math.abs(ndc.y)).toBeLessThan(0.95);
  expect(ndc.z).toBeGreaterThan(-1);
  expect(ndc.z).toBeLessThan(1);
}
function expectBoardInFrame(size) {
  for (const x of [-size / 2, size / 2]) {
    for (const y of [-size / 2, size / 2]) {
      for (const z of [-size / 2, size / 2]) expectInFrame(new Vector3(x, y, z));
    }
  }
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

it.each([3, 7, 15])('shows the cut and full rotating layer on a %s cube, then returns to the head', size => {
  for (const [width, height, mobile] of [[412, 915, true], [915, 412, true], [1440, 900, false]]) {
    scene.size = { width, height }; scene.mobile = mobile;
    scene.camera.aspect = width / height; scene.camera.updateProjectionMatrix();
    for (const dirKey of Object.keys(FACE_NORMALS)) {
      const worm = makeWorm(size, dirKey);
      const impactTile = { x: 0, y: 0, z: 0, dirKey };
      impactTile[dirKey[1].toLowerCase()] = dirKey[0] === 'P' ? size - 1 : 0;
      const impact = new Vector3().fromArray(getStickerWorldPos(
        impactTile.x, impactTile.y, impactTile.z, dirKey, size, 0));
      worm.cutFocusT = ref(0); worm.cutFocusPos = ref(impact.toArray());
      worm.cutFocusSlice = ref({ axis: dirKey[1] === 'Y' ? 'col' : 'row', layer: 0 });
      useGameStore.setState({ wormGamePhase: 'countdown' });
      render(worm, size, `${width}-${mobile}-${dirKey}`); tick();
      useGameStore.setState({ wormGamePhase: 'active' });
      for (let i = 0; i < 180; i++) tick();
      const chaseDistance = scene.camera.position.distanceTo(worm.headInterpPos.current);
      for (let i = 0; i <= 72; i++) {
        worm.cutFocusT.current = CUT_FOCUS_DURATION - i / 60;
        tick();
        if (i >= 54) {
          expectBoardInFrame(size);
          expectInFrame(impact);
          expectInFrame(worm.headInterpPos.current);
        }
      }
      expect(scene.camera.position.distanceTo(worm.headInterpPos.current)).toBeGreaterThan(chaseDistance);
      for (let i = 73; i <= CUT_FOCUS_DURATION * 60 + 30; i++) {
        worm.cutFocusT.current = Math.max(0, CUT_FOCUS_DURATION - i / 60); tick();
      }
      if (mobile) expectCentered(worm, size);
    }
  }
});

it('pulls out for a fatal slice and holds the overview still', () => {
  const size = 15, worm = makeWorm(size, 'NY');
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 180; i++) tick();
  const fov = scene.camera.fov;
  useGameStore.setState({ wormAlive: false, wormDeathDetails: { reason: 'slice-rotation' } });
  for (let i = 0; i < 40; i++) tick();
  expectBoardInFrame(size);
  expectInFrame(worm.headInterpPos.current);
  expect(scene.camera.fov).toBe(fov);
  const pose = scene.camera.position.clone(), orientation = scene.camera.quaternion.clone();
  for (let i = 0; i < 60; i++) tick();
  expect(scene.camera.position.distanceTo(pose)).toBeLessThan(1e-9);
  expect(scene.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
});

it('aims a fatal neck cut at the recorded cut face instead of the head face', () => {
  const size = 15, worm = makeWorm(size, 'PZ');
  worm.headInterpPos.current.set(-7.4, 0, 7.58);
  const impact = [-7.58, 0, 6.5];
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 180; i++) tick();
  const shot = sliceShotInto({ cam: new Vector3(), look: new Vector3(), up: new Vector3() },
    impact, 'depth', 14, size, { fov: scene.camera.fov, aspect: scene.camera.aspect });
  useGameStore.setState({ wormAlive: false, wormDeathDetails: {
    reason: 'slice-rotation', axis: 'depth', sliceIndex: 14, impactPosition: impact,
  } });
  for (let i = 0; i < 60; i++) tick();
  expect(scene.camera.position.distanceTo(shot.cam)).toBeLessThan(1e-8);
  expect(scene.camera.position.x).toBeLessThan(impact[0]);
  expectInFrame(new Vector3(...impact));
  expectBoardInFrame(size);
  const aim = shot.look.clone().project(scene.camera);
  expect(aim.x).toBeCloseTo(0, 8);
  expect(aim.y).toBeCloseTo(0, 8);
});

it.each(Object.keys(FACE_NORMALS))('keeps a portrait Mega bomb cut close on %s and returns to the head', dirKey => {
  const size = 15, worm = makeWorm(size, dirKey);
  const impact = FACE_NORMALS[dirKey].clone().multiplyScalar(size / 2 + 0.08);
  worm.cutFocusT = ref(0); worm.cutFocusPos = ref(impact.toArray());
  worm.cutFocusSlice = ref(null);
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 180; i++) tick();
  for (let i = 0; i <= 72; i++) {
    worm.cutFocusT.current = CUT_FOCUS_DURATION - i / 60; tick();
  }
  // The original blast shot is about 10–14 units from the hit on Mega;
  // a full-board portrait overview would be several times farther away.
  expect(scene.camera.position.distanceTo(impact)).toBeLessThan(15);
  expect(scene.camera.position.clone().sub(impact).dot(FACE_NORMALS[dirKey])).toBeGreaterThan(0);
  const hit = impact.clone().project(scene.camera);
  expect(Math.abs(hit.x)).toBeLessThan(0.05);
  expect(Math.abs(hit.y)).toBeLessThan(0.05);
  for (let i = 73; i <= CUT_FOCUS_DURATION * 60 + 30; i++) {
    worm.cutFocusT.current = Math.max(0, CUT_FOCUS_DURATION - i / 60); tick();
  }
  expectCentered(worm, size);
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
