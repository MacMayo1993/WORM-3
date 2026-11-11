import * as THREE from 'three';
import { buildTunnelPathForTunnel } from '../wormLogic.js';
import { makeTunnelPath, tunnelPathArcPointInto, tunnelPathArcTangentInto } from '../../utils/tunnelPath.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
import { SURFACE_OFFSET } from '../../utils/constants.js';
import { MAX_ACTIVE_TUNNEL_PAIRS } from './constants.js';

export const INTERIOR_PORTAL_RADIUS = 0.325;
// Every possible mouth on the largest board, including routes retained by the tail.
// Store frames in a byte texture, not 3 uniform vectors per mouth: the latter
// exhausts mobile fragment uniforms long before a full network can be opened.
export const INTERIOR_PORTAL_FACE_CAPACITY = 15 * 15;
export const INTERIOR_PORTAL_CAPACITY = 6 * INTERIOR_PORTAL_FACE_CAPACITY;
const PORTAL_TEXTURE_HEIGHT = 2048;
const INITIAL_MOUTHS = (MAX_ACTIVE_TUNNEL_PAIRS + 1) * 2;
const Z = new THREE.Vector3(0, 0, 1);
const inverseRotation = new THREE.Quaternion();
export const INTERIOR_PORTAL_RIM_PLANE = -0.103;
const sample = new THREE.Vector3();

// The raised mouth and the unraised inner wall need not share a tile centre.
// Find the actual route/wall intersection, including the corner's lateral lift.
export function interiorPortalFrameInto(center, axis, path, side, half) {
  const normal = side === 0 ? path.nStart : path.nEnd;
  let lo = side === 0 ? 0 : path.total - path.armBLen;
  let hi = side === 0 ? path.armALen : path.total;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) * 0.5;
    tunnelPathArcPointInto(sample, path, mid);
    if ((sample.dot(normal) > half) === (side === 0)) lo = mid;
    else hi = mid;
  }
  const arc = (lo + hi) * 0.5;
  tunnelPathArcPointInto(center, path, arc);
  tunnelPathArcTangentInto(axis, path, arc).multiplyScalar(side === 0 ? -1 : 1);
  return arc;
}

export const interiorPortalGLSL = `
uniform float uInteriorOpen, uInteriorRange;
uniform vec3 uInteriorFaceCountsA, uInteriorFaceCountsB;
uniform sampler2D uInteriorFrames;
vec3 decodePortalVector(vec3 high, vec3 low, float range) {
  return ((high * (256.0 / 257.0) + low * (1.0 / 257.0)) * 2.0 - 1.0) * range;
}
float portalDistance(vec3 point) {
  if (uInteriorOpen < 0.5) return 1000.0;
  float gap = 1000.0;
  vec3 wall = abs(point);
  for (int face = 0; face < 6; face++) {
    vec3 normal = face < 2 ? vec3(1.0, 0.0, 0.0) : face < 4 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    normal *= mod(float(face), 2.0) < 0.5 ? 1.0 : -1.0;
    if (dot(wall, abs(normal)) + 0.00001 < max(wall.x, max(wall.y, wall.z))) continue;
    if (dot(point, normal) < 0.0) continue;
    float count = face == 0 ? uInteriorFaceCountsA.x : face == 1 ? uInteriorFaceCountsA.y
      : face == 2 ? uInteriorFaceCountsA.z : face == 3 ? uInteriorFaceCountsB.x
      : face == 4 ? uInteriorFaceCountsB.y : uInteriorFaceCountsB.z;
    // Skip other walls before any texture fetch. Six fixed ranges also bound
    // each WebGL1 loop by one face, rather than the whole cube's mouth count.
    for (int i = 0; i < ${INTERIOR_PORTAL_FACE_CAPACITY}; i++) {
      if (float(i) >= count) break;
      float row = (float(face * ${INTERIOR_PORTAL_FACE_CAPACITY} + i) + 0.5) / ${PORTAL_TEXTURE_HEIGHT}.0;
      vec4 high = texture2D(uInteriorFrames, vec2(0.125, row));
      vec3 center = decodePortalVector(high.rgb, texture2D(uInteriorFrames, vec2(0.375, row)).rgb, uInteriorRange);
      vec3 axis = decodePortalVector(texture2D(uInteriorFrames, vec2(0.625, row)).rgb,
        texture2D(uInteriorFrames, vec2(0.875, row)).rgb, 1.0);
      vec3 offset = point - center;
      float wallDepth = dot(offset, normal);
      // The wall aperture is circular in its own plane, even when the route
      // crosses it obliquely. The tube's tangent must not widen the cutout.
      float axial = dot(axis, normal);
      vec3 crossingOffset = offset - axis * wallDepth / max(abs(axial), 0.00001) * sign(axial);
      float radial = length(crossingOffset);
      gap = min(gap, max(radial - ${INTERIOR_PORTAL_RADIUS}, abs(wallDepth) - 0.12));
    }
  }
  return gap;
}`;

