import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { buildCautionPerimeter, cautionPointInto } from '../worm/healerWorm/cautionPerimeter.js';
import { WORM_CAUTION_TAPE_TOP } from '../game/raisedCubie.js';
import { getStickerWorldPos } from '../game/coordinates.js';

function raised(cubies, x, y, z, dirKey) {
  cubies[x][y][z].stickers[dirKey].flips = 1;
  return { x, y, z, dirKey };
}
function expectClosed(perimeter) {
  const degree = new Map();
  for (const { a, b } of perimeter.edges) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  expect([...degree.values()].every(n => n === 2)).toBe(true);
  expect(degree.size).toBe(perimeter.posts.length);
}

describe('raised opening caution perimeter', () => {
  it.each([2, 3, 6, 15])('wraps all eight corners on a %i cube without fencing their internal seams', size => {
    for (const x of [0, size - 1]) for (const y of [0, size - 1]) for (const z of [0, size - 1]) {
      const cubies = makeCubies(size);
      const tile = raised(cubies, x, y, z, x ? 'PX' : 'NX');
      const p = buildCautionPerimeter([tile], cubies, size, 6);
      const dirs = [x ? 'PX' : 'NX', y ? 'PY' : 'NY', z ? 'PZ' : 'NZ'];
      expect(p.faces.map(f => f.dirKey).sort()).toEqual(dirs.sort());
      expect(p.edges).toHaveLength(6);
      expect(p.posts).toHaveLength(6);
      expectClosed(p);
      for (const dir of dirs) expect(p.edges.filter(e => e.face.dirKey === dir)).toHaveLength(2);
      for (const expansion of [0, 0.3]) for (const edge of p.edges) {
        const n = new THREE.Vector3();
        n.setComponent('XYZ'.indexOf(edge.face.dirKey[1]), edge.face.dirKey[0] === 'P' ? 1 : -1);
        const floor = new THREE.Vector3().fromArray(getStickerWorldPos(x, y, z, edge.face.dirKey, size, expansion));
        for (const vertex of [edge.a, edge.b]) {
          const top = cautionPointInto(new THREE.Vector3(), vertex, size, expansion, WORM_CAUTION_TAPE_TOP);
          expect(top.sub(floor).dot(n)).toBeCloseTo(WORM_CAUTION_TAPE_TOP, 10);
        }
      }
    }
  });

  it('wraps both faces of an edge cubie and keeps four sides for a face-center opening', () => {
    for (const [x, y, z, faces, edges] of [[2, 2, 1, 2, 6], [2, 1, 1, 1, 4]]) {
      const cubies = makeCubies(3), tile = raised(cubies, x, y, z, 'PX');
      const p = buildCautionPerimeter([tile], cubies, 3, 6);
      expect(p.faces).toHaveLength(faces); expect(p.edges).toHaveLength(edges);
      expectClosed(p);
    }
  });

  it('does not duplicate posts or tape when multiple stickers on one corner are flipped', () => {
    const cubies = makeCubies(3);
    const positions = ['PX', 'PY', 'PZ'].map(dir => raised(cubies, 2, 2, 2, dir));
    const p = buildCautionPerimeter(positions, cubies, 3, 6);
    expect(p.faces).toHaveLength(3); expect(p.posts).toHaveLength(6); expect(p.edges).toHaveLength(6);
    expectClosed(p);
  });

  it('removes the shared fence between neighboring openings', () => {
    const cubies = makeCubies(6);
    const positions = [raised(cubies, 2, 2, 5, 'PZ'), raised(cubies, 3, 2, 5, 'PZ')];
    const p = buildCautionPerimeter(positions, cubies, 6, 6);
    expect(p.edges).toHaveLength(6); expectClosed(p);
  });

  it('keeps a closed/void warning on its actual face without inventing raised faces', () => {
    const cubies = makeCubies(3), tile = { x: 2, y: 2, z: 2, dirKey: 'PZ' };
    cubies[2][2][2].stickers.PZ.flips = 6;
    const p = buildCautionPerimeter([tile], cubies, 3, 6);
    expect(p.faces).toHaveLength(1); expect(p.edges).toHaveLength(4);
    expectClosed(p);
    expect(buildCautionPerimeter([], cubies, 3, 6).edges).toHaveLength(0);
  });
});
