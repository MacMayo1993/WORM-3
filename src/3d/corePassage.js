import * as THREE from 'three';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, TUNNEL_MINI_FACE_R } from '../utils/tunnelPath.js';
import { CORE_ZOOM_MAX } from './antipodalCore.js';

// Retain both docks and the centre even when the arms are very unequal.
// Extra shoulder samples keep the opening on the actual curved ride at 1–6x zoom.
const LEG_SAMPLES = [0, 12, 4, 4, 12];
export const CORE_PASSAGE_POINTS = 33;
export const CORE_PASSAGE_RADIUS = 0.18;
export const CORE_MIRROR_HALF = TUNNEL_MINI_FACE_R * 0.9;
// Maximum face extent after zooming about any dock. Outer throats are always
// beyond the core; omit them and crop long shoulders to this bounded region.
export const CORE_PASSAGE_EXTENT = TUNNEL_MINI_FACE_R * (2 * CORE_ZOOM_MAX - 1) + 0.02;
const sample = new THREE.Vector3();
const extent = point => Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
function cubicInto(out, path, leg, t) {
  const v = 1 - t;
  return out.copy(path.legA[leg]).multiplyScalar(v * v * v)
    .addScaledVector(path.legC1[leg], 3 * v * v * t)
    .addScaledVector(path.legC2[leg], 3 * v * t * t)
    .addScaledVector(path.legB[leg], t * t * t);
}
function shoulderLimit(path, leg) {
  const end = leg === 1 ? 0 : 1;
  const bound = CORE_PASSAGE_EXTENT + CORE_PASSAGE_RADIUS;
  if (extent(cubicInto(sample, path, leg, end)) <= bound) return end;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if ((extent(cubicInto(sample, path, leg, mid)) > bound) === (leg === 1)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function makeCorePassage() {
  return {
    path: makeTunnelPath(), signature: '',
    uniforms: {
      uPassageOpen: { value: 0 },
      uCoreRoomCenter: { value: new THREE.Vector3() },
      uCoreRoomHalf: { value: 0 },
      uPassageRadius: { value: CORE_PASSAGE_RADIUS },
      uPassagePoints: { value: Array.from({ length: CORE_PASSAGE_POINTS }, () => new THREE.Vector3()) }
    }
  };
}

export function updateCorePassage(passage, tunnel, size, expansion) {
  passage.uniforms.uPassageOpen.value = tunnel ? 1 : 0;
  if (!tunnel) return;
  const { entry: a, exit: b } = tunnel;
  const signature = `${size}:${a.x},${a.y},${a.z},${a.dirKey}:${b.x},${b.y},${b.z},${b.dirKey}:${tunnel.padExpansion ?? expansion}:${tunnel.padHeight ?? 0}`;
  if (signature === passage.signature) return;
  passage.signature = signature;
  const path = buildTunnelPathForTunnel(passage.path, tunnel, size, expansion);
  const points = passage.uniforms.uPassagePoints.value;
  const start = shoulderLimit(path, 1), end = shoulderLimit(path, 4);
  cubicInto(points[0], path, 1, start);
  let index = 1;
  for (let leg = 1; leg < LEG_SAMPLES.length; leg++) {
    const from = leg === 1 ? start : 0, to = leg === 4 ? end : 1;
    for (let i = 1; i <= LEG_SAMPLES[leg]; i++) {
      cubicInto(points[index++], path, leg, from + (to - from) * i / LEG_SAMPLES[leg]);
    }
  }
}

export const corePassageGLSL = `
uniform float uPassageOpen, uPassageRadius;
uniform vec3 uPassagePoints[${CORE_PASSAGE_POINTS}];
float portalDistance(vec3 point) {
  if (uPassageOpen < 0.5) return 1000.0;
  float distanceSq = 1000000.0;
  for (int i = 0; i < ${CORE_PASSAGE_POINTS - 1}; i++) {
    vec3 edge = uPassagePoints[i + 1] - uPassagePoints[i];
    vec3 offset = point - uPassagePoints[i];
    float t = clamp(dot(offset, edge) / max(dot(edge, edge), 0.00000001), 0.0, 1.0);
    vec3 radial = offset - t * edge;
    distanceSq = min(distanceSq, dot(radial, radial));
  }
  return sqrt(distanceSq) - uPassageRadius;
}
`;

// Hollow the plastic behind the mirrors, keeping the exterior shell intact.
// The mirrors use only corePassageGLSL so the room does not erase itself.
export const coreRoomCutoutGLSL = corePassageGLSL.replace('float portalDistance(', 'float boreDistance(') + `
uniform vec3 uCoreRoomCenter;
uniform float uCoreRoomHalf;
float portalDistance(vec3 point) {
  float bore = boreDistance(point);
  if (uPassageOpen < 0.5 || uCoreRoomHalf <= 0.0) return bore;
  vec3 d = abs(point - uCoreRoomCenter) - vec3(uCoreRoomHalf);
  return min(bore, max(d.x, max(d.y, d.z)));
}
`;
