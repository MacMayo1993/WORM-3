import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CORE_MIRROR_HALF, makeCorePassage } from '../3d/corePassage.js';
import { createCoreMirrorRoom, createCoreMirrorProbe, coreMirrorTileKeys } from '../3d/coreMirrorRoom.js';

it('lines every wall with the core face grid, each mirror facing in over its own sticker', () => {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const size of [2, 3, 6, 15]) {
    const room = createCoreMirrorRoom(size, makeCorePassage().uniforms);
    try {
      expect(room.group.children).toHaveLength(2);
      const tiles = room.group.getObjectByName('anticube-mirror-tiles');
      expect(tiles.count).toBe(6 * size * size);
      const keys = coreMirrorTileKeys(size);
      expect(new Set(keys).size).toBe(keys.length);
      const pitch = CORE_MIRROR_HALF * 2 / size;
      for (let i = 0; i < tiles.count; i++) {
        tiles.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        normal.set(0, 0, 1).transformDirection(matrix);
        expect(normal.dot(position)).toBeCloseTo(-CORE_MIRROR_HALF);
        // The mirror sits behind the sticker its key names: same face, same cell.
        const [x, y, z, dirKey] = keys[i].split(',');
        const grid = [Number(x), Number(y), Number(z)];
        const axis = 'XYZ'.indexOf(dirKey[1]);
        expect(Math.sign(position.getComponent(axis))).toBe(dirKey[0] === 'P' ? 1 : -1);
        for (const other of [0, 1, 2].filter(a => a !== axis)) {
          expect(position.getComponent(other)).toBeCloseTo((grid[other] + .5) * pitch - CORE_MIRROR_HALF);
        }
      }
    } finally { room.dispose(); }
  }
});

it('stains each mirror with the colour of the core sticker it sits behind', () => {
  const size = 3, room = createCoreMirrorRoom(size, makeCorePassage().uniforms);
  try {
    const keys = coreMirrorTileKeys(size);
    const stickerIndex = new Map(keys.map((key, i) => [key, keys.length - 1 - i]));
    const rgb = new Float32Array(keys.length * 3).map((_, i) => i / (keys.length * 3));
    room.setTints(stickerIndex, rgb);
    const tints = room.tiles.instanceColor.array;
    keys.forEach((key, i) => {
      const at = stickerIndex.get(key);
      expect(Array.from(tints.slice(i * 3, i * 3 + 3))).toEqual(Array.from(rgb.slice(at * 3, at * 3 + 3)));
    });
  } finally { room.dispose(); }
});

it('box-projects reflections onto the room as it is placed and scaled in the world', () => {
  const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
  const parent = new THREE.Group();
  parent.position.set(0.4, -0.2, 0.1); parent.scale.setScalar(2.5);
  parent.add(room.group); parent.updateMatrixWorld(true);
  const renderer = { getRenderTarget: () => null, setRenderTarget() {}, render() {}, xr: { enabled: false }, coordinateSystem: 2000,
    toneMapping: 0, outputColorSpace: 'srgb' };
  try {
    // Record what each capture draws into against what the mirrors sample then.
    const draws = [];
    probe.camera.update = () => draws.push([probe.camera.renderTarget.texture, room.uniforms.uMirrorEnv.value]);
    probe.capture(renderer, new THREE.Scene(), room);
    const half = CORE_MIRROR_HALF * 2.5;
    expect(room.uniforms.uMirrorProbe.value.toArray()).toEqual([0.4, -0.2, 0.1]);
    expect(room.uniforms.uMirrorBoxMax.value.x).toBeCloseTo(0.4 + half);
    expect(room.uniforms.uMirrorBoxMin.value.y).toBeCloseTo(-0.2 - half);
    expect(room.uniforms.uMirrorLive.value).toBe(1);
    for (let i = 0; i < 4; i++) probe.capture(renderer, new THREE.Scene(), room);
    // Alternate targets: the mirrors never sample the one being drawn into, and
    // always show the capture that just finished.
    expect(draws).toHaveLength(5);
    for (const [drawn, sampled] of draws) expect(drawn).not.toBe(sampled);
    expect(room.uniforms.uMirrorEnv.value).toBe(draws.at(-1)[0]);
  } finally { room.dispose(); probe.dispose(); }
});
