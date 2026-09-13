import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createWorldTransformTracker } from '../3d/worldTransformTracker.js';
import { createOrbBatches } from '../worm/orbBatches.js';
import { borrowPreviewCanvas, registerDirectWormPreview, unregisterDirectWormPreview, getDirectWormPreview } from '../3d/directWormPreview.js';

describe('changed sticker ancestry', () => {
  it('matches Three world transforms through rotation, flip scale and reparenting', () => {
    const root = new THREE.Group(), layer = new THREE.Group(), sticker = new THREE.Group();
    root.add(layer); layer.add(sticker); sticker.position.set(2, 3, 4);
    const tracker = createWorldTransformTracker();
    const check = () => {
      tracker.begin(); tracker.update(sticker);
      const actual = sticker.matrixWorld.clone();
      sticker.updateWorldMatrix(true, false);
      expect(actual.elements).toEqual(sticker.matrixWorld.elements);
    };
    check(); layer.rotation.y = 0.7; check(); sticker.scale.y = 0.03; check();
    root.attach(sticker); check(); root.position.x = 9; check();
    sticker.matrixAutoUpdate = false; sticker.matrix.makeTranslation(5, 6, 7); check();
  });
  it('leaves idle versions unchanged and only recomposes changed ancestry', () => {
    const root = new THREE.Group(), a = new THREE.Group(), b = new THREE.Group(); root.add(a, b);
    const tracker = createWorldTransformTracker(); tracker.begin();
    const av = tracker.update(a), bv = tracker.update(b);
    const compose = vi.spyOn(root, 'updateMatrix');
    tracker.begin(); expect(tracker.update(a)).toBe(av); expect(tracker.update(b)).toBe(bv);
    expect(compose).not.toHaveBeenCalled();
    a.position.x = 1; tracker.begin(); expect(tracker.update(a)).not.toBe(av); expect(tracker.update(b)).toBe(bv);
    root.rotation.z = 1; tracker.begin(); tracker.update(a); tracker.update(b);
    expect(compose).toHaveBeenCalledTimes(1);
  });
});

describe('opaque parity batches', () => {
  it('preserves world transforms, supports all poles and drops absent instances', () => {
    const root = new THREE.Group(); root.position.x = 3; root.rotation.z = 0.4;
    const geometry = new THREE.SphereGeometry(), material = new THREE.MeshStandardMaterial();
    const batch = createOrbBatches(); root.add(batch.group);
    const source = new THREE.Mesh(geometry, material); root.add(source); source.position.y = 2;
    root.updateWorldMatrix(true, true); batch.begin(root);
    for (let i = 0; i < 192; i++) batch.add(source);
    batch.end(); expect(batch.group.children).toHaveLength(1);
    const mesh = batch.group.children[0]; expect(mesh.count).toBe(192);
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix); matrix.premultiply(root.matrixWorld);
    matrix.elements.forEach((n, i) => expect(n).toBeCloseTo(source.matrixWorld.elements[i], 6));
    batch.begin(root); batch.end(); expect(mesh.count).toBe(0);
    const geoDispose = vi.spyOn(geometry, 'dispose'), matDispose = vi.spyOn(material, 'dispose');
    batch.dispose(); expect(geoDispose).not.toHaveBeenCalled(); expect(matDispose).not.toHaveBeenCalled();
  });
  it('keeps separate materials separate and rejects transparent parts', () => {
    const batch = createOrbBatches(), root = new THREE.Group(), geometry = new THREE.SphereGeometry();
    batch.begin(root);
    batch.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 'red' })));
    batch.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 'blue' })));
    expect(batch.group.children).toHaveLength(2);
    expect(() => batch.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true })))).toThrow();
    batch.dispose();
  });
});

describe('direct preview ownership', () => {
  it('restores the original canvas before removing the preview and ignores stale cleanup', () => {
    const parent = document.createElement('div'), host = document.createElement('div');
    const canvas = document.createElement('canvas'), sibling = document.createElement('span');
    canvas.style.width = '900px'; parent.append(canvas, sibling);
    const first = registerDirectWormPreview(host, {});
    first.release = borrowPreviewCanvas(canvas, host);
    expect(host.firstChild).toBe(canvas);
    const second = registerDirectWormPreview(host, {});
    expect(parent.firstChild).toBe(canvas); expect(canvas.nextSibling).toBe(sibling);
    expect(canvas.style.width).toBe('900px');
    unregisterDirectWormPreview(first); expect(getDirectWormPreview()).toBe(second);
    unregisterDirectWormPreview(second); expect(getDirectWormPreview()).toBeNull();
  });
});
