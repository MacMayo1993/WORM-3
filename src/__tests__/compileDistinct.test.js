import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { compileDistinct, distinctProgramObjects } from '../3d/compileDistinct.js';

// The run's warm-up compiles one stand-in per program variant instead of every
// object: a 15×15 scene is ~17,000 objects over a few hundred materials.
describe('compileDistinct', () => {
  const geometry = new THREE.PlaneGeometry();
  const scene = () => {
    const root = new THREE.Scene(), shared = new THREE.MeshStandardMaterial(), other = new THREE.MeshBasicMaterial();
    const tiles = new THREE.Group();
    for (let i = 0; i < 50; i++) tiles.add(new THREE.Mesh(i % 2 ? geometry : new THREE.PlaneGeometry(), shared));
    const hidden = new THREE.Mesh(geometry, other); hidden.visible = false;
    const batch = new THREE.InstancedMesh(geometry, shared, 4);
    const coloured = new THREE.InstancedMesh(geometry, shared, 4); coloured.setColorAt(0, new THREE.Color());
    const vertexColours = new THREE.PlaneGeometry().setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(16), 4));
    const rgba = new THREE.Mesh(vertexColours, shared);
    const pair = new THREE.Mesh(geometry, [shared, other]);
    root.add(tiles, hidden, batch, coloured, rgba, pair, new THREE.Points(geometry, new THREE.PointsMaterial()));
    return { root, tiles, hidden, batch, coloured, rgba, pair };
  };

  it('keeps one object per material and object/geometry variant, hidden ones included', () => {
    const { root, tiles, hidden, batch, coloured, rgba, pair } = scene();
    const chosen = distinctProgramObjects(root);
    // Fifty plain tiles share one program; instancing, an instance colour buffer and
    // RGBA vertex colours each change it, and so does a material of a hidden mesh.
    // The two-material mesh brings no variant the others have not.
    expect(chosen).toContain(tiles.children[0]);
    expect(chosen.filter(o => tiles.children.includes(o))).toHaveLength(1);
    for (const object of [hidden, batch, coloured, rgba]) expect(chosen).toContain(object);
    expect(chosen).not.toContain(pair);
    expect(chosen.filter(o => o.isPoints)).toHaveLength(1);
    expect(chosen).toHaveLength(6);
  });

  it('compiles stand-ins that read through their objects and never walk a subtree twice', () => {
    const { root, tiles } = scene();
    tiles.children[0].add(new THREE.Mesh(geometry, new THREE.MeshPhongMaterial()));
    const seen = [];
    const renderer = { compile: vi.fn((holder, _camera, target) => {
      expect(target).toBe(root);
      holder.traverse(o => { if (o.material) seen.push(o); });
    }) };
    compileDistinct(renderer, root, new THREE.PerspectiveCamera(), root);
    const materials = new Set(seen.flatMap(o => (Array.isArray(o.material) ? o.material : [o.material])));
    const all = new Set();
    root.traverse(o => { if (o.material) for (const m of [o.material].flat()) all.add(m); });
    expect(materials).toEqual(all);
    // A stand-in carries its object's flags, buffers and geometry, on the
    // object's class prototype: a live object made a prototype keeps a V8 map of
    // its own for good, which turned every later walk of the scene megamorphic.
    const objects = distinctProgramObjects(root);
    seen.forEach((standIn, i) => {
      const object = objects[i];
      expect(standIn).not.toBe(object);
      expect(Object.getPrototypeOf(standIn)).toBe(Object.getPrototypeOf(object));
      expect(standIn.material).toBe(object.material);
      expect(standIn.isInstancedMesh).toBe(object.isInstancedMesh);
      expect(standIn.instanceColor).toBe(object.instanceColor);
      expect(standIn.geometry).toBe(object.geometry);
      expect(standIn.children).toHaveLength(0);
    });
    expect(seen.length).toBe(objects.length);
    // The live scene is untouched: its subtree still hangs where it did.
    expect(tiles.children[0].children).toHaveLength(1);
  });
});
