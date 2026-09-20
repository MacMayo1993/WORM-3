import { makeWiggleSweep, wiggleOffset } from '../worm/healerWorm/wiggleSweep.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { shPush, shReset, ttPush, ttReset } from '../worm/circularBuffers.js';
import { checkWormHitBySlice, cutWormTail } from '../worm/wormHelpers.js';
import { advanceTunnelHead } from '../worm/healerWorm/tunnelTrail.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { liveRotation, setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';

let frame, tree;
vi.mock('@react-three/fiber', () => ({ useFrame: callback => { frame = callback; } }));
import { WormBody } from '../worm/healerWorm/WormBody.jsx';

// Capture the production instance matrices on the CPU. This exercises the real
// body cursor, phase handoff and surface projection without a WebGL context.
function Harness({ worm }) { tree = WormBody({ worm, size: 3 }); return null; }
let sim, worm, host, root, mesh;
const route = { entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' } };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  liveRotation.active = false;
  sim = makeWormSim(3); resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = 40;
  worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; }, set current(value) { sim[key] = value; },
  }]));
  for (const key of ['orbPickupColors', 'orbPickupFaceIds', 'colorEpoch']) worm[`${key}Ref`] = worm[key];
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: 'classic', wormSkin: 'slime', wormElementalTheme: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness worm={worm} />));
  const element = React.Children.toArray(tree.props.children).find(child => child.type === 'instancedMesh');
  mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 4, 4), new THREE.MeshBasicMaterial(), 1200);
  element.ref.current = mesh;
});
afterEach(() => {
  resetLiveRotation();
  act(() => root.unmount()); host.remove();
  mesh.geometry.dispose(); mesh.material.dispose();
  vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
function renderPoints() {
  act(() => frame({ camera: { position: new THREE.Vector3(20, 20, 20) } }, 1 / 60));
  return Array.from({ length: mesh.count }, (_, i) => {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  });
}
function traverse(phase) {
  sim.phase = phase; sim.tunnelProgress = 0;
  for (let i = 1; i <= 60; i++) {
    advanceTunnelHead(sim, phase, i / 60, 3);
    sim.tunnelProgress = i / 60;
  }
}

it('renders the interior tail continuously when the head exits and then crawls away', () => {
  shReset(sim.stepHistory);
  for (let z = 6; z >= 1.5; z -= 0.01) shPush(sim.stepHistory, new THREE.Vector3(0, 0, z), new THREE.Vector3(0, 0, 1), -1, -1, -1, true);
  sim.activeTunnel = route;
  for (const phase of ['entering', 'tunnel', 'exiting', 'windout']) traverse(phase);
  const atHandoff = renderPoints();
  expect(atHandoff).toHaveLength(40);
  expect(atHandoff.filter(p => Math.abs(p.z) < 1.5).length).toBeGreaterThan(25);
  sim.phase = 'crawling'; sim.activeTunnel = null;
  sim.headInterpPos.addScaledVector(sim.currentNormal, -WORM_LIFT);
  const resumed = renderPoints();
  for (let i = 0; i < 40; i++) expect(resumed[i].distanceTo(atHandoff[i])).toBeLessThan(1e-6);
  // Exactly one unit of ordinary departure feeds approximately one unit of body
  // through the aperture, rather than materialising every bead at the exit.
  for (let i = 1; i <= 50; i++) {
    const point = new THREE.Vector3(0, i / 50, -1.6);
    shPush(sim.stepHistory, point, sim.currentNormal, 1, 1, 0);
    sim.headInterpPos.copy(point).addScaledVector(sim.currentNormal, -WORM_LIFT);
  }
  const departed = renderPoints();
  const emergedBefore = resumed.filter(p => p.z <= -1.5).length;
  const emergedAfter = departed.filter(p => p.z <= -1.5).length;
  expect(emergedAfter - emergedBefore).toBeGreaterThanOrEqual(10);
  expect(emergedAfter - emergedBefore).toBeLessThanOrEqual(12);
  expect(departed.some(p => Math.abs(p.z) < 1.5)).toBe(true);
});

it('uses route distance even when dense samples exceed the old sample-count cap', () => {
  shReset(sim.stepHistory);
  sim.phase = 'tunnel'; sim.headInterpPos.set(0, 0, 0); sim.currentNormal.set(0, 0, 1);
  for (let i = 6000; i >= 0; i--) shPush(sim.stepHistory, new THREE.Vector3(0, -i / 1000, 0), sim.currentNormal, -1, -1, -1, true);
  const points = renderPoints();
  expect(points).toHaveLength(40);
  expect(points.at(-1).y).toBeCloseTo(-39 * 0.09, 5);
  for (let i = 1; i < points.length; i++) expect(points[i].distanceTo(points[i - 1])).toBeCloseTo(0.09, 5);
});

it('removes every bead beyond a slice seam without stretching the remaining tail into the moving layer', () => {
  sim.phase = 'crawling'; sim.tailLength = 20;
  sim.pos = { x: 0, y: 1, z: 2, dirKey: 'PZ' };
  sim.interpT = 1;
  sim.headInterpPos.set(-1, 0, 1.52); sim.currentNormal.set(0, 0, 1);
  shReset(sim.stepHistory);
  for (let i = 200; i >= 0; i--) {
    const x = -1 + i / 100;
    shPush(sim.stepHistory, new THREE.Vector3(x, 0, 1.6), sim.currentNormal, Math.round(x + 1), 1, 2);
  }
  ttReset(sim.tileTrail, '2,1,2,PZ'); ttPush(sim.tileTrail, '1,1,2,PZ'); ttPush(sim.tileTrail, '0,1,2,PZ');
  const before = renderPoints();
  expect(before).toHaveLength(20);
  const hit = checkWormHitBySlice(worm, 'col', 1, 3);
  expect(hit.cutPosition[0]).toBeCloseTo(-0.5);
  cutWormTail(worm, hit);
  expect(sim.tailLength).toBe(5);
  for (const angle of [0, 0.3, 1, Math.PI / 2]) {
    setLiveRotation('col', [1], [angle], 1, angle);
    const points = renderPoints();
    expect(points).toHaveLength(5);
    for (let i = 0; i < points.length; i++) {
      expect(points[i].x).toBeCloseTo(before[i].x, 6);
      expect(points[i].x).toBeLessThan(-0.59);
      if (i) expect(points[i].distanceTo(points[i - 1])).toBeLessThan(0.15);
    }
  }
});

it('renders a connected three-tile tail sweep with its head fixed', () => {
  sim.tailLength = 4;
  sim.signature.sweep = makeWiggleSweep(sim);
  const anchor = sim.headInterpPos.clone().addScaledVector(sim.currentNormal, WORM_LIFT);
  for (const offset of [-3, 3, -3, 3, 0]) {
    sim.signature.sweep.offset = offset;
    sim.signature.sweep.elapsed = 1;
    const points = renderPoints();
    expect(points[0].distanceTo(anchor)).toBeLessThan(.01);
    expect(points.at(-1).x).toBeCloseTo(anchor.x + offset, 4);
    for (let i = 1; i < points.length; i++) expect(points[i].distanceTo(points[i - 1])).toBeLessThan(.2);
  }
});

it('keeps a three-face sweep connected and outside the cube through both reversals', () => {
  const r = 1.5 + WORM_LIFT;
  const route = [];
  const addLeg = (a, b, normal) => {
    for (let i = 0; i <= 100; i++) route.push({ pos: a.clone().lerp(b, i / 100), normal });
  };
  addLeg(new THREE.Vector3(0, 0, r), new THREE.Vector3(r, 0, r), new THREE.Vector3(0, 0, 1));
  addLeg(new THREE.Vector3(r, 0, r), new THREE.Vector3(r, 0, -r), new THREE.Vector3(1, 0, 0));
  addLeg(new THREE.Vector3(r, 0, -r), new THREE.Vector3(0, 0, -r), new THREE.Vector3(0, 0, -1));
  shReset(sim.stepHistory);
  for (const p of [...route].reverse()) shPush(sim.stepHistory, p.pos, p.normal, -1, -1, -1);
  sim.headInterpPos.set(0, 0, 1.5); sim.currentNormal.set(0, 0, 1);
  sim.tailLength = Math.floor(4 * r / 0.09) + 1;
  sim.moveDir = 'up';
  sim.signature.sweep = makeWiggleSweep(sim, 3);
  let previous, count;
  for (let t = 0.12; t <= 2.28; t += 0.02) {
    sim.signature.sweep.elapsed = t; sim.signature.sweep.offset = wiggleOffset(t);
    const points = renderPoints();
    count ??= points.length;
    expect(points).toHaveLength(count);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeGreaterThanOrEqual(1.5);
      expect(p.distanceTo(points[i - 1])).toBeLessThan(0.2);
      if (previous) expect(p.distanceTo(previous[i])).toBeLessThan(0.4);
    }
    previous = points;
  }
});
