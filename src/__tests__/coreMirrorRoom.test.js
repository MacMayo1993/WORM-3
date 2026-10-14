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

it('bounds captures by elapsed time, including high-refresh screens, and publishes complete cubes', () => {
  const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
  const scene = new THREE.Scene();
  let draws = 0;
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => null, setRenderTarget() {}, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    render() { draws++; } };
  try {
    // Initial capture is unconditional, so there is never an uninitialized face.
    probe.capture(renderer, scene, room, { delta: 0, interval: 1 / 30 });
    expect(draws).toBe(6);
    for (let i = 0; i < 120; i++) probe.capture(renderer, scene, room, { delta: 1 / 120, interval: 1 / 30 });
    expect(draws).toBe(31 * 6);
    expect(room.uniforms.uMirrorLive.value).toBe(1);
  } finally { room.dispose(); probe.dispose(); }
});

it('updates one scene pose for six views and restores pending main-view shadows and render state on errors', () => {
  const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
  const scene = new THREE.Scene();
  let updates = 0, draws = 0, target = null, face = 0, mip = 0;
  const update = scene.updateMatrixWorld.bind(scene);
  scene.updateMatrixWorld = (...args) => { updates++; update(...args); };
  const shadows = { autoUpdate: true, needsUpdate: true };
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: true }, shadowMap: shadows,
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    setRenderTarget(t, f, m) { target = t; face = f; mip = m; },
    render() {
      draws++;
      expect(scene.matrixWorldAutoUpdate).toBe(false);
      expect(shadows).toEqual({ autoUpdate: false, needsUpdate: false });
      if (draws === 8) throw Error('capture interrupted');
    } };
  try {
    probe.capture(renderer, scene, room);
    expect(updates).toBe(1); expect(draws).toBe(6);
    const texture = room.uniforms.uMirrorEnv.value;
    expect(() => probe.capture(renderer, scene, room)).toThrow('capture interrupted');
    expect(room.uniforms.uMirrorEnv.value).toBe(texture); // no partial cube is published
    expect(scene.matrixWorldAutoUpdate).toBe(true);
    expect(shadows).toEqual({ autoUpdate: true, needsUpdate: true });
    expect(renderer.xr.enabled).toBe(true);
    expect([target, face, mip]).toEqual([null, 0, 0]);
  } finally { room.dispose(); probe.dispose(); }
});
