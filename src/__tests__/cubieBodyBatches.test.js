import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCubieBodyBatches } from '../3d/cubieBodyBatches.js';
import { cubieBodyGeometry } from '../3d/cubieBodyGeometry.js';
import { createWorldTransformTracker } from '../3d/worldTransformTracker.js';

const LOOK = { color: '#141416', roughness: 0.34, metalness: 0, envMapIntensity: 0.25, transparent: true, opacity: 0.8,
  depthWrite: true, side: THREE.DoubleSide };

function board(size) {
  const scene = new THREE.Group(), exterior = new THREE.Group(), items = new THREE.Group();
  scene.add(exterior); exterior.add(items);
  const pool = createCubieBodyBatches(); exterior.add(pool.group);
  const geometry = cubieBodyGeometry(0.92), anchors = [], release = [];
  const k = (size - 1) / 2;
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
    if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
    // Cubie: pop group > piece (position, rotated by slice turns) > content scale > invisible body anchor.
    const pop = new THREE.Group(), piece = new THREE.Group(), content = new THREE.Group();
    const anchor = new THREE.Mesh(geometry); anchor.visible = false;
    piece.position.set(x - k, y - k, z - k);
    items.add(pop); pop.add(piece); piece.add(content); content.add(anchor);
    anchors.push(anchor); release.push(pool.register(anchor, geometry, LOOK));
  }
  return { scene, exterior, items, pool, anchors, release };
}

it.each([3, 10])('draws every WORM shell on a size-%s board as one instanced look, following live transforms', size => {
  const { scene, items, pool, anchors } = board(size);
  pool.update();
  expect(pool.group.children).toHaveLength(1);
  const mesh = pool.group.children[0];
  expect(mesh.isInstancedMesh).toBe(true);
  expect(mesh.count).toBe(size ** 3 - Math.max(0, size - 2) ** 3);
  // Same material path three.js takes for the individual shells: transparent and
  // double-sided, so it still draws back faces before front faces.
  expect(mesh.material.transparent).toBe(true);
  expect(mesh.material.side).toBe(THREE.DoubleSide);
  expect(mesh.material.opacity).toBeCloseTo(0.8);
  expect(mesh.renderOrder).toBe(-1);
  const matrix = new THREE.Matrix4();
  const check = (slot, anchor) => {
    scene.updateMatrixWorld(true);
    mesh.getMatrixAt(slot, matrix); matrix.premultiply(mesh.matrixWorld);
    matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(anchor.matrixWorld.elements[i], 5));
  };
  check(5, anchors[5]);
  // A slice turn, a raised piece and an expanded board all move the shells.
  anchors[5].parent.parent.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.4);
  anchors[5].parent.parent.parent.position.set(0, 0.355, 0);
  items.scale.setScalar(1.2);
  pool.update(); check(5, anchors[5]);
  pool.dispose();
});

it('writes instances far to near from the camera and culls shells outside the view', () => {
  const { pool, anchors } = board(3);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0);
  pool.update(camera);
  const mesh = pool.group.children[0];
  const depth = new THREE.Vector3(), forward = camera.getWorldDirection(new THREE.Vector3()), m = new THREE.Matrix4();
  let previous = Infinity;
  for (let slot = 0; slot < mesh.count; slot++) {
    mesh.getMatrixAt(slot, m);
    const d = depth.setFromMatrixPosition(m).sub(camera.position).dot(forward);
    expect(d).toBeLessThanOrEqual(previous + 1e-9);
    previous = d;
  }
  // Turn the camera away from the cube: nothing left to draw.
  camera.lookAt(0, 0, 20); pool.update(camera);
  expect(mesh.count).toBe(0);
  expect(mesh.visible).toBe(false);
  // Without a camera (picture-in-picture views), every shell is kept.
  pool.update(); expect(mesh.count).toBe(anchors.length);
  pool.dispose();
});

it('hides shells under a hidden ancestor, drops released pieces and keeps one batch per look', () => {
  const { exterior, items, pool, anchors, release } = board(3);
  pool.update();
  const mesh = pool.group.children[0];
  anchors[0].parent.parent.visible = false; pool.update();
  expect(mesh.count).toBe(anchors.length - 1);
  items.visible = false; pool.update();
  expect(mesh.count).toBe(0);
  items.visible = true; anchors[0].parent.parent.visible = true;
  release[1](); pool.update();
  expect(mesh.count).toBe(anchors.length - 1);
  // A second look (the neon body of a flipped piece) gets its own batch; the
  // same look registered again shares the first.
  const neon = new THREE.Mesh(); exterior.add(neon);
  pool.register(neon, cubieBodyGeometry(0.92), { ...LOOK, color: '#08080c', emissive: '#0a0014' });
  pool.register(anchors[1], cubieBodyGeometry(0.92), { ...LOOK });
  pool.update();
  expect(pool.group.children).toHaveLength(2);
  expect(mesh.count).toBe(anchors.length);
  pool.setShadows(true);
  expect(pool.group.children.every(child => child.castShadow && child.receiveShadow)).toBe(true);
  const dispose = vi.spyOn(mesh.material, 'dispose');
  pool.dispose();
  expect(dispose).toHaveBeenCalled();
  expect(pool.group.children).toHaveLength(0);
});

it('routes each look through the cube\'s material wrapper (the portal bore)', () => {
  const wrapped = [];
  const pool = createCubieBodyBatches(64, material => { wrapped.push(material); material.userData.bored = true; return material; });
  const parent = new THREE.Group(), anchor = new THREE.Mesh(); parent.add(anchor, pool.group);
  pool.register(anchor, cubieBodyGeometry(0.92), LOOK);
  expect(wrapped).toHaveLength(1);
  expect(pool.group.children[0].material.userData.bored).toBe(true);
  pool.dispose();
});

it('tracks world transforms and visibility once per frame from the same cache', () => {
  const tracker = createWorldTransformTracker();
  const root = new THREE.Group(), child = new THREE.Group(), leaf = new THREE.Group();
  root.add(child); child.add(leaf); leaf.position.set(1, 2, 3);
  tracker.begin();
  const first = tracker.update(leaf);
  expect(leaf.matrixWorld.elements[12]).toBe(1);
  tracker.begin();
  expect(tracker.update(leaf)).toBe(first);
  child.position.x = 5;
  tracker.begin();
  expect(tracker.update(leaf)).not.toBe(first);
  expect(leaf.matrixWorld.elements[12]).toBe(6);
  expect(tracker.visible(leaf)).toBe(true);
  child.visible = false;
  // Cached for the frame...
  expect(tracker.visible(leaf)).toBe(true);
  // ...and re-read on the next one.
  tracker.begin();
  expect(tracker.visible(leaf)).toBe(false);
  expect(tracker.visible(null)).toBe(true);
});
