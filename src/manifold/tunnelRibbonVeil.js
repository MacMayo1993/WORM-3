import * as THREE from 'three';
import { tileRoom } from './tunnelTileGuard.js';
import { tunnelFinishGLSL } from './tunnelFinish.js';

// Two open, curled sides swept from the existing ribbon edges. They inherit
// its half-twist, never close into a tube, and add one draw to a focus tunnel.
const FOLD_STEPS = 8;
const STRIDE = (FOLD_STEPS + 1) * 2;
const left = new THREE.Vector3(), right = new THREE.Vector3(), center = new THREE.Vector3();
const width = new THREE.Vector3(), up = new THREE.Vector3(), point = new THREE.Vector3();

export function makeTunnelVeil(segments, continuous) {
  const geo = new THREE.BufferGeometry(), count = (segments + 1) * STRIDE;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  geo.setAttribute('aDistance', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('aEnvelope', new THREE.BufferAttribute(new Float32Array(count), 1));
  const indices = [];
  for (let i = 0; i < segments; i++) {
    if (!continuous && i === segments / 2) continue;
    for (let side = 0; side < 2; side++) for (let j = 0; j < FOLD_STEPS; j++) {
      const a = i * STRIDE + side * (FOLD_STEPS + 1) + j, b = a + STRIDE;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(indices);
  return geo;
}

export function fillTunnelVeil(geo, ribbon, rail, path, segments, continuous, guard) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const distance = geo.attributes.aDistance, envelope = geo.attributes.aEnvelope;
  for (let i = 0; i <= segments; i++) {
    left.fromBufferAttribute(ribbon.attributes.position, i * 2);
    right.fromBufferAttribute(ribbon.attributes.position, i * 2 + 1);
    center.copy(left).lerp(right, 0.5);
    width.subVectors(right, left);
    const halfWidth = width.length() * 0.5;
    width.normalize();
    up.fromBufferAttribute(rail.attributes.position, i * 2 + 1).sub(left);
    const height = up.length();
    up.normalize();
    const t = ribbon.attributes.uv.getY(i * 2);
    const arc = continuous ? t * path.total : t <= 0.5
      ? t * 2 * path.armALen : path.total - (1 - t) * 2 * path.armBLen;
    const dockDistance = Math.max(0, path.armALen - arc, arc - (path.total - path.armBLen));
    const fade = THREE.MathUtils.smoothstep(dockDistance, 0, 0.3)
      * THREE.MathUtils.smoothstep(Math.min(arc, path.total - arc), 0, 0.28);
    // The tile guard also bounds these decorative curls inside the aperture.
    const room = Math.max(0, (tileRoom(guard, center.x, center.y, center.z) - halfWidth) / 2.25);
    const radius = Math.min(halfWidth * 0.7 * fade, height * 3.2, room);
    for (let side = 0; side < 2; side++) for (let j = 0; j <= FOLD_STEPS; j++) {
      const across = j / FOLD_STEPS, angle = across * Math.PI * 0.85;
      const index = i * STRIDE + side * (FOLD_STEPS + 1) + j;
      point.copy(side ? right : left)
        .addScaledVector(width, (side ? 1 : -1) * Math.sin(angle) * radius)
        .addScaledVector(up, (1 - Math.cos(angle)) * radius);
      pos.setXYZ(index, point.x, point.y, point.z);
      uv.setXY(index, across, t);
      distance.setX(index, arc);
      envelope.setX(index, Math.min(1, radius / Math.max(halfWidth * 0.5, 0.0001)));
    }
  }
  pos.needsUpdate = true; uv.needsUpdate = true;
  distance.needsUpdate = true; envelope.needsUpdate = true;
  geo.computeVertexNormals();
}

export const veilVertexShader = `
  uniform vec3 uWhipAxis;
  uniform float uWhipAmp, uWhipPhase;
  attribute float aDistance, aEnvelope;
  varying vec2 vUv;
  varying float vDistance, vEnvelope;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vUv = uv; vDistance = aDistance; vEnvelope = aEnvelope;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float ends = sin(uv.y * 3.14159265)
      * smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.86, uv.y)
      * smoothstep(0.0, 0.10, abs(uv.y - 0.5));
    wp.xyz += uWhipAxis * (sin(uv.y * 12.0 - uWhipPhase) * uWhipAmp * ends);
    vWorldPos = wp.xyz;
    vNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const veilFragmentShader = `
  uniform vec3 uColorA, uColorB;
  uniform float uTime, uOpacity, uGrowT, uRideMode, uRideCore;
  uniform float uSolitonProgress, uSolitonAmp, uIdlePadProgress, uIdlePadAmp;
  varying vec2 vUv;
  varying float vDistance, vEnvelope;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  ${tunnelFinishGLSL}
  void main() {
    if (vUv.y > uGrowT * 0.5 && vUv.y < 1.0 - uGrowT * 0.5) discard;
    float core = uRideMode > 0.5 ? uRideCore : 0.5;
    float aa = max(fwidth(vUv.y), 0.00001);
    vec3 base = mix(uColorA, uColorB, smoothstep(core - aa, core + aa, vUv.y));
    vec3 pearl = mix(base, vec3(0.92, 0.97, 1.0), 0.45);
    float ribs = tunnelLine(vDistance * 1.65, 0.028);
    float spiral = tunnelLine(vDistance * 1.1 - vUv.x * 0.7 - uTime * 0.16, 0.055);
    float rim = smoothstep(0.82, 0.97, vUv.x);
    float pulse = exp(-pow((vUv.y - uSolitonProgress) / 0.055, 2.0)) * uSolitonAmp;
    float idle = min(abs(vUv.y - uIdlePadProgress), abs(vUv.y - (1.0 - uIdlePadProgress)));
    pulse += exp(-pow(idle / 0.055, 2.0)) * uIdlePadAmp;
    vec3 n = vNormal;
    n /= max(length(n), 0.00001);
    float fresnel = pow(1.0 - abs(dot(n, normalize(cameraPosition - vWorldPos))), 2.0);
    vec3 color = base * 0.65 + pearl * (0.24 + ribs * 0.25 + spiral * 0.18 + rim * 0.2 + pulse * 0.3);
    float alpha = (0.07 + ribs * 0.3 + spiral * 0.16 + rim * 0.32 + fresnel * 0.10 + pulse * 0.12)
      * uOpacity * vEnvelope * smoothstep(0.0, 0.12, vUv.x);
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;
