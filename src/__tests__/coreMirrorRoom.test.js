import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CORE_MIRROR_HALF, makeCorePassage } from '../3d/corePassage.js';
import { createCoreMirrorRoom, createCoreMirrorProbe, coreMirrorTileKeys } from '../3d/coreMirrorRoom.js';
import { MIRROR_LAYER, addMirrorSubject, tagMirrorSubjects, warmMirrorPrograms } from '../3d/mirrorSubjects.js';

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
  // Record what each capture draws into against what the mirrors sample then.
  const draws = [];
  let bound = null;
  const renderer = { getRenderTarget: () => null, setRenderTarget(target) { bound = target; },
    render() { if (bound) draws.push([bound.texture, room.uniforms.uMirrorEnv.value]); },
    xr: { enabled: false }, coordinateSystem: 2000, toneMapping: 0, outputColorSpace: 'srgb' };
  try {
    probe.capture(renderer, new THREE.Scene(), room);
    const half = CORE_MIRROR_HALF * 2.5;
    expect(room.uniforms.uMirrorProbe.value.toArray()).toEqual([0.4, -0.2, 0.1]);
    expect(room.uniforms.uMirrorBoxMax.value.x).toBeCloseTo(0.4 + half);
    expect(room.uniforms.uMirrorBoxMin.value.y).toBeCloseTo(-0.2 - half);
    expect(room.uniforms.uMirrorLive.value).toBe(1);
    for (let i = 0; i < 4; i++) probe.capture(renderer, new THREE.Scene(), room);
    // Alternate targets: the mirrors never sample the one being drawn into, and
    // always show the capture that just finished.
    expect(draws).toHaveLength(5 * 6);
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

it('reflects only the mirror layer: the mirrors, the registered worm and band, and every light', () => {
  const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
  const scene = new THREE.Scene(), worm = new THREE.Group(), bead = new THREE.Mesh();
  const scenery = new THREE.Mesh(), light = new THREE.DirectionalLight(), hiddenLight = new THREE.PointLight();
  hiddenLight.visible = false;
  worm.add(bead); scene.add(worm, scenery, light, hiddenLight, room.group);
  const remove = addMirrorSubject(worm);
  const seen = [];
  let bound = null;
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => null, setRenderTarget(target) { bound = target; },
    render(_scene, camera) { if (bound) seen.push(camera); } };
  try {
    probe.capture(renderer, scene, room);
    for (const camera of seen) {
      expect(room.tiles.layers.test(camera.layers)).toBe(true);
      expect(bead.layers.test(camera.layers)).toBe(true);
      expect(light.layers.test(camera.layers)).toBe(true);
      // A hidden light still counts: lights the capture misses re-key its programs.
      expect(hiddenLight.layers.test(camera.layers)).toBe(true);
      expect(scenery.layers.test(camera.layers)).toBe(false);
      expect(room.backing.layers.test(camera.layers)).toBe(false);
    }
    // Still drawn by the main view (layer 0).
    expect(bead.layers.test(new THREE.Camera().layers)).toBe(true);
    remove();
    expect(bead.layers.isEnabled(MIRROR_LAYER)).toBe(false);
    tagMirrorSubjects(scene);
    expect(bead.layers.isEnabled(MIRROR_LAYER)).toBe(false);
  } finally { remove(); room.dispose(); probe.dispose(); }
});

it('spreads a capture over frames and publishes the cube once all six views are drawn', () => {
  const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
  const scene = new THREE.Scene(), faces = [];
  let bound = null, face = 0;
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => null, setRenderTarget(target, f) { bound = target; face = f; },
    render() { if (bound) faces.push(face); } };
  try {
    probe.capture(renderer, scene, room);
    const first = room.uniforms.uMirrorEnv.value;
    faces.length = 0;
    probe.capture(renderer, scene, room, { delta: 1 / 60, interval: 1 / 30, faces: 3 });
    expect(faces).toEqual([]); // not due yet
    probe.capture(renderer, scene, room, { delta: 1 / 60, interval: 1 / 30, faces: 3 });
    expect(faces).toEqual([0, 1, 2]);
    expect(room.uniforms.uMirrorEnv.value).toBe(first); // half a cube is never shown
    probe.capture(renderer, scene, room, { delta: 1 / 60, interval: 1 / 30, faces: 3 });
    expect(faces).toEqual([0, 1, 2, 3, 4, 5]);
    expect(room.uniforms.uMirrorEnv.value).not.toBe(first);
  } finally { room.dispose(); probe.dispose(); }
});

it('links the capture\'s render-target programs while warming, and restores the target', () => {
  const scene = new THREE.Scene(), band = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  scene.add(band, new THREE.DirectionalLight());
  const calls = [], previous = { previous: true };
  let bound = previous;
  const renderer = { getRenderTarget: () => bound, setRenderTarget(target) { bound = target; },
    compile(object, camera) { calls.push({ object, target: bound, layers: camera.layers.mask }); } };
  warmMirrorPrograms(renderer, scene, [band]);
  expect(calls).toHaveLength(1);
  expect(calls[0].object).toBe(band);
  expect(calls[0].target.isWebGLRenderTarget).toBe(true);
  expect(calls[0].layers).toBe(1 << MIRROR_LAYER);
  expect(bound).toBe(previous);
});
