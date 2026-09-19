import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { shPush, shReset } from '../worm/circularBuffers.js';
import { advanceTunnelHead } from '../worm/healerWorm/tunnelTrail.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { liveRotation } from '../worm/liveRotation.js';

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
