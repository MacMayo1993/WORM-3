import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSurfaceBatches } from '../3d/surfaceBatches.js';

it.each([6, 10])('batches all tile backs on a size-%s cube with live colours, transforms and hidden ancestry', size => {
  const scene = new THREE.Group(), layer = new THREE.Group(), batchParent = new THREE.Group();
  scene.add(layer, batchParent);
  const pool = createSurfaceBatches(); batchParent.add(pool.group);
  const geometry = new THREE.PlaneGeometry(), material = new THREE.MeshStandardMaterial();
  const anchors = [], colors = [], release = [];
  for (let i = 0; i < 6 * size * size; i++) {
    const anchor = new THREE.Group(); anchor.position.set(i % size, Math.floor(i / size) % size, Math.floor(i / size / size));
    anchor.rotation.y = Math.PI; anchor.scale.set(.8, .8, 1); layer.add(anchor); anchors.push(anchor);
    colors.push({ current: i % 2 ? '#ff0000' : '#0000ff' });
    release.push(pool.register(anchor, geometry, material, colors[i]));
  }
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  const check = (mesh, source, slot) => {
    scene.updateMatrixWorld(true);
    mesh.getMatrixAt(slot, matrix); matrix.premultiply(mesh.matrixWorld);
    matrix.elements.forEach((x, i) => expect(x).toBeCloseTo(source.matrixWorld.elements[i], 5));
  };
  pool.update();
  expect(pool.group.children).toHaveLength(1);
  const mesh = pool.group.children[0];
  expect(mesh.count).toBe(6 * size * size);
  check(mesh, anchors[10], 10);
  const version = mesh.instanceMatrix.version;
  pool.update(); expect(mesh.instanceMatrix.version).toBe(version);
  // Active layer turns, raised pieces, explosion and transformed batch parents.
  for (const angle of [.2, .9, Math.PI / 2, 0]) {
    layer.rotation.x = angle; layer.position.multiplyScalar(1.2); anchors[10].position.z += .355;
    batchParent.position.x += .2; batchParent.rotation.z += .1;
    pool.update(); check(mesh, anchors[10], 10);
  }
  colors[10].current = '#00ff00'; pool.update(); mesh.getColorAt(10, color);
  expect(color.getHex()).toBe(0x00ff00);
  anchors[0].visible = false; pool.update();
  expect(mesh.count).toBe(6 * size * size - 1); check(mesh, anchors[10], 9);
  anchors[0].visible = true; pool.update(); check(mesh, anchors[10], 10);
  layer.visible = false; pool.update(); expect(mesh.visible).toBe(false); expect(mesh.count).toBe(0);
  layer.visible = true; pool.update(); expect(mesh.visible).toBe(true); check(mesh, anchors[10], 10);
  release[0](); pool.update(); check(mesh, anchors[10], 9);
  const geoDispose = vi.spyOn(geometry, 'dispose'), matDispose = vi.spyOn(material, 'dispose');
  pool.dispose(); expect(geoDispose).not.toHaveBeenCalled(); expect(matDispose).not.toHaveBeenCalled();
  // React's StrictMode effect replay can reuse the manager after cleanup.
  pool.update(); expect(pool.group.children[0].count).toBe(6 * size * size - 1);
  release.forEach(fn => fn()); pool.dispose(); geometry.dispose(); material.dispose();
});

it('retains individual tile frustum culling and restores tiles for a second camera', () => {
  const scene = new THREE.Group(), pool = createSurfaceBatches(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  scene.add(pool.group);
  const geometry = new THREE.PlaneGeometry(), material = new THREE.MeshBasicMaterial();
  for (const x of [0, 20]) {
    const anchor = new THREE.Group(); anchor.position.set(x, 0, -5); scene.add(anchor);
    pool.register(anchor, geometry, material);
  }
  pool.update(camera); const mesh = pool.group.children[0]; expect(mesh.count).toBe(1);
  pool.update(); expect(mesh.count).toBe(2);
  camera.lookAt(20, 0, -5); pool.update(camera); expect(mesh.count).toBe(1);
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix); expect(matrix.elements[12]).toBe(20);
  camera.lookAt(0, 0, 5); pool.update(camera); expect(mesh.visible).toBe(false);
  camera.lookAt(0, 0, -5); pool.update(camera); expect(mesh.visible).toBe(true);
  pool.dispose(); geometry.dispose(); material.dispose();
});
