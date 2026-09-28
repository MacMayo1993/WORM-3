import { expect, it } from 'vitest';
import { Scene, Group, Vector3 } from 'three';
import { createWormLightPool, createWormLightSource } from '../worm/wormLightPool.js';

it('keeps the renderer light count fixed through spawn, culling, expiry and reuse', () => {
  const scene = new Scene(), pool = createWormLightPool(2), camera = new Vector3();
  scene.add(pool.group);
  const countLights = () => { let n = 0; scene.traverseVisible(o => { if (o.isLight) n++; }); return n; };
  const sources = [1, 3, 8].map(x => {
    const parent = new Group(), source = createWormLightSource();
    parent.position.x = x; source.position.y = 2; parent.add(source); scene.add(parent);
    source.intensity = x; source.color.set(x === 1 ? '#ff0000' : '#00ff00'); source.distance = 3;
    return { source, parent, remove: pool.register(source) };
  });
  pool.update(camera);
  expect(countLights()).toBe(2);
  expect(pool.lights.map(l => l.intensity)).toEqual([1, 3]);
  expect(pool.lights[0].getWorldPosition(new Vector3()).toArray()).toEqual([1, 2, 0]);
  sources[0].parent.visible = false;
  pool.update(camera);
  expect(pool.lights.map(l => l.intensity)).toEqual([3, 8]);
  expect(countLights()).toBe(2);
  for (const { remove } of sources) remove();
  pool.update(camera);
  expect(pool.lights.every(l => l.visible && l.intensity === 0)).toBe(true);
  expect(countLights()).toBe(2);
  sources[0].parent.visible = true;
  sources[0].source.intensity = 0.4;
  pool.register(sources[0].source);
  pool.group.position.set(4, -2, 0);
  pool.update(camera);
  expect(pool.lights[0].intensity).toBe(0.4);
  expect(pool.lights[0].getWorldPosition(new Vector3()).toArray()).toEqual([1, 2, 0]);
  expect(countLights()).toBe(2);
});
