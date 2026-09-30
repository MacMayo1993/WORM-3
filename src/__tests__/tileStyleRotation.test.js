import { expect, it } from 'vitest';
import * as THREE from 'three';
import { bindTileStyleIdentity, bindDefaultTileStyleIdentity, bumpTileRolls } from '../3d/tileStyleIdentity.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies, rotateStickers } from '../game/cubeRotation.js';

// Independent Three.js face transforms, matching the rendered sticker planes.
const faces = {
  PX: [0, Math.PI / 2, 0], NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0], NY: [Math.PI / 2, 0, 0],
  PZ: [0, 0, 0], NZ: [0, Math.PI, 0],
};
const axes = { col: new THREE.Vector3(1, 0, 0), row: new THREE.Vector3(0, 1, 0), depth: new THREE.Vector3(0, 0, 1) };
function tangent(face, turns) {
  return new THREE.Vector3(1, 0, 0)
    .applyAxisAngle(axes.depth, turns * Math.PI / 2)
    .applyEuler(new THREE.Euler(...faces[face]));
}

it.each(Object.keys(axes))('preserves the visible artwork basis across every %s face transition', axis => {
  for (const face of Object.keys(faces)) for (const dir of [-1, 1]) for (let turns = 0; turns < 4; turns++) {
    const sticker = { orig: 1, ...(turns ? { uvTurns: turns } : {}) };
    const [nextFace, next] = Object.entries(rotateStickers({ [face]: sticker }, axis, dir))[0];
    const expected = tangent(face, turns).applyAxisAngle(axes[axis], dir * Math.PI / 2);
    expect(tangent(nextFace, next.uvTurns ?? 0).distanceTo(expected)).toBeLessThan(1e-10);
  }
});

it('binds each physical identity for consecutive shared-material and portal-clone draws', () => {
  const source = new THREE.ShaderMaterial({ uniforms: {
    tileHome: { value: new THREE.Vector3() }, tileFace: { value: 0 },
  } });
  const portal = source.clone(); portal.uniforms = { ...source.uniforms };
  const a = bindTileStyleIdentity({ x: 4, y: 0, z: 2 }, 5);
  const b = bindTileStyleIdentity({ x: 1, y: 3, z: 4 }, 1);
  for (const [bind, xyz, face] of [[a, [4, 0, 2], 5], [b, [1, 3, 4], 1], [a, [4, 0, 2], 5]]) {
    portal.uniformsNeedUpdate = false;
    bind(null, null, null, null, portal);
    expect(portal.uniforms.tileHome.value.toArray()).toEqual(xyz);
    expect(portal.uniforms.tileFace.value).toBe(face);
    expect(portal.uniformsNeedUpdate).toBe(true);
  }
});

it.each(Object.keys(axes))('rerolls only physical pieces on both %s layers after an earlier turn', axis => {
  const n = 5, data = new Uint8Array(n ** 3 * 4);
  const cubies = rotateSliceCubies(makeCubies(n), n, 'row', 0, 1);
  bumpTileRolls(data, cubies, n, axis, [0, 4, 0]);
  for (const plane of cubies) for (const row of plane) for (const cubie of row) {
    const home = Object.values(cubie.stickers)[0]?.origPos;
    if (!home) continue;
    const coordinate = axis === 'col' ? cubie.x : axis === 'row' ? cubie.y : cubie.z;
    const expected = coordinate === 0 || coordinate === 4 ? 1 : 0;
    expect(data[(home.z * n * n + home.x + home.y * n) * 4]).toBe(expected);
  }
});

it('does not leak a shared tile seed into pickups or override a bound sticker', () => {
  const material = new THREE.ShaderMaterial({ uniforms: {
    tileHome: { value: new THREE.Vector3() }, tileFace: { value: 0 },
  } });
  const tile = new THREE.Mesh(); tile.onBeforeRender = bindTileStyleIdentity({ x: 2, y: 3, z: 4 }, 6);
  tile.onBeforeRender(null, null, null, null, material);
  bindDefaultTileStyleIdentity.call(material, null, null, null, null, tile);
  expect(material.uniforms.tileHome.value.toArray()).toEqual([2, 3, 4]);
  const pickup = new THREE.Mesh();
  bindDefaultTileStyleIdentity.call(material, null, null, null, null, pickup);
  expect(material.uniforms.tileHome.value.toArray()).toEqual([pickup.id, 0, 0]);
  expect(material.uniforms.tileFace.value).toBe(0);
});
