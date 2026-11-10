import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { addMirrorSubject, createMirrorCaptureScene, MIRROR_LAYER } from '../3d/mirrorSubjects.js';

it('projects only reflected subjects and lights, without reparenting the live scene', () => {
  const source = new THREE.Scene(), parent = new THREE.Group(), room = new THREE.Group();
  const worm = new THREE.Group(), bead = new THREE.Mesh(), scenery = new THREE.Group();
  const light = new THREE.DirectionalLight(), mirror = new THREE.Mesh();
  room.add(mirror); worm.add(bead); parent.add(room, worm, light); source.add(parent, scenery);
  mirror.layers.enable(MIRROR_LAYER);
  for (let i = 0; i < 10000; i++) scenery.add(new THREE.Object3D());
  parent.position.set(1, 2, 3); parent.rotation.y = .4; parent.scale.setScalar(2);
  worm.position.set(.1, .2, .3); bead.position.set(.2, .3, .4);
  source.updateMatrixWorld(true);
  const children = [...parent.children], beadMatrix = bead.matrixWorld.clone();
  const updateScenery = vi.spyOn(scenery, 'updateMatrixWorld');
  const updateSceneryWorld = vi.spyOn(scenery, 'updateWorldMatrix');
  const remove = addMirrorSubject(worm), capture = createMirrorCaptureScene();
  try {
    const reflected = capture.sync(source, room), seen = [];
    const lightPosition = light.matrixWorld.elements[12];
    reflected.traverse(object => seen.push(object));
    expect(seen).toEqual([reflected, room, mirror, worm, bead, light]);
    expect(parent.children).toEqual(children);
    expect(room.parent).toBe(parent); expect(worm.parent).toBe(parent); expect(light.parent).toBe(parent);
    expect(bead.matrixWorld.equals(beadMatrix)).toBe(true);
    expect(bead.layers.isEnabled(MIRROR_LAYER)).toBe(true);
    expect(reflected.matrixWorldAutoUpdate).toBe(false);
    expect(updateScenery).not.toHaveBeenCalled(); expect(updateSceneryWorld).not.toHaveBeenCalled();
    // Moving ancestors still moves the reflection, without visiting their siblings.
    parent.position.x += 3;
    capture.sync(source, room);
    expect(bead.matrixWorld.elements[12]).toBeCloseTo(beadMatrix.elements[12] + 3);
    expect(light.matrixWorld.elements[12]).toBeCloseTo(lightPosition + 3);
    expect(updateScenery).not.toHaveBeenCalled(); expect(updateSceneryWorld).not.toHaveBeenCalled();
  } finally { remove(); capture.dispose(); }
});

it('preserves visibility, changing lights and scene program inputs without duplicate nested subjects', () => {
  const source = new THREE.Scene(), room = new THREE.Group(), worm = new THREE.Group();
  const hiddenParent = new THREE.Group(), hiddenWorm = new THREE.Group(), nested = new THREE.Group();
  const hiddenLight = new THREE.PointLight(), nestedLight = new THREE.PointLight();
  hiddenParent.visible = false; hiddenParent.add(hiddenWorm, hiddenLight);
  nested.add(nestedLight); worm.add(nested); source.add(room, worm, hiddenParent);
  const remove = [addMirrorSubject(worm), addMirrorSubject(nested), addMirrorSubject(hiddenWorm)];
  const capture = createMirrorCaptureScene();
  try {
    source.background = new THREE.Color('red'); source.environment = new THREE.Texture();
    source.fog = new THREE.Fog('blue', 1, 10); source.overrideMaterial = new THREE.MeshBasicMaterial();
    source.backgroundBlurriness = .2; source.backgroundIntensity = .4;
    const reflected = capture.sync(source, room);
    expect(reflected.children).toEqual([room, worm]);
    for (const key of ['background', 'backgroundBlurriness', 'backgroundIntensity', 'environment', 'fog', 'overrideMaterial']) {
      expect(reflected[key]).toBe(source[key]);
    }
    // Hidden lights are still tagged for warm-up, but cannot illuminate a capture.
    expect(hiddenLight.layers.isEnabled(MIRROR_LAYER)).toBe(true);
    const mountedBead = new THREE.Mesh(), mountedLight = new THREE.SpotLight();
    worm.add(mountedBead); source.add(mountedLight, mountedLight.target);
    mountedLight.target.position.set(2, 3, 4);
    hiddenParent.visible = true; worm.visible = false; source.fog = null;
    capture.sync(source, room);
    expect(reflected.children).toEqual([room, hiddenWorm, hiddenLight, mountedLight]);
    expect(mountedBead.layers.isEnabled(MIRROR_LAYER)).toBe(true);
    expect(mountedLight.target.matrixWorld.elements.slice(12, 15)).toEqual([2, 3, 4]);
    expect(reflected.fog).toBe(null);
    source.remove(hiddenParent);
    capture.sync(source, room);
    expect(reflected.children).toEqual([room, mountedLight]);
    source.visible = false;
    capture.sync(source, room);
    expect(reflected.visible).toBe(false);
  } finally { remove.forEach(dispose => dispose()); capture.dispose(); }
});

it('respects externally maintained world matrices and releases only borrowed references', () => {
  const source = new THREE.Scene(), room = new THREE.Group(), worm = new THREE.Mesh();
  source.add(room, worm); source.matrixWorldAutoUpdate = false;
  worm.matrixWorld.makeTranslation(9, 8, 7);
  const remove = addMirrorSubject(worm), capture = createMirrorCaptureScene();
  try {
    capture.sync(source, room);
    expect(worm.matrixWorld.elements.slice(12, 15)).toEqual([9, 8, 7]);
    capture.dispose();
    expect(capture.scene.children).toHaveLength(0);
    expect(worm.parent).toBe(source); expect(source.children).toEqual([room, worm]);
  } finally { remove(); capture.dispose(); }
});
