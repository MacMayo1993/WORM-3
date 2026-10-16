import { STORY_ARRIVAL_SECONDS } from '../worm/healerWorm/storyArrival.js';
import { makeCubies } from '../game/cubeState.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import WormChaseCamera from '../worm/WormChaseCamera.jsx';
import { victoryViewport, victoryView, resetVictoryView, rotateVictoryView, zoomVictoryView, victoryCameraFrame } from '../worm/story/victoryFrame.js';
import { prefersReducedMotion } from '../utils/device.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT, ROCKET_DURATION, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH,
  tunnelArmSeconds, tunnelHandoffSeconds } from '../worm/healerWorm/constants.js';
import { rocketOrbitInto, rocketOrbitT } from '../worm/healerWorm/rocketOrbit.js';
import { getWindWorldPosInto, getTunnelWorldPosInto } from '../worm/wormLogic.js';
import { tunnelTraversalT } from '../utils/tunnelPath.js';
import { TUNNEL_CAM_NEAR, makeCrossingCloseUp, crossingCloseUpInto, crossingFov } from '../worm/tunnelCameraRails.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';
import { makeCautionFall, cautionFallPoint, CAUTION_FALL_SECONDS } from '../worm/healerWorm/cautionRescue.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { CAUTION_OPENING_RADIUS } from '../worm/healerWorm/cautionOpening.js';
import { CUT_FOCUS_DURATION, CUT_FOCUS_IN, CUT_FOCUS_HOLD } from '../worm/healerWorm/constants.js';

const scene = vi.hoisted(() => ({ frame: null, camera: null, size: null, mobile: true }));
vi.mock('@react-three/fiber', () => ({
  useThree: () => scene,
  useFrame: callback => { scene.frame = callback; }
}));
vi.mock('../hooks/useIsMobile.js', () => ({ useIsMobile: () => scene.mobile }));
vi.mock('../utils/device.js', async original => ({ ...(await original()), prefersReducedMotion: vi.fn(() => false) }));

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
function render(worm, size, key = 'run', arrivalElapsed) {
  act(() => root.render(<WormChaseCamera key={key} worm={worm} size={size} arrivalElapsed={arrivalElapsed} />));
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
  victoryViewport.current = null; resetVictoryView();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
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
  victoryViewport.current = null; resetVictoryView();
});

it.each([true, false])('holds the actual tail-cut point still for one second (mobile=%s)', mobile => {
  scene.mobile = mobile;
  const size = 6, worm = makeWorm(size);
  useGameStore.setState({ wormGamePhase: 'active' });
  render(worm, size);
  for (let i = 0; i < 180; i++) tick();
  const start = scene.camera.position.clone();
  const impact = new Vector3(-1, 1, size / 2 + .08);
  worm.cutFocusT = ref(CUT_FOCUS_DURATION);
  worm.cutFocusPos = ref(impact.toArray());
  worm.cutFocusSlice = ref({ axis: 'row', layer: 3 });
  tick();
  expect(scene.camera.position.distanceTo(start)).toBeLessThan(1e-8);
  let held, orientation;
  for (let i = 0; i <= 60; i++) {
    worm.cutFocusT.current = CUT_FOCUS_DURATION - CUT_FOCUS_IN - i / 60 * CUT_FOCUS_HOLD;
    tick();
    const hit = impact.clone().project(scene.camera);
    expect(hit.x).toBeCloseTo(0, 6); expect(hit.y).toBeCloseTo(0, 6);
    if (!held) { held = scene.camera.position.clone(); orientation = scene.camera.quaternion.clone(); }
    expect(scene.camera.position.distanceTo(held)).toBeLessThan(1e-8);
    expect(scene.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-6);
  }
  worm.cutFocusT.current = .000001; tick();
  expect(scene.camera.position.distanceTo(start)).toBeLessThan(1e-7);
  worm.cutFocusT.current = 0; worm.cutFocusPos.current = null;
  for (let i = 0; i < 180; i++) tick();
  if (mobile) expectCentered(worm, size);
});

