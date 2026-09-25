import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ART_RECIPES, artworkCubeState, buildPuzzle, buildArtwork } from '../../scripts/carousel-art/model.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { DIR_TO_VEC } from '../utils/constants.js';

const modes = Object.keys(ART_RECIPES).filter(id => !ART_RECIPES[id].gift);
it.each(modes)('%s art uses a solvable 3×3 state with nine stickers of each color', id => {
  const state = artworkCubeState(id);
  const stickers = state.flat(2).flatMap(c => Object.values(c.stickers));
  expect(stickers).toHaveLength(54);
  for (let color = 1; color <= 6; color++) expect(stickers.filter(s => s.curr === color)).toHaveLength(9);
  const solved = [...ART_RECIPES[id].moves].reverse().reduce((cube, [axis, slice, dir]) =>
    rotateSliceCubies(cube, 3, axis, slice, -dir), state);
  expect(solved).toEqual(makeCubies(3));
});
it.each(modes)('%s render preserves the sticker faces and cubie geometry', id => {
  const state = artworkCubeState(id), puzzle = buildPuzzle(id);
  let cells = 0, stickers = 0;
  puzzle.traverse(node => {
    if (node.name !== 'cubie') return;
    cells++;
    const [x, y, z] = node.userData.cell;
    expect(node.position.toArray()).toEqual([x - 1, y - 1, z - 1]);
    const visible = node.children.filter(mesh => mesh.name === 'sticker');
    expect(visible).toHaveLength(Object.keys(state[x][y][z].stickers).length);
    for (const mesh of visible) {
      stickers++;
      const { face, color } = mesh.userData;
      expect(color).toBe(state[x][y][z].stickers[face].curr);
      expect(new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion).distanceTo(new Vector3(...DIR_TO_VEC[face]))).toBeLessThan(1e-8);
      expect(mesh.position.clone().normalize().distanceTo(new Vector3(...DIR_TO_VEC[face]))).toBeLessThan(1e-8);
    }
  });
  expect(cells).toBe(26); expect(stickers).toBe(54);
  const layer = puzzle.getObjectByName('turning-layer');
  expect(layer.children.length).toBe(id === 'chaos' ? 9 : 0);
  if (id === 'chaos') expect(layer.rotation.y).toBeCloseTo(Math.PI / 6);
});
it('gives Store a gift box instead of an invented puzzle configuration', () => {
  expect(artworkCubeState('store')).toBeNull();
  expect(buildArtwork('store').getObjectByName('legal-puzzle')).toBeUndefined();
});
