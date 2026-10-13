import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormExpansion, getWormStickerWorldPos } from '../worm/wormExpansion.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { liveCubies } from '../worm/liveCubies.js';
import { buildElementalCells, attachCellAttributes } from '../worm/healerWorm/elementalCells.js';
import { expandedElementalQuality, elementalHalfExtent } from '../worm/healerWorm/elementalExpansion.js';
import { resolveElementalQuality } from '../worm/healerWorm/elementalQuality.js';
import { uCubeHalf, uCubeGap } from '../worm/healerWorm/elementalUniforms.js';
import { makeReactionField, stepReactionField } from '../worm/healerWorm/fusionParticles.js';
import { REACTION_PARTICLES } from '../worm/healerWorm/fusionLooks.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
let frame, props, mesh, root, host;
vi.mock('@react-three/fiber', () => ({ useFrame: cb => { frame = cb; } }));
import ElementalCubeSkin from '../worm/ElementalCubeSkin.jsx';

// Exercise the real layer driver against actual Three instance matrices, keeping
// only its WebGL child inert. This catches stale geometry/ref/claim handoffs.
function Harness(options) {
  const child = ElementalCubeSkin(options);
  props = child.props;
  if (!mesh || mesh.count !== props.count) {
    mesh?.geometry.dispose(); mesh?.material.dispose(); mesh?.dispose();
    mesh = new THREE.InstancedMesh(attachCellAttributes(new THREE.BufferGeometry(), props.cellData),
      new THREE.ShaderMaterial({ uniforms: { uEnv: { value: new THREE.Vector4() },
        uElapsed: { value: 0 }, uClaimOrigin: { value: new THREE.Vector4() } } }), props.count);
  }
  props.meshRef.current = mesh;
  return null;
}
const tick = () => act(() => frame({}, 0.05));
const expand = amount => act(() => {
  wormExpansion.amount = amount;
  useGameStore.setState({ explosionT: amount, wormExplodeActive: amount > 0 });
});
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  wormExpansion.amount = 0; liveCubies.refs = null; liveCubies.size = 0; mesh = null;
  wormBuffs.elementalT = 20; wormBuffs.elementalOrigin = { x: 1, y: 1, z: 5, dirKey: 'PZ' };
  useGameStore.setState({ wormHealerMode: true, wormPaused: false, wormElementalTheme: 'water', wormElementalPartner: null,
    wormExplodeActive: false, explosionT: 0 });
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); mesh?.geometry.dispose(); mesh?.material.dispose(); mesh?.dispose();
  wormExpansion.amount = 0; wormBuffs.elementalT = 0; wormBuffs.elementalOrigin = null;
  liveCubies.refs = null; liveCubies.size = 0; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each(['water', 'fire', 'grass', 'ice', 'lightning', 'steam'])('%s follows every tile through expansion and collapse without restarting its wash', element => {
  const size = 6;
  act(() => root.render(<Harness size={size} element={element === 'steam' ? null : element} recipe={element === 'steam' ? 'steam' : null} />));
  tick(); const originalCount = mesh.count;
  const elapsed = mesh.material.uniforms.uElapsed.value;
  expand(0.01); tick();
  expect(mesh.count).toBe(6 * size * size);
  expect(mesh.material.uniforms.uElapsed.value).toBeGreaterThan(elapsed);
  expect(Array.from(props.cellData.extent).every(v => v === 0.5)).toBe(true);
  expect(props.cellData.sweep.some(v => v > 0)).toBe(true);
  const cells = buildElementalCells(size, size), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const amount of [0.12, 0.35, 0.18, 0.002]) {
    expand(amount); tick();
    cells.forEach((c, i) => {
      mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
      expect(point.distanceTo(new THREE.Vector3(...getWormStickerWorldPos(c.x, c.y, c.z, c.dirKey, size)))).toBeLessThan(1e-6);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).distanceTo(new THREE.Vector3(1, 1, 1))).toBeLessThan(1e-6);
    });
    expect(uCubeHalf.value).toBeCloseTo(elementalHalfExtent(size, amount));
    expect(uCubeGap.value).toBeCloseTo(cubeExpansionScale(size, amount) - 1);
    const claim = mesh.material.uniforms.uClaimOrigin.value;
    expect(claim.z).toBeCloseTo(getWormStickerWorldPos(1, 1, 5, 'PZ', size)[2]);
  }
  const beforeCollapse = mesh.material.uniforms.uElapsed.value;
  expand(0); tick();
  expect(mesh.count).toBe(originalCount);
  expect(mesh.material.uniforms.uElapsed.value).toBeGreaterThan(beforeCollapse);
  expect(uCubeGap.value).toBe(0);
});

it('keeps geometry attached to live expanded slice transforms while the wash clock is paused', () => {
  expand(0.35);
  act(() => root.render(<Harness size={6} element="water" />)); tick();
  const elapsed = mesh.material.uniforms.uElapsed.value;
  const cells = buildElementalCells(6, 6), cell = cells[0];
  const piece = new THREE.Object3D(); piece.position.set(3, 4, 5); piece.rotation.y = 0.7;
  liveCubies.size = 6; liveCubies.refs = [];
  liveCubies.refs[cell.x * 36 + cell.y * 6 + cell.z] = piece;
  act(() => useGameStore.setState({ wormPaused: true })); tick();
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
  const expected = new THREE.Vector3(1, 0, 0).applyQuaternion(piece.quaternion).multiplyScalar(0.52).add(piece.position);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(expected)).toBeLessThan(1e-6);
  expect(mesh.material.uniforms.uElapsed.value).toBe(elapsed);
});

it.each([3, 6, 15])('emits fusion particles from separated tiles, not from the closed cube or gaps (%i)', size => {
  let seed = 7;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const field = makeReactionField(100), expansion = 0.35;
  stepReactionField(field, 0, { cfg: REACTION_PARTICLES.steam, size, expansion, rand });
  const h = elementalHalfExtent(size, expansion), spacing = cubeExpansionScale(size, expansion);
  for (let i = 0; i < field.count; i++) {
    const p = Array.from(field.pos.slice(i * 3, i * 3 + 3));
    const axis = p.findIndex(v => Math.abs(Math.abs(v) - h - 0.06) < 1e-5);
    expect(axis).toBeGreaterThanOrEqual(0);
    p.forEach((v, j) => {
      if (j === axis) return;
      const nearest = Math.round(v / spacing + (size - 1) / 2) - (size - 1) / 2;
      expect(Math.abs(v - nearest * spacing)).toBeLessThanOrEqual(0.50001);
    });
  }
});

it('keeps split-cell detail within the existing large-board budget', () => {
  for (const size of [3, 6, 15]) for (const mobile of [false, true]) {
    const base = resolveElementalQuality({ cubeSize: size, mobile });
    const split = expandedElementalQuality(base, size, true);
    expect(split.skinGrid).toBe(size);
    expect(split.cellDetail * size * size).toBeLessThanOrEqual(base.skinGrid ** 2);
    expect(split.flamesPerCell * size * size).toBeLessThanOrEqual(Math.max(size * size, base.flamesPerCell * base.skinGrid ** 2));
  }
});