it.each([2, 3, 4, 15])('keeps the entire size-%i victory orbit inside the clear stage, then restores the camera on retry', size => {
  const worm = makeWorm(size);
  render(worm, size); tick();
  for (const [width, height, bounds] of [
    [320, 568, { left: .04, top: .02, width: .92, height: .33 }],
    [430, 850, { left: .04, top: .02, width: .92, height: .45 }],
    [850, 430, { left: .02, top: .04, width: .48, height: .92 }],
  ]) {
    scene.size = { width, height };
    scene.camera.aspect = width / height;
    scene.camera.fov = 102; // victory can follow a tunnel
    scene.camera.updateProjectionMatrix();
    victoryViewport.current = bounds;
    useGameStore.setState({ wormGamePhase: 'solved', wormStoryResult: { levelId: 60, stars: 2 } });
    for (let i = 0; i < 360; i++) tick();
    const before = scene.camera.position.clone();
    for (let i = 0; i < 660; i++) {
      tick();
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const ndc = new Vector3(x, y, z).multiplyScalar(size / 2 + .45).project(scene.camera);
        const screenX = (ndc.x + 1) / 2, screenY = (1 - ndc.y) / 2;
        expect(screenX).toBeGreaterThan(bounds.left);
        expect(screenX).toBeLessThan(bounds.left + bounds.width);
        expect(screenY).toBeGreaterThan(bounds.top);
        expect(screenY).toBeLessThan(bounds.top + bounds.height);
      }
    }
    expect(scene.camera.position.distanceTo(before)).toBeGreaterThan(1);
    useGameStore.setState({ wormGamePhase: 'scrambling', wormStoryResult: null });
    tick();
    expect(scene.camera.view.enabled).toBe(false);
  }
});

it('holds the victory cube still with reduced motion and clears framing on unmount', () => {
  vi.mocked(prefersReducedMotion).mockReturnValue(true);
  victoryViewport.current = { left: .04, top: .02, width: .92, height: .4 };
  useGameStore.setState({ wormGamePhase: 'solved', wormStoryResult: { levelId: 1, stars: 3 } });
  render(makeWorm(3), 3); tick();
  const position = scene.camera.position.clone();
  for (let i = 0; i < 120; i++) tick();
  expect(scene.camera.position.distanceTo(position)).toBeLessThan(1e-8);
  act(() => root.render(null));
  expect(scene.camera.view.enabled).toBe(false);
});

it.each([[412, 915], [915, 412], [1280, 800]])('keeps the caution-tape pull in view through death and retry at %sx%s', (width, height) => {
  scene.size = { width, height };
  scene.camera.aspect = width / height; scene.camera.updateProjectionMatrix();
  for (const dirKey of Object.keys(FACE_NORMALS)) {
    const size = 5, worm = makeWorm(size, dirKey);
    const forward = new Vector3().fromArray(DIR_FORWARD[dirKey].up);
    // The target is a corner tile; approach from the adjoining surface.
    worm.headInterpPos.current.addScaledVector(forward, -1);
    useGameStore.setState({ wormAlive: true, wormGamePhase: 'active' });
    render(worm, size, dirKey);
    for (let i = 0; i < 180; i++) tick();
    const fall = makeCautionFall({ headInterpPos: worm.headInterpPos.current,
      currentNormal: worm.currentNormal.current, expansionAmount: 0 }, worm.pos.current, size);
    worm.phase.current = 'falling'; worm.cautionFall = ref(fall);
    for (let i = 0; i <= Math.ceil(CAUTION_FALL_SECONDS * 60); i++) {
      fall.elapsed = i / 60;
      cautionFallPoint(worm.headInterpPos.current, fall, fall.elapsed);
      tick();
      for (const point of [fall.start, fall.mouth, worm.headInterpPos.current]) {
        const ndc = point.clone().project(scene.camera);
        expect(Math.abs(ndc.x)).toBeLessThan(0.9);
        expect(Math.abs(ndc.y)).toBeLessThan(0.9);
        expect(ndc.z).toBeGreaterThan(-1);
        expect(ndc.z).toBeLessThan(1);
      }
      expect(scene.camera.position.clone().sub(fall.mouth).dot(fall.normal)).toBeGreaterThan(0.5);
      if (fall.elapsed >= 1.6) {
        // On-screen is insufficient: the sightline to the falling head must
        // pass through the small bore rather than through the opaque tile lip.
        const ray = worm.headInterpPos.current.clone().sub(scene.camera.position);
        for (const height of [0, 0.655]) {
          const plane = fall.mouth.clone().addScaledVector(fall.normal, height);
          const distance = plane.clone().sub(scene.camera.position).dot(fall.normal) / ray.dot(fall.normal);
          const radial = scene.camera.position.clone().addScaledVector(ray, distance).sub(plane).projectOnPlane(fall.normal);
          expect(radial.length()).toBeLessThan(CAUTION_OPENING_RADIUS - 0.16);
        }
      }
    }
    expect(tunnelState.fallOpening).toBe(fall);
    const held = scene.camera.position.clone();
    worm.phase.current = 'dead'; useGameStore.setState({ wormAlive: false });
    for (let i = 0; i < 30; i++) tick();
    expect(scene.camera.position.distanceTo(held)).toBeLessThan(0.001);
    worm.cautionFall.current = null;
    Object.assign(worm, makeWorm(size, dirKey));
    useGameStore.setState(s => ({ wormRunId: s.wormRunId + 1, wormAlive: true, wormGamePhase: 'scrambling' }));
    tick();
    expect(tunnelState.fallOpening).toBeNull();
  }
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
  // Down the entry arm, well short of the core (the crossing close-up is below).
  worm.phase.current = 'entering'; worm.tunnelProgress.current = .5;
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.fov).toBeGreaterThan(100);
  expect(scene.camera.fov).toBeLessThan(103);
  worm.phase.current = 'crawling'; worm.activeTunnel.current = null;
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.fov).toBeCloseTo(surfaceFov, 0);
});

