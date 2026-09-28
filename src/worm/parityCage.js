import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// These three additive pieces share a centre, animation and render order.
// Merge within each orb so its glass shell and alpha orbit rings still sort as
// before. A scene-wide transparent instance batch cannot preserve that order.
export function createParityCageGeometry(geometries, target = false) {
  const parts = [
    [geometries.parityCage, [Math.PI / 2, 0, 0], '#e8fbff', target ? .55 : .42],
    [geometries.parityCage2, [Math.PI / 2, Math.PI / 3, 0], '#dff8ff', target ? .38 : .28],
    [geometries.parityAxis, [0, 0, 0], '#ffffff', .5]
  ].map(([source, rotation, hex, opacity]) => {
    const geometry = source.clone(), color = new THREE.Color(hex);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    const rgba = new Float32Array(geometry.attributes.position.count * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba.set([color.r, color.g, color.b, opacity], i);
    geometry.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
    return geometry;
  });
  // Groups retain the three ranges for the performance harness's unbatched
  // comparison. A single material submits the complete index in one draw.
  const result = mergeGeometries(parts, true);
  parts.forEach(part => part.dispose());
  return result;
}
