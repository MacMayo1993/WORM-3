import * as THREE from 'three';
import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { FACE_COLORS } from '../utils/constants.js';
import { CORE_MIRROR_HALF, makeCorePassage } from '../3d/corePassage.js';
import { createCoreMirrorRoom, createCoreReflection } from '../3d/coreMirrorRoom.js';

it('faces every mirror inward and bounds the tile cost on larger boards', () => {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const size of [2, 3, 6, 15]) {
    const room = createCoreMirrorRoom(size, makeCorePassage().uniforms, null);
    try {
      expect(room.group.children).toHaveLength(2);
      const tiles = room.group.getObjectByName('anticube-mirror-tiles');
      expect(tiles.count).toBeLessThanOrEqual(216);
      const faces = new Set();
      for (let i = 0; i < tiles.count; i++) {
        tiles.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        normal.set(0, 0, 1).transformDirection(matrix);
        expect(normal.dot(position)).toBeCloseTo(-CORE_MIRROR_HALF);
        expect(Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z))).toBeCloseTo(CORE_MIRROR_HALF);
        faces.add(normal.toArray().map(n => Math.round(n)).join(','));
      }
      expect(faces.size).toBe(6);
    } finally { room.dispose(); }
  }
});

it('reflects committed sticker colors and custom palettes without scene captures', () => {
  const cubies = makeCubies(3);
  const before = createCoreReflection(cubies, 3, FACE_COLORS);
  cubies[2][1][1].stickers.PX.curr = 1;
  const after = createCoreReflection(cubies, 3, { ...FACE_COLORS, 1: '#ff0077' });
  try {
    const pixel = texture => {
      const image = texture.image[0].image;
      const center = (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4;
      return Array.from(image.data.slice(center, center + 4));
    };
    expect(after.isCubeTexture).toBe(true);
    expect(after.isRenderTargetTexture).toBe(false);
    expect(after.image).toHaveLength(6);
    expect(pixel(after)[0]).toBeGreaterThan(pixel(before)[0]);
    expect(pixel(after)[2]).toBeLessThan(pixel(before)[2]);
    expect(pixel(after)[3]).toBe(255);
    // Changing one +X tile leaves the -X snapshot intact.
    expect(after.image[1].image.data).toEqual(before.image[1].image.data);
  } finally { before.dispose(); after.dispose(); }
});