// The lens trails most of a cubie behind the head, so it is still in the entry
// arm while the head crosses the core. A minimum physical gauge and bounded
// sight cutaway let the close-up frame the worm itself.
it.each([false, true])('frames the head through the crossing, and keeps the ride lens for reduced motion (%s)', reduced => {
  const size = 5, worm = makeWorm(size), zoom = 4;
  tunnelState.coreZoom = zoom;
  useGameStore.setState({ wormGamePhase: 'active', settings: { ...useGameStore.getState().settings, reducedMotion: reduced } });
  render(worm, size);
  const tunnel = { entry: { x: 2, y: 4, z: 2, dirKey: 'PY' }, exit: { x: 2, y: 0, z: 2, dirKey: 'NY' } };
  worm.activeTunnel.current = tunnel;
  worm.phase.current = 'tunnel'; worm.tunnelProgress.current = .5;
  getTunnelWorldPosInto(worm.headInterpPos.current, tunnel, .5, size);
  for (let i = 0; i < 180; i++) tick();
  const closeUp = crossingCloseUpInto(makeCrossingCloseUp(), tunnel, .5, size, zoom);
  if (reduced) expect(scene.camera.fov).toBeGreaterThan(100);
  else expect(scene.camera.fov).toBeCloseTo(crossingFov(closeUp, scene.camera.aspect, 100.7), 0);
  // The head is the subject of the crossing close-up.
  const head = worm.headInterpPos.current.clone().project(scene.camera);
  if (!reduced) {
    expect(Math.hypot(head.x, head.y)).toBeLessThan(0.15);
    expect(scene.camera.fov).toBeLessThan(80);
  }
  expect(Math.max(Math.abs(head.x), Math.abs(head.y))).toBeLessThan(0.8);
  tunnelState.coreZoom = 1;
  useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: false } });
});

