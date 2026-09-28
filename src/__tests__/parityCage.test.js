import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createParityCageGeometry } from '../worm/parityCage.js';
import { getOrbMaterials } from '../worm/orbMaterials.js';

it.each([false, true])('preserves every cage vertex and each piece’s colour/opacity (target: %s)', target => {
  const geometry = {
    parityCage: new THREE.TorusGeometry(.3, .012, 10, 48),
    parityCage2: new THREE.TorusGeometry(.3, .010, 10, 48),
    parityAxis: new THREE.CylinderGeometry(.010, .010, .54, 12)
  };
  const parts = Object.values(geometry), merged = createParityCageGeometry(geometry, target);
  const rotations = [[Math.PI / 2, 0, 0], [Math.PI / 2, Math.PI / 3, 0], [0, 0, 0]];
  const colors = ['#e8fbff', '#dff8ff', '#ffffff'].map(hex => new THREE.Color(hex));
  const alphas = [target ? .55 : .42, target ? .38 : .28, .5];
  expect(merged.index.count).toBe(parts.reduce((n, g) => n + g.index.count, 0));
  const world = new THREE.Matrix4().compose(new THREE.Vector3(2, -.7, 4),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.4, 1.2, -.3)), new THREE.Vector3(1.04, 1.04, 1.04));
  const original = new THREE.Vector3(), actual = new THREE.Vector3();
  let offset = 0;
  for (const [i, source] of parts.entries()) {
    const pose = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotations[i]));
    for (let v = 0; v < source.attributes.position.count; v++) {
      original.fromBufferAttribute(source.attributes.position, v).applyMatrix4(pose).applyMatrix4(world);
      actual.fromBufferAttribute(merged.attributes.position, offset + v).applyMatrix4(world);
      expect(actual.distanceTo(original)).toBeLessThan(1e-6);
      const color = merged.attributes.color;
      [color.getX(offset + v), color.getY(offset + v), color.getZ(offset + v)].forEach((x, j) => expect(x).toBeCloseTo(colors[i].toArray()[j], 6));
      expect(color.getW(offset + v)).toBeCloseTo(alphas[i], 6);
    }
    offset += source.attributes.position.count;
    expect(source.attributes.color).toBeUndefined();
  }
  const material = getOrbMaterials('#a53c18', '#124caa', target).cage;
  expect(material.vertexColors).toBe(true); expect(material.opacity).toBe(1);
  expect(material.blending).toBe(THREE.AdditiveBlending); expect(material.depthWrite).toBe(false);
  merged.dispose(); parts.forEach(p => p.dispose());
});
