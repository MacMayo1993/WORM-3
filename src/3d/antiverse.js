// A small, bounded world around the anticube. Three draws, no capture targets,
// textures, lights, or per-particle frame work. Points are born in exact ± pairs.
import * as THREE from 'three';

export const ANTIVERSE_PAIRS = 18;
export const antiverseHalfSize = size => Math.min(0.68, size * 0.28);

const PALETTE = /* glsl */ `
  uniform vec3 uPalette[6];
  vec3 otherSide(vec3 p) {
    vec3 w = pow(abs(p), vec3(4.0));
    w /= max(w.x + w.y + w.z, 0.0001);
    // The same partner colors as the anticube: +X sees green, +Y yellow,
    // +Z orange in the standard palette. Their negatives see the other half.
    return w.x * (p.x > 0.0 ? uPalette[1] : uPalette[4])
      + w.y * (p.y > 0.0 ? uPalette[5] : uPalette[2])
      + w.z * (p.z > 0.0 ? uPalette[3] : uPalette[0]);
  }
`;

const WALL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const WALL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uEnergy;
  varying vec2 vUv;
  varying vec3 vLocal;
  ${PALETTE}
  void main() {
    vec2 q = (vUv - 0.5) * 2.0;
    // A bowed coordinate lattice, pulled toward each face's centre.
    vec2 grid = q * (1.0 + 0.42 * dot(q, q)) * 3.0;
    vec2 d = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), vec2(0.001));
    float lines = 1.0 - smoothstep(0.2, 1.1, min(d.x, d.y));
    float edge = pow(max(abs(q.x), abs(q.y)), 18.0);
    float wave = 0.5 + 0.5 * sin(dot(q, q) * 9.0 + uTime * 0.45);
    vec3 tint = otherSide(vLocal);
    vec3 dark = vec3(0.002, 0.004, 0.012) + tint * 0.012;
    vec3 color = dark + tint * (lines * (0.038 + wave * 0.02) + edge * 0.06) * uEnergy;
    gl_FragColor = vec4(color, uOpacity * (0.94 + edge * 0.04));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const EDGE_VERTEX = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EDGE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uEnergy;
  varying vec3 vLocal;
  ${PALETTE}
  void main() {
    gl_FragColor = vec4(mix(otherSide(vLocal), vec3(0.65), 0.16) * uEnergy, uOpacity * 0.42);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const POINT_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uHalfSize;
  uniform float uPixelRatio;
  attribute float aPhase;
  varying float vFade;
  varying vec3 vColor;
  ${PALETTE}
  void main() {
    float phase = fract(aPhase + uTime * 0.085);
    float r = mix(uHalfSize * 0.96, 0.27, phase);
    // Both members share a phase and a direction with opposite signs.
    vec3 p = position * r;
    vColor = otherSide(position);
    vFade = sin(phase * 3.14159265);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(10.0 / max(0.5, -mv.z), 3.0, 7.0) * uPixelRatio;
  }
`;
const POINT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uEnergy;
  varying float vFade;
  varying vec3 vColor;
  void main() {
    vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
    // Tiny luminous diamonds read as pieces of the cube, rather than bubbles.
    float d = p.x + p.y;
    float light = 1.0 - smoothstep(0.18, 0.95, d);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), light * 0.5) * uEnergy, light * vFade * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createAntiversePoints(pairs = ANTIVERSE_PAIRS) {
  const position = new Float32Array(pairs * 6), phase = new Float32Array(pairs * 2);
  const direction = new THREE.Vector3();
  for (let i = 0; i < pairs; i++) {
    const z = 1 - 2 * (i + 0.5) / pairs, angle = i * 2.399963229728653;
    const ring = Math.sqrt(1 - z * z);
    direction.set(Math.cos(angle) * ring, Math.sin(angle) * ring, z);
    direction.divideScalar(Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)));
    direction.toArray(position, i * 6);
    direction.negate().toArray(position, i * 6 + 3);
    phase[i * 2] = phase[i * 2 + 1] = (i * 0.61803398875) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  return geometry;
}

export function createAntiverse(size) {
  const half = antiverseHalfSize(size);
  const uniforms = {
    uTime: { value: 0 }, uOpacity: { value: 0 }, uEnergy: { value: 1 },
    uHalfSize: { value: half }, uPixelRatio: { value: 1 },
    uPalette: { value: Array.from({ length: 6 }, () => new THREE.Color()) }
  };
  const box = new THREE.BoxGeometry(half * 2, half * 2, half * 2);
  const edges = new THREE.EdgesGeometry(box), dots = createAntiversePoints();
  const material = (vertexShader, fragmentShader, extra = {}) => new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, ...extra
  });
  const wallMat = material(WALL_VERTEX, WALL_FRAGMENT, { side: THREE.BackSide, extensions: { derivatives: true } });
  const edgeMat = material(EDGE_VERTEX, EDGE_FRAGMENT);
  const pointMat = material(POINT_VERTEX, POINT_FRAGMENT, { blending: THREE.AdditiveBlending });
  const walls = new THREE.Mesh(box, wallMat);
  walls.name = 'antiverse-space'; walls.renderOrder = -2;
  const boundary = new THREE.LineSegments(edges, edgeMat);
  boundary.name = 'antiverse-boundary'; boundary.renderOrder = -1;
  const points = new THREE.Points(dots, pointMat);
  points.name = 'antiverse-pairs';
  const group = new THREE.Group(); group.name = 'antiverse'; group.visible = false;
  group.add(walls, boundary, points);
  group.traverse(object => { object.raycast = () => {}; });
  return {
    group, uniforms, points,
    dispose() { for (const resource of [box, edges, dots, wallMat, edgeMat, pointMat]) resource.dispose(); }
  };
}

// Closed cubes pay no atmosphere draws. A close WORM ride clears the field so
// its enlarged core and tunnel crossing remain readable and correctly occluded.
export function antiverseVisibility(state, zoom = 1, expansion = state.explosionT) {
  const openView = state.showCutawayLens || state.settings?.livePortalViews || state.hollowMode ||
    ['glass', 'gap', 'wireframe'].includes(state.visualMode);
  const exposure = openView ? 1 : Math.min(1, Math.max(0, expansion || 0) * 1.5);
  // Capture Mode hides UI chrome, not the running 3D scene.
  if (state.wormHealerMode && state.wormPhase === 'tunnel') return 0;
  return exposure * Math.max(0, Math.min(1, 1 - (zoom - 1) / 0.35));
}