// The rail aims down the route; round a bend, or where slice turns put both
// mouths on one face and the route doubles back, the head used to leave a
// phone's narrow frame or go behind the lens on the way out.
it.each([3, 5, 15])('keeps the head in a portrait frame through every ride phase on bent and doubled-back routes (%s)', size => {
  const n = size - 1, c = Math.floor(size / 2);
  for (const route of [
    { entry: { x: c, y: n, z: c, dirKey: 'PY' }, exit: { x: 0, y: c, z: c, dirKey: 'NX' } },
    { entry: { x: 0, y: n, z: n, dirKey: 'PZ' }, exit: { x: n, y: 0, z: 0, dirKey: 'PX' } },
    { entry: { x: 0, y: n, z: c, dirKey: 'PY' }, exit: { x: n, y: n, z: c, dirKey: 'PY' } },
  ]) {
    const worm = makeWorm(size, route.entry.dirKey);
    const tunnel = { ...route, padExpansion: wormRaisedAmount(size), padHeight: WORM_PAD_HEIGHT };
    render(worm, size, `frame-${size}-${route.exit.dirKey}-${route.exit.x}`); tick();
    useGameStore.setState({ wormGamePhase: 'active' });
    worm.activeTunnel.current = tunnel;
    let worst = 0;
    for (const [phase, seconds] of [['entering', tunnelArmSeconds(tunnel)], ['tunnel', 2], ['exiting', tunnelArmSeconds(tunnel)]]) {
      worm.phase.current = phase;
      const frames = Math.round(seconds * 60);
      for (let frame = 1; frame <= frames; frame++) {
        worm.tunnelProgress.current = frame / frames;
        getTunnelWorldPosInto(worm.headInterpPos.current, tunnel, tunnelTraversalT(phase, frame / frames), size);
        tick();
        const view = worm.headInterpPos.current.clone().applyMatrix4(scene.camera.matrixWorldInverse);
        expect(view.z).toBeLessThan(0); // in front of the lens
        const ndc = worm.headInterpPos.current.clone().project(scene.camera);
        worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y));
      }
    }
    // Never off screen (the old rail reached 1.7, or behind the lens).
    expect(worst).toBeLessThan(0.95);
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

it.each([3, 5, 15])('enters a raised wormhole promptly on a %s cube in phone and desktop views', size => {
  for (const mobile of [true, false]) {
    scene.mobile = mobile;
    const worm = makeWorm(size, 'PY');
    const tunnel = { entry: tileOnFace(size, 'PY'), exit: tileOnFace(size, 'NY'),
      padExpansion: wormRaisedAmount(size), padHeight: WORM_PAD_HEIGHT };
    render(worm, size, String(mobile)); tick();
    useGameStore.setState({ wormGamePhase: 'active' });
    for (let i = 0; i < 120; i++) tick();
    worm.activeTunnel.current = tunnel;
    const mouth = getTunnelWorldPosInto(new Vector3(), tunnel, 0, size);
    const normal = FACE_NORMALS.PY;
    let crossedAt = null;
    let previousHeight = Infinity;
    for (let frame = 0; frame <= 240; frame++) {
      const time = frame / 60;
      const handoff = tunnelHandoffSeconds(tunnel);
      const entering = time >= handoff;
      const progress = entering ? (time - handoff) / tunnelArmSeconds(tunnel) : time / handoff;
      worm.phase.current = entering ? 'entering' : 'windup';
      worm.tunnelProgress.current = progress;
      if (entering) getTunnelWorldPosInto(worm.headInterpPos.current, tunnel, tunnelTraversalT('entering', progress), size);
      else getWindWorldPosInto(worm.headInterpPos.current, tunnel, 'entry', progress, size);
      tick();
      const height = scene.camera.position.clone().sub(mouth).dot(normal);
      expect(height).toBeLessThanOrEqual(previousHeight + 1e-8);
      previousHeight = height;
      if (height < 0 && crossedAt === null) {
        crossedAt = time;
        // The camera enters the mouth, rather than cutting through its tile.
        const lateral = scene.camera.position.clone().sub(mouth).addScaledVector(normal, -height);
        expect(lateral.length()).toBeLessThan(.01);
      }
    }
    expect(crossedAt).not.toBeNull();
    expect(crossedAt).toBeLessThan(1.4);
  }
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

it.each([8, 10, 15])('centres the head on a %s cube on desktop, where the cube centre lies far below the surface', size => {
  scene.mobile = false;
  scene.size = { width: 1440, height: 900 };
  scene.camera.aspect = 1440 / 900; scene.camera.updateProjectionMatrix();
  const worm = makeWorm(size);
  render(worm, size); tick();
  useGameStore.setState({ wormGamePhase: 'active' });
  for (let i = 0; i < 60; i++) tick();
  expectCentered(worm, size);
});

it.each([true, false])('stands the chase camera further back as the player zooms out (mobile=%s)', mobile => {
  const before = useGameStore.getState().wormCameraZoom;
  scene.mobile = mobile;
  if (!mobile) {
    scene.size = { width: 1440, height: 900 };
    scene.camera.aspect = 1440 / 900; scene.camera.updateProjectionMatrix();
  }
  try {
    const worm = makeWorm(5);
    useGameStore.setState({ wormCameraZoom: 1 });
    render(worm, 5); tick();
    useGameStore.setState({ wormGamePhase: 'active' });
    for (let i = 0; i < 600; i++) tick();
    const head = worm.headInterpPos.current;
    const near = scene.camera.position.distanceTo(head);
    useGameStore.getState().setWormCameraZoom(2);
    // Eased, not cut: the next frame has barely moved.
    tick();
    expect(scene.camera.position.distanceTo(head)).toBeLessThan(near * 1.2);
    for (let i = 0; i < 600; i++) tick();
    expect(scene.camera.position.distanceTo(head) / near).toBeCloseTo(2, 1);
  } finally {
    useGameStore.getState().setWormCameraZoom(before);
  }
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

it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 15])('fits every rotating corner of the size-%i opening on portrait and landscape screens', size => {
  const worm = makeWorm(size);
  for (const [width, height] of [[320, 568], [430, 850], [568, 320], [1280, 800]]) {
    scene.size = { width, height };
    scene.camera.aspect = width / height;
    scene.camera.fov = 100; // retry after a tunnel/rocket shot
    scene.camera.updateProjectionMatrix();
    scene.camera.position.set(0, 0, 0);
    useGameStore.setState({ wormGamePhase: 'scrambling', wormRunId: `${size}:${width}` });
    render(worm, size); tick();
    expect(scene.camera.fov).toBe(55);
    for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
      for (const angle of [0, Math.PI / 8, Math.PI / 4, Math.PI / 2]) {
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
          const ndc = new Vector3(x, y, z).multiplyScalar(size / 2 + .04)
            .applyAxisAngle(axis, angle).project(scene.camera);
          expect(Math.abs(ndc.x)).toBeLessThan(.9);
          expect(Math.abs(ndc.y)).toBeLessThan(.9);
          expect(ndc.z).toBeGreaterThan(-1);
          expect(ndc.z).toBeLessThan(1);
        }
      }
    }
  }
});

it.each(['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'])('frames the arrival face-first outside %s and settles onto the chase view', dir => {
  const worm = makeWorm(6, dir), elapsed = ref(0);
  useGameStore.setState({ wormGamePhase: 'spawning' });
  render(worm, 6, 'arrival', elapsed);
  tick();
  const forward = new Vector3(...DIR_FORWARD[dir].up), normal = FACE_NORMALS[dir];
  expect(scene.camera.position.clone().sub(worm.headInterpPos.current).dot(forward)).toBeGreaterThan(0);
  for (const fraction of [.2, .55, .7, .85, 1]) {
    elapsed.current = STORY_ARRIVAL_SECONDS * fraction; tick();
    const head = worm.headInterpPos.current.clone().addScaledVector(normal, WORM_LIFT);
    const screen = head.project(scene.camera);
    expect(Math.abs(screen.x)).toBeLessThan(0.05);
    expect(Math.abs(screen.y)).toBeLessThan(0.05);
    expect(scene.camera.position.clone().sub(worm.headInterpPos.current).dot(normal)).toBeGreaterThan(1);
  }
  const settled = scene.camera.position.clone();
  useGameStore.setState({ wormGamePhase: 'active' }); tick();
  expect(scene.camera.position.distanceTo(settled)).toBeLessThan(0.2);
});

// The exit used to fly the lens out of the mouth ahead of the worm (through its
// head), park it looking back at the hole, swing it half a turn in windout and
// snap it again on the first crawling frame. Now the lens trails the head up the
// arm, cuts once as windout starts to the chase crawling resumes from, and the
// hand-back is still.
it.each([3, 5, 15])('leaves a raised wormhole with one cut onto the chase it resumes on a %s cube', size => {
  for (const mobile of [true, false]) {
    scene.mobile = mobile;
    const worm = makeWorm(size, 'PY');
    const tunnel = { entry: tileOnFace(size, 'PY'), exit: tileOnFace(size, 'NY'),
      padExpansion: wormRaisedAmount(size), padHeight: WORM_PAD_HEIGHT };
    render(worm, size, `exit-${mobile}`); tick();
    useGameStore.setState({ wormGamePhase: 'active' });
    worm.activeTunnel.current = tunnel;
    const lens = () => ({ cam: scene.camera.position.clone(), quat: scene.camera.quaternion.clone() });
    const step = (a, b) => ({ move: a.cam.distanceTo(b.cam), turn: a.quat.angleTo(b.quat) * 180 / Math.PI });
    worm.phase.current = 'exiting';
    let previous = null;
    const armFrames = Math.round(tunnelArmSeconds(tunnel) * 60);
    let speed = null;
    for (let frame = 0; frame <= armFrames; frame++) {
      worm.tunnelProgress.current = frame / armFrames;
      getTunnelWorldPosInto(worm.headInterpPos.current, tunnel, tunnelTraversalT('exiting', frame / armFrames), size);
      tick();
      const now = lens();
      // The lens keeps pace with the head (fast on a long 15×15 arm), smoothly.
      if (previous && frame > 1) {
        const { move } = step(previous, now);
        if (speed !== null) expect(Math.abs(move - speed)).toBeLessThan(0.03);
        speed = move;
      }
      previous = now;
    }
    worm.phase.current = 'windout';
    worm.currentNormal.current.copy(FACE_NORMALS.NY);
    const shots = [], windFrames = Math.round(tunnelHandoffSeconds(tunnel) * 60);
    for (let frame = 0; frame <= windFrames; frame++) {
      worm.tunnelProgress.current = frame / windFrames;
      getWindWorldPosInto(worm.headInterpPos.current, tunnel, 'exit', frame / windFrames, size);
      tick();
      shots.push(lens());
    }
    // One cut, then a held shot: it only tilts as the lens relaxes from the
    // tunnel's wide angle (and phones re-centre on the coiling head).
    for (let i = 1; i < shots.length; i++) {
      const { move, turn } = step(shots[i - 1], shots[i]);
      expect(move).toBeLessThan(1e-6);
      if (!mobile) expect(turn).toBeLessThan(0.2);
    }
    worm.phase.current = 'crawling';
    worm.pos.current = tunnel.exit;
    previous = shots.at(-1);
    for (let frame = 0; frame < 60; frame++) {
      tick();
      const now = lens(), { move, turn } = step(previous, now);
      expect(move).toBeLessThan(0.05);
      expect(turn).toBeLessThan(1.5);
      previous = now;
    }
  }
});


it.each([false, true])('lets players inspect and reset the victory cube with reduced motion=%s', still => {
  vi.mocked(prefersReducedMotion).mockReturnValue(still);
  const bounds = { left: .04, top: .02, width: .92, height: .4 };
  victoryViewport.current = bounds;
  // Free Play uses the same framed camera, without a Story result.
  useGameStore.setState({ wormGamePhase: 'solved', wormStoryResult: null });
  render(makeWorm(7), 7);
  for (let i = 0; i < 360; i++) tick();
  const before = scene.camera.position.clone();
  zoomVictoryView(.65);
  rotateVictoryView(80, -50);
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.position.length()).toBeCloseTo(victoryCameraFrame(7, 412, 915, bounds).distance * .65, 4);
  expect(scene.camera.position.clone().normalize().distanceTo(before.clone().normalize())).toBeGreaterThan(.3);
  const manualPosition = scene.camera.position.clone();
  for (let i = 0; i < 180; i++) tick();
  expect(scene.camera.position.distanceTo(manualPosition)).toBeLessThan(1e-8);
  resetVictoryView();
  for (let i = 0; i < 360; i++) tick();
  expect(victoryView.manual).toBe(false);
  expect(scene.camera.position.length()).toBeCloseTo(before.length(), 3);
});

it('frames victory closer than the former bounding sphere on a phone', () => {
  const bounds = { left: .04, top: .02, width: .92, height: .4 };
  const narrow = Math.atan(Math.tan(55 * Math.PI / 360) * Math.min(bounds.height, bounds.width * 412 / 915));
  const formerDistance = Math.sqrt(3) * (7 / 2 + .6) / Math.sin(narrow) * 1.08;
  expect(victoryCameraFrame(7, 412, 915, bounds).distance).toBeLessThan(formerDistance * .9);
});