const mouthVertex = `
uniform vec2 uShear;
varying vec2 vUv;
void main() {
  vUv = uv;
  // Parallel circular sections match the cutout at every wall depth. Rotating
  // a cone onto the tangent instead creates an ellipse and a mismatched lip.
  vec3 p = position;
  p.xy += uShear * p.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const mouthFragment = `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // A luminous pearl sleeve, narrow white lip and brushed outer bevel. No
  // animated spiral competing with the worm or hiding the true circular edge.
  float lip = smoothstep(0.31, 0.40, vUv.y) * (1.0 - smoothstep(0.47, 0.57, vUv.y));
  float bevel = smoothstep(0.53, 0.65, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
  float light = 0.65 + 0.35 * cos(vUv.x * 6.283185 - 1.2);
  vec3 pearl = mix(vec3(0.72, 0.84, 0.92), uColor, 0.06);
  vec3 color = pearl * (0.62 + bevel * light * 0.16);
  color = mix(color, vec3(0.94, 0.98, 1.0), lip * 0.85);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export function makeInteriorPortals() {
  // A shared open sleeve with a shallow machined lip. The face stays circular
  // and centred on the real intersection through tile, dimmer and backing.
  const r = INTERIOR_PORTAL_RADIUS;
  const geometry = new THREE.LatheGeometry([
    new THREE.Vector2(r, 0.045), new THREE.Vector2(r, -0.075),
    new THREE.Vector2(r, INTERIOR_PORTAL_RIM_PLANE), new THREE.Vector2(r * 1.012, -0.109),
    new THREE.Vector2(r * 1.05, -0.109), new THREE.Vector2(r * 1.10, -0.102),
    new THREE.Vector2(r * 1.115, -0.092)
  ], 64);
  geometry.rotateX(Math.PI / 2);
  const texture = new THREE.DataTexture(new Uint8Array(4 * PORTAL_TEXTURE_HEIGHT * 4), 4, PORTAL_TEXTURE_HEIGHT);
  texture.needsUpdate = true;
  const uniforms = {
    uInteriorOpen: { value: 0 }, uInteriorCount: { value: 0 },
    uInteriorRange: { value: 1 }, uInteriorFrames: { value: texture },
    uInteriorFaceCountsA: { value: new THREE.Vector3() },
    uInteriorFaceCountsB: { value: new THREE.Vector3() }
  };
  const time = { value: 0 }, mouths = [], centers = [], axes = [], normals = [];
  const group = new THREE.Group();
  group.name = 'tunnel-interior-mouths';
  const ensureMouths = count => {
    while (mouths.length < count) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uTime: time, uShear: { value: new THREE.Vector2() } },
        vertexShader: mouthVertex, fragmentShader: mouthFragment, side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `tunnel-interior-mouth-${mouths.length}`;
      mesh.frustumCulled = false;
      mesh.visible = false;
      mouths.push(mesh); group.add(mesh);
      centers.push(new THREE.Vector3()); axes.push(new THREE.Vector3()); normals.push(new THREE.Vector3());
    }
  };
  ensureMouths(INITIAL_MOUTHS);
  return {
    uniforms, time, mouths, group, centers, axes, normals, ensureMouths, path: makeTunnelPath(), signature: '',
    dispose() { texture.dispose(); geometry.dispose(); mouths.forEach(mesh => mesh.material.dispose()); group.clear(); }
  };
}

