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
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const mouthFragment = `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  float ribs = pow(0.5 + 0.5 * cos(vUv.y * 25.1327), 14.0);
  float spiral = pow(0.5 + 0.5 * cos(vUv.x * 18.8496 - vUv.y * 7.0 + uTime * 1.5), 10.0);
  float edge = 1.0 - smoothstep(0.0, 0.13, vUv.y);
  vec3 pearl = mix(uColor, vec3(0.85, 0.97, 1.0), 0.45);
  vec3 color = uColor * (0.10 + spiral * 0.34 + ribs * 0.22) + pearl * edge * 0.65;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export function makeInteriorPortals() {
  // Open-ended frustum: the centre is empty geometry, not a dark painted disc.
  const geometry = new THREE.CylinderGeometry(0.25, INTERIOR_PORTAL_RADIUS, 0.27, 40, 8, true);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, 0.125);
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
        uniforms: { uColor: { value: new THREE.Color() }, uTime: time },
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
      portals.mouths[index].quaternion.setFromUnitVectors(Z, axis);
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
