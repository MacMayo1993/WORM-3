import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WormTrail } from '../worm/healerWorm/WormTrail.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { liveCubies } from '../worm/liveCubies.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { makeTileTrail, ttPush, ttReset, ttMapInPlace } from '../worm/circularBuffers.js';
import { uploadTrailRange } from '../worm/healerWorm/trailUpdates.js';
let frame, tree, root, host, meshes, worm, abilityTrail = false;
vi.mock('@react-three/fiber', () => ({ useFrame: callback => { frame = callback; } }));
function Harness() { tree = WormTrail({ worm, size: 3, abilityTrail }); return null; }
const tick = () => act(() => frame({}, 0.1));
beforeEach(() => {
  abilityTrail = false;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetLiveRotation();
  useGameStore.setState({ wormShowTrail: true, wormSkin: 'slime', wormTrail: 'classic', wormCharacter: 'classic', cubiePops: {}, rotationEpoch: 0 });
  liveCubies.size = 3;
  liveCubies.refs = Array.from({ length: 27 }, (_, i) => {
    const obj = new THREE.Object3D();
    obj.position.set(Math.floor(i / 9) - 1, Math.floor(i / 3) % 3 - 1, i % 3 - 1);
    return obj;
  });
  const path = makeTileTrail(64);
  for (const key of ['0,0,2,PZ','1,0,2,PZ','2,0,2,PZ','2,1,2,PZ','2,2,2,PZ']) ttPush(path, key);
  worm = { pathHistory: { current: path }, phase: { current: 'crawling' }, tailLength: { current: 4 } };
  host = document.createElement('div'); root = createRoot(host);
  act(() => root.render(<Harness />));
  meshes = React.Children.toArray(tree.props.children).map(element => {
    const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial(), element.props.args[2]);
    element.ref.current = mesh;
    return mesh;
  });
  tick();
});
afterEach(() => {
  act(() => root.unmount());
  for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
  liveCubies.refs = null; liveCubies.size = 0; resetLiveRotation();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('reuses settled geometry and colors instead of rebuilding/uploading each frame', () => {
  const [mesh] = meshes;
  expect(mesh.count).toBeGreaterThan(0);
  const matrix = mesh.instanceMatrix.version, colors = mesh.instanceColor.version;
  const write = vi.spyOn(mesh, 'setMatrixAt');
  for (let i = 0; i < 60; i++) tick();
  expect(write).not.toHaveBeenCalled();
  expect(mesh.instanceMatrix.version).toBe(matrix);
  expect(mesh.instanceColor.version).toBe(colors);
});

it('updates moving paint without uploading unchanged colors and includes the final settled pose', () => {
  const [mesh] = meshes;
  const before = mesh.instanceMatrix.array.slice(), colors = mesh.instanceColor.version;
  liveRotation.active = true;
  liveCubies.refs[20].position.x += 0.01;
  tick();
  expect(mesh.instanceMatrix.array).not.toEqual(before);
  expect(mesh.instanceColor.version).toBe(colors);
  liveRotation.active = false;
  liveCubies.refs[20].position.x += 0.01;
  const moving = mesh.instanceMatrix.array.slice();
  tick();
  expect(mesh.instanceMatrix.array).not.toEqual(moving);
  const settled = mesh.instanceMatrix.version;
  tick(); expect(mesh.instanceMatrix.version).toBe(settled);
});

it('hides immediately for a tunnel and rebuilds after exit, tail cut, wrap and remap', () => {
  const [mesh] = meshes;
  worm.phase.current = 'tunnel'; tick(); expect(mesh.count).toBe(0);
  worm.phase.current = 'crawling'; tick(); expect(mesh.count).toBeGreaterThan(0);
  worm.tailLength.current = 100; tick(); expect(mesh.count).toBe(0);
  worm.tailLength.current = 4; tick(); expect(mesh.count).toBeGreaterThan(0);
  for (let i = 0; i < 80; i++) ttPush(worm.pathHistory.current, `${i % 3},0,2,PZ`);
  tick(); expect(mesh.count).toBeGreaterThan(0);
  const before = mesh.instanceMatrix.array.slice();
  ttMapInPlace(worm.pathHistory.current, key => key.replace('PZ', 'NZ'));
  act(() => useGameStore.setState(s => ({ rotationEpoch: s.rotationEpoch + 1 })));
  tick(); expect(mesh.instanceMatrix.array).not.toEqual(before);
  ttReset(worm.pathHistory.current, '0,0,2,PZ'); tick(); expect(mesh.count).toBe(0);
});

it('keeps pending off-camera upload ranges bounded without discarding earlier edits', () => {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(160), 16);
  for (let i = 0; i < 100; i++) uploadTrailRange(attr, i % 8, 16 + i % 8);
  expect(attr.updateRanges).toEqual([{ start: 0, count: 23 }]);
});

it('Glow paints only the new ability path and hides it when the three-second effect ends', () => {
  abilityTrail = true;
  worm.signature = { current: { character: 'glow', active: 3, trailStartSeq: worm.pathHistory.current.nextSeq } };
  act(() => { useGameStore.setState({ wormShowTrail: false, wormCharacter: 'glow' }); root.render(<Harness />); });
  tick(); expect(meshes[0].count).toBe(0);
  ttPush(worm.pathHistory.current, '1,2,2,PZ');
  ttPush(worm.pathHistory.current, '0,2,2,PZ');
  tick(); expect(meshes[0].count).toBeGreaterThan(0);
  worm.signature.current.active = 0;
  tick(); expect(meshes[0].count).toBe(0); expect(meshes[1].count).toBe(0);
});