function encodeVector(data, offset, vector, range) {
  for (let k = 0; k < 3; k++) {
    const value = Math.round(THREE.MathUtils.clamp((vector.getComponent(k) / range + 1) / 2, 0, 1) * 65535);
    data[offset + k] = value >> 8;
    data[offset + 4 + k] = value & 255;
  }
}

export function syncInteriorPortals(portals, routes, size, expansion) {
  const tunnels = Array.isArray(routes) ? routes : routes ? [routes] : [];
  const count = tunnels.length * 2;
  // Valid topology has at most one route per pair of surface stickers. Do not
  // silently drop an occupied passage if a future mode exceeds the board bound.
  if (count > INTERIOR_PORTAL_CAPACITY) throw new RangeError('Interior portal topology exceeds surface capacity');
  const signature = `${size}:${expansion}:` + tunnels.map(tunnel => {
    const { entry: a, exit: b } = tunnel;
    return `${a.x},${a.y},${a.z},${a.dirKey}:${b.x},${b.y},${b.z},${b.dirKey}:${tunnel.padExpansion ?? expansion}:${tunnel.padHeight ?? 0}`;
  }).join('|');
  if (signature === portals.signature) return;
  portals.signature = signature;
  portals.ensureMouths(count);
  portals.uniforms.uInteriorOpen.value = count ? 1 : 0;
  portals.uniforms.uInteriorCount.value = count;
  for (let i = 0; i < portals.mouths.length; i++) portals.mouths[i].visible = i < count;
  const half = (size - 1) / 2 * cubeExpansionScale(size, expansion) + SURFACE_OFFSET;
  const range = half * 2;
  portals.uniforms.uInteriorRange.value = range;
  const texture = portals.uniforms.uInteriorFrames.value, data = texture.image.data;
  const faceCounts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < tunnels.length; i++) {
    const path = buildTunnelPathForTunnel(portals.path, tunnels[i], size, expansion);
    for (let side = 0; side < 2; side++) {
      const index = i * 2 + side;
      const center = portals.centers[index], axis = portals.axes[index], normal = portals.normals[index];
      interiorPortalFrameInto(center, axis, path, side, half);
      normal.copy(side === 0 ? path.nStart : path.nEnd);
      portals.mouths[index].position.copy(center);
      const mouth = portals.mouths[index];
      mouth.quaternion.setFromUnitVectors(Z, normal);
      inverseRotation.copy(mouth.quaternion).invert();
      sample.copy(axis).applyQuaternion(inverseRotation);
      mouth.material.uniforms.uShear.value.set(sample.x / sample.z, sample.y / sample.z);
      const faceAxis = Math.abs(normal.x) > 0.5 ? 0 : Math.abs(normal.y) > 0.5 ? 1 : 2;
      const face = faceAxis * 2 + (normal.getComponent(faceAxis) < 0 ? 1 : 0);
      const slot = faceCounts[face]++;
      if (slot >= INTERIOR_PORTAL_FACE_CAPACITY) throw new RangeError('Interior portal topology exceeds face capacity');
      const offset = (face * INTERIOR_PORTAL_FACE_CAPACITY + slot) * 16;
      encodeVector(data, offset, center, range);
      encodeVector(data, offset + 8, axis, 1);
    }
  }
  portals.uniforms.uInteriorFaceCountsA.value.fromArray(faceCounts);
  portals.uniforms.uInteriorFaceCountsB.value.fromArray(faceCounts, 3);
  texture.needsUpdate = true;
}
