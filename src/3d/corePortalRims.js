import * as THREE from 'three';
import { CORE_PASSAGE_POINTS, CORE_MIRROR_HALF } from './corePassage.js';
import { makeCoreChamberLight } from './coreChamberLight.js';
import { TUNNEL_MINI_FACE_R, TUNNEL_CORE_STICKER_OFFSET, tunnelCoreScale } from '../utils/tunnelPath.js';

// A real, continuous rim makes a port read as one circular opening even when
// entry-anchored growth carries a tile seam past the fixed simulation route.
// Its centre is the SAME sampled wall intersection as the cutout, never a
// nearby tile centre that would obstruct the worm. It does not enlarge the bore.
export const CORE_PORTAL_RIM_OUTER = 1.095;
const AXES = ['x', 'y', 'z'];
const point = new THREE.Vector3();
const normal = new THREE.Vector3();
const pose = new THREE.Object3D();
const Z = new THREE.Vector3(0, 0, 1);

export function coreWallCrossingsInto(out, points, center, half) {
  let count = 0;
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const key = AXES[axis], wall = center[key] + sign * half;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], delta = b[key] - a[key];
      if (Math.abs(delta) < 1e-9) continue;
      const t = (wall - a[key]) / delta;
      if (t < 0 || t > 1) continue;
      point.copy(a).lerp(b, t);
      const tangentA = AXES[(axis + 1) % 3], tangentB = AXES[(axis + 2) % 3];
      if (Math.abs(point[tangentA] - center[tangentA]) > half + 1e-8
        || Math.abs(point[tangentB] - center[tangentB]) > half + 1e-8) continue;
      // A sampled dock can belong to two consecutive segments.
      let duplicate = false;
      for (let j = 0; j < count; j++) {
        const item = out[j];
        if (item.axis === axis && item.sign === sign && item.center.distanceToSquared(point) < 1e-14) { duplicate = true; break; }
      }
      if (duplicate) continue;
      const item = out[count] ?? (out[count] = { center: new THREE.Vector3(), axis: 0, sign: 1 });
      item.center.copy(point); item.axis = axis; item.sign = sign; item.routeOrder = i - 1 + t;
      count++;
    }
  }
  return count;
}

const vertexShader = `
varying vec3 vRimWorld, vRimNormal;
varying vec2 vRimPoint;
varying float vRimRoute;
uniform vec3 uCenter, uChamberEntry, uChamberExit;
uniform float uHalf;
void main() {
  vRimPoint = position.xy;
  vec4 local = instanceMatrix * vec4(position, 1.0);
  vRimWorld = (modelMatrix * local).xyz;
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 p = (center - uCenter) / max(uHalf, .001);
  float a = length(p - uChamberEntry), b = length(p - uChamberExit);
  vRimRoute = a / max(a + b, .001);
  vRimNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vRimWorld, 1.0);
}`;
const fragmentShader = `
uniform vec3 uCenter, uChamberColorA, uChamberColorB;
uniform float uHalf, uChamberReveal, uChamberLevel, uChamberCapture;
varying vec3 vRimWorld, vRimNormal;
varying vec2 vRimPoint;
varying float vRimRoute;
void main() {
  // Never wrap a corner or paint over the perpendicular neighboring face.
  vec3 side = abs(vRimWorld - uCenter) * (vec3(1.0) - abs(vRimNormal));
  if (max(side.x, max(side.y, side.z)) > uHalf) discard;
  float band = (length(vRimPoint) - 1.0) / ${CORE_PORTAL_RIM_OUTER - 1};
  float lip = 1.0 - smoothstep(.04, .25, band);
  float inset = smoothstep(.28, .40, band) * (1.0 - smoothstep(.58, .76, band));
  float outer = smoothstep(.82, .91, band) * (1.0 - smoothstep(.96, 1.0, band));
  float sheen = .55 + .45 * dot(normalize(vRimPoint), normalize(vec2(-.6, .8)));
  vec3 tint = mix(uChamberColorA, uChamberColorB, smoothstep(.20, .80, vRimRoute));
  vec3 pearl = mix(tint, vec3(.87, .95, 1.0), .80);
  // Entry gently yields to exit. A stable pearl lip remains even in calm modes.
  float reveal = mix(1.0 - .4 * uChamberReveal, .6 + .4 * uChamberReveal, vRimRoute);
  vec3 light = pearl * lip * .65 + tint * inset * (.20 + .25 * sheen)
    + pearl * outer * .22;
  light *= (.65 + .35 * uChamberLevel) * reveal * mix(1.0, .35, uChamberCapture);
  vec3 color = vec3(.025, .032, .044) + (vec3(1.0) - exp(-light));
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export function createCorePortalRims(uniforms, lighting = makeCoreChamberLight()) {
  const geometry = new THREE.RingGeometry(1, CORE_PORTAL_RIM_OUTER, 96, 4);
  const group = new THREE.Group();
  group.name = 'anticube-portal-rims';
  // A segment can cross each face once. Pool both shells; no frame allocations,
  // no per-opening draw calls, and only inner rims join existing mirror capture.
  const layers = [false, true].map(inner => {
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { ...lighting.uniforms, uCenter: uniforms.uCoreRoomCenter, uHalf: { value: 0 } } });
    const mesh = new THREE.InstancedMesh(geometry, material, (CORE_PASSAGE_POINTS - 1) * 6);
    mesh.name = inner ? 'anticube-inner-rims' : 'anticube-outer-rims';
    mesh.count = 0; mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, inner, crossings: [] };
  });
  let signature = '';
  return {
    group, layers,
    update(passage, size, zoom) {
      group.visible = uniforms.uPassageOpen.value > .5;
      if (!group.visible) return;
      const key = `${passage.signature}:${zoom}`;
      if (key === signature) return;
      signature = key;
      const center = uniforms.uCoreRoomCenter.value, radius = uniforms.uPassageRadius.value;
      for (const layer of layers) {
        const { mesh, inner, crossings } = layer;
        const half = (inner ? CORE_MIRROR_HALF
          : TUNNEL_MINI_FACE_R + tunnelCoreScale(size) * (TUNNEL_CORE_STICKER_OFFSET - .5)) * zoom;
        const count = coreWallCrossingsInto(crossings, uniforms.uPassagePoints.value, center, half);
        mesh.material.uniforms.uHalf.value = half;
        mesh.count = count;
        for (let i = 0; i < count; i++) {
          const crossing = crossings[i];
          normal.set(0, 0, 0).setComponent(crossing.axis, crossing.sign * (inner ? -1 : 1));
          pose.position.copy(crossing.center).addScaledVector(normal, radius * .002);
          pose.quaternion.setFromUnitVectors(Z, normal); pose.scale.setScalar(radius);
          pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
        }
        mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16);
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() { geometry.dispose(); layers.forEach(({ mesh }) => { mesh.material.dispose(); mesh.dispose(); }); }
  };
}
