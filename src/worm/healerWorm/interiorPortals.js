import * as THREE from 'three';
import { buildTunnelPathForTunnel } from '../wormLogic.js';
import { makeTunnelPath, tunnelPathArcPointInto, tunnelPathArcTangentInto } from '../../utils/tunnelPath.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
import { SURFACE_OFFSET } from '../../utils/constants.js';

export const INTERIOR_PORTAL_RADIUS = 0.325;
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
uniform float uInteriorOpen;
uniform vec3 uInteriorCenters[2], uInteriorAxes[2], uInteriorNormals[2];
float portalDistance(vec3 point) {
  if (uInteriorOpen < 0.5) return 1000.0;
  float gap = 1000.0;
  for (int i = 0; i < 2; i++) {
    vec3 offset = point - uInteriorCenters[i];
    float along = dot(offset, uInteriorAxes[i]);
    float radial = length(offset - along * uInteriorAxes[i]);
    float wallDepth = dot(offset, uInteriorNormals[i]);
    gap = min(gap, max(radial - ${INTERIOR_PORTAL_RADIUS}, abs(wallDepth) - 0.12));
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
  const uniforms = {
    uInteriorOpen: { value: 0 },
    uInteriorCenters: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uInteriorAxes: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uInteriorNormals: { value: [new THREE.Vector3(), new THREE.Vector3()] }
  };
  const time = { value: 0 };
  const mouths = [0, 1].map(side => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uTime: time },
      vertexShader: mouthVertex, fragmentShader: mouthFragment, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `tunnel-interior-mouth-${side}`;
    mesh.frustumCulled = false;
    return mesh;
  });
  return {
    uniforms, time, mouths, path: makeTunnelPath(), signature: '',
    dispose() { geometry.dispose(); mouths.forEach(mesh => mesh.material.dispose()); }
  };
}

export function syncInteriorPortals(portals, tunnel, size, expansion) {
  portals.uniforms.uInteriorOpen.value = tunnel ? 1 : 0;
  for (const mouth of portals.mouths) mouth.visible = !!tunnel;
  if (!tunnel) return;
  const { entry: a, exit: b } = tunnel;
  const signature = `${size}:${expansion}:${a.x},${a.y},${a.z},${a.dirKey}:${b.x},${b.y},${b.z},${b.dirKey}:${tunnel.padExpansion ?? expansion}:${tunnel.padHeight ?? 0}`;
  if (signature === portals.signature) return;
  portals.signature = signature;
  const path = buildTunnelPathForTunnel(portals.path, tunnel, size, expansion);
  const half = (size - 1) / 2 * cubeExpansionScale(size, expansion) + SURFACE_OFFSET;
  for (let side = 0; side < 2; side++) {
    const center = portals.uniforms.uInteriorCenters.value[side], axis = portals.uniforms.uInteriorAxes.value[side];
    interiorPortalFrameInto(center, axis, path, side, half);
    portals.uniforms.uInteriorNormals.value[side].copy(side === 0 ? path.nStart : path.nEnd);
    portals.mouths[side].position.copy(center);
    portals.mouths[side].quaternion.setFromUnitVectors(Z, axis);
  }
}
