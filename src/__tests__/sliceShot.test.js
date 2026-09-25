import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { sliceShotInto } from '../worm/sliceShot.js';

const out = () => ({ cam: new Vector3(), look: new Vector3(), up: new Vector3() });
const project = (shot, fov, aspect, point) => {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 200);
  camera.position.copy(shot.cam); camera.up.copy(shot.up); camera.lookAt(shot.look); camera.updateMatrixWorld();
  return point.clone().project(camera);
};

describe('sliceShotInto', () => {
  const cases = [];
  for (const size of [2, 3, 4, 5]) for (const axis of ['col', 'row', 'depth']) for (const layer of [0, size - 1])
    for (const [fov, aspect] of [[70, 390 / 763], [60, 1], [55, 16 / 9]]) cases.push({ size, axis, layer, fov, aspect });

  it.each(cases)('holds the whole $size×$size cube, the $axis layer $layer and the hit at fov $fov, aspect $aspect', ({ size, axis, layer, fov, aspect }) => {
    const k = (size - 1) / 2, half = k + 0.5;
    const coord = { col: 'x', row: 'y', depth: 'z' }[axis];
    // A hit on the layer, on a face the layer crosses.
    const impact = new Vector3(0, 0, 0); impact[coord] = layer - k;
    const face = coord === 'y' ? 'z' : 'y'; impact[face] = half + 0.08;
    const shot = sliceShotInto(out(), impact.toArray(), axis, layer, size, { fov, aspect });
    expect(shot.cam.length()).toBeGreaterThan(Math.sqrt(3) * half);
    for (const x of [-half, half]) for (const y of [-half, half]) for (const z of [-half, half]) {
      const p = project(shot, fov, aspect, new Vector3(x, y, z));
      expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1); expect(p.z).toBeLessThan(1);
    }
    const hit = project(shot, fov, aspect, impact);
    expect(Math.abs(hit.x)).toBeLessThan(0.8); expect(Math.abs(hit.y)).toBeLessThan(0.8);
  });

  it('shows the turning layer as a band, not face-on, even for a hit on its end cap', () => {
    const shot = sliceShotInto(out(), [1.58, 0.3, 0.2], 'col', 2, 3, { fov: 60, aspect: 1 });
    const view = shot.look.clone().sub(shot.cam).normalize();
    expect(Math.abs(view.x)).toBeLessThan(0.8);
  });

  it('frames a hit with no slice (a bomb) from off its own face', () => {
    for (const impact of [[1.6, 0.4, 0.2], [0.2, -1.6, 0.4], [0.3, 0.2, -1.6]]) {
      const shot = sliceShotInto(out(), impact, null, null, 3, { fov: 60, aspect: 0.5 });
      const hit = project(shot, 60, 0.5, new Vector3(...impact));
      expect(Math.abs(hit.x)).toBeLessThan(0.8); expect(Math.abs(hit.y)).toBeLessThan(0.8);
      // In front of the impact face, not behind the cube.
      expect(shot.cam.dot(new Vector3(...impact))).toBeGreaterThan(0);
    }
  });

  it('pulls further back for an exploded cube and a narrow portrait lens', () => {
    const wide = sliceShotInto(out(), [0, 1.6, 0], 'col', 1, 3, { fov: 60, aspect: 16 / 9 });
    const tall = sliceShotInto(out(), [0, 1.6, 0], 'col', 1, 3, { fov: 60, aspect: 0.5 });
    const exploded = sliceShotInto(out(), [0, 2.6, 0], 'col', 1, 3, { fov: 60, aspect: 0.5, scale: 1.6 });
    expect(tall.cam.distanceTo(tall.look)).toBeGreaterThan(wide.cam.distanceTo(wide.look));
    expect(exploded.cam.distanceTo(exploded.look)).toBeGreaterThan(tall.cam.distanceTo(tall.look));
  });
});
