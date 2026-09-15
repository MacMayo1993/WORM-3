import { expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { presentMenuCube } from '../components/menus/menuCarouselState.js';

it.each(['x', 'y', 'z'])('hides a paused %s slice behind the carousel, then restores the menu scene', axis => {
  const root = new Group(), shuffling = new Group(), slice = new Group(), plates = new Group();
  const geometry = new BoxGeometry(.93, .93, .93), material = new MeshBasicMaterial();
  const cubie = new Mesh(geometry, material);
  // A corner of the middle layer protrudes beyond the 1.56 mode-plate edge
  // during a partial turn, reproducing the geometry visible in the report.
  cubie.position.set(axis === 'x' ? 0 : 1, axis === 'y' ? 0 : 1, axis === 'z' ? 0 : 1);
  slice.add(cubie); shuffling.add(slice); root.add(shuffling, plates);
  slice.rotation[axis] = Math.PI / 4;
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(slice);
  expect(Math.max(bounds.max.x, bounds.max.y, bounds.max.z)).toBeGreaterThan(1.56);
  const frozenPose = slice.quaternion.clone();
  for (const active of [true, true, false, true, false]) {
    presentMenuCube(shuffling, plates, active);
    const visible = [];
    root.traverseVisible(node => { if (node.isMesh) visible.push(node); });
    expect(visible.includes(cubie)).toBe(!active);
    expect(plates.visible).toBe(active);
    expect(slice.quaternion.equals(frozenPose)).toBe(true);
  }
  geometry.dispose(); material.dispose();
});
