// src/worm/orbComet.js
// A comet of light that runs round every parity orb's Möbius band, in the gem's
// colour (the band's antipode). A Möbius band has one side: the comet keeps to the
// side it started on and, one lap later, comes back on the OTHER face of the band
// without crossing an edge. It needs a second lap to come home. That is the orb's
// parity told in motion, with no extra ring or label.
//
// The comet rides the band's `aLoop` coordinate (parityGeometry.js): 0 → 1 round
// the near copy of the surface, 1 → 2 round the far copy. Each copy is drawn
// front-face only and lifted a hair along its own normal, so the half of the lap
// on the side facing away is hidden by the band itself, as it would be.
//
// Every comet on the board is one instanced draw per band geometry (ordinary and
// target), over the band's own geometry, with a per-instance head position and
// strength. The meshes exist from mount (hidden while empty) so the run's
// warm-up links their one program before play.
import * as THREE from 'three';
import { uploadInstancePrefix, setInstanceCount, ensureInstanceColor } from '../3d/instanceUploads.js';

/** Laps per second along `aLoop` (one lap is 1.0; home again after 2.0). */
export const COMET_LAPS_PER_SECOND = 0.6;
/** How much faster the comet runs once the worm is right at the orb. */
export const COMET_NEAR_BOOST = 1.2;
/** Tail length, in laps. */
export const COMET_TAIL = 0.75;
/** Lift off the band along its normal, in the geometry's (scaled) units. */
export const COMET_LIFT = 0.005;
/** How much the band dims away from the comet (0 → 1), so the comet reads on any band colour. */
export const COMET_BAND_DIM = 0.2;
/** Seconds the comet takes to fade in once its orb has arrived. */
export const COMET_FADE_IN = 0.6;

/**
 * Advances a comet's head (0 → 2) by one frame. Reduced motion holds it still,
 * as a fixed highlight on the band.
 */
export function stepCometHead(head, dt, near = 0, reducedMotion = false) {
  if (reducedMotion) return head;
  const next = head + dt * COMET_LAPS_PER_SECOND * (1 + COMET_NEAR_BOOST * near);
  return next - 2 * Math.floor(next / 2);
}

/**
 * Brightness of the comet down the band's centreline at band position `loop`
 * for a head at `head` (both 0 → 2), mirroring the shader so the shape can be tested: full at the head,
 * fading back along the tail, a short soft glow just ahead, nothing elsewhere.
 * The far copy of the surface (loop 1 → 2) is a different place from the near
 * copy at the same angle, so a head on lap one does not light lap two.
 */
export function cometIntensity(loop, head) {
  const behind = ((head - loop) % 2 + 2) % 2;
  const ahead = 2 - behind;
  const tail = behind < COMET_TAIL ? (1 - behind / COMET_TAIL) ** 1.6 : 0;
  const glow = Math.exp(-((ahead / 0.04) ** 2));
  return Math.max(tail, glow);
}

const VERTEX = /* glsl */ `
attribute float aLoop;
attribute vec2 aComet; // head (0 → 2), strength
uniform float uLift;
varying float vLoop;
varying vec2 vComet;
varying float vAcross;
varying vec3 vCometColor;
void main() {
  vLoop = aLoop;
  vComet = aComet;
  vAcross = uv.y * 2.0 - 1.0;
#ifdef USE_INSTANCING_COLOR
  vCometColor = instanceColor;
#else
  vCometColor = vec3(1.0);
#endif
  vec4 p = vec4(position + normal * uLift, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;

const FRAGMENT = /* glsl */ `
uniform float uTail;
uniform float uDim;
varying float vLoop;
varying vec2 vComet;
varying float vAcross;
varying vec3 vCometColor;
void main() {
  float behind = mod(vComet.x - vLoop, 2.0);
  float ahead = 2.0 - behind;
  // Along the loop: the tail fading back from the head, a short glow ahead.
  float along = behind < uTail ? pow(1.0 - behind / uTail, 1.6) : 0.0;
  along = max(along, exp(-pow(ahead / 0.04, 2.0)));
  // Across the band: a narrow white-hot filament down the middle inside a
  // softer halo in the gem's colour, and a bright bead at the head. A full-width
  // wash read as a specular highlight, not as something moving.
  float x2 = vAcross * vAcross;
  float core = along * exp(-x2 / 0.14);
  float halo = along * exp(-x2 / 0.6) * 0.7;
  float head = exp(-pow(behind / 0.05, 2.0) - x2 / 0.25);
  float lit = clamp(max(max(core, halo), head), 0.0, 1.0);
  // The rest of the band dims a little, so the comet reads on a band of any
  // colour (a white gem's comet on a white or yellow band did not).
  float a = (lit + uDim * (1.0 - lit)) * vComet.y;
  if (a < 0.004) discard;
  vec3 color = mix(vCometColor, vec3(1.0), clamp(0.3 + 0.7 * max(core, head), 0.0, 1.0));
  gl_FragColor = vec4(color * lit * vComet.y / a, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

let _material = null;
/** The one comet material (one program for every comet on the board). */
export function cometMaterial() {
  if (_material) return _material;
  _material = new THREE.ShaderMaterial({
    name: 'ParityOrbComet',
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uLift: { value: COMET_LIFT }, uTail: { value: COMET_TAIL }, uDim: { value: COMET_BAND_DIM } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  return _material;
}

const _c = new THREE.Color();

// The comet draws over the band's own buffers (index, position, normal, uv,
// aLoop) through a geometry object of its own that adds the per-instance head
// and strength, so nothing extra rides on the band the stickers' materials draw.
const SHARED = ['position', 'normal', 'uv', 'aLoop'];
function cometGeometryOver(band) {
  const geometry = new THREE.BufferGeometry();
  geometry.index = band.index;
  for (const name of SHARED) geometry.setAttribute(name, band.getAttribute(name));
  return geometry;
}
// Disposing a geometry deletes the GPU buffers of everything still on it: let go
// of the band's buffers first, so only the comet's own attribute is freed.
function releaseCometGeometry(geometry) {
  geometry.index = null;
  for (const name of SHARED) geometry.deleteAttribute(name);
  geometry.dispose();
}

/**
 * One InstancedMesh per band geometry, made up front for each geometry passed.
 * Per frame: begin(root) → add(bandMesh, color, head, strength) → end().
 */
export function createOrbComets(geometries, capacity = 256) {
  const group = new THREE.Group();
  group.name = 'ParityOrbComets';
  const pools = new Map();
  const inverse = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  for (const geometry of geometries) {
    if (pools.has(geometry)) continue;
    const shared = cometGeometryOver(geometry);
    const comet = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    comet.setUsage(THREE.DynamicDrawUsage);
    shared.setAttribute('aComet', comet);
    const mesh = new THREE.InstancedMesh(shared, cometMaterial(), capacity);
    mesh.name = 'ParityOrbComet';
    mesh.frustumCulled = false; // its orbs were culled already
    mesh.raycast = () => {};
    // After the beacons (-0.5), before the orbs' glass (0), so the shell glazes it.
    mesh.renderOrder = -0.4;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ensureInstanceColor(mesh); // the program the warm-up links must be the one drawn
    mesh.count = 0;
    mesh.visible = false;
    group.add(mesh);
    pools.set(geometry, { mesh, comet, count: 0 });
  }
  return {
    group,
    begin(root) {
      root.updateWorldMatrix(true, false);
      inverse.copy(root.matrixWorld).invert();
      for (const pool of pools.values()) pool.count = 0;
    },
    /** Puts a comet on `band` (a mesh whose geometry was passed in). */
    add(band, color, head, strength) {
      if (!band || strength <= 0.002) return;
      const pool = pools.get(band.geometry);
      if (!pool || pool.count >= capacity) return;
      const i = pool.count++;
      local.multiplyMatrices(inverse, band.matrixWorld);
      pool.mesh.setMatrixAt(i, local);
      pool.mesh.setColorAt(i, color.isColor ? color : _c.set(color));
      pool.comet.array[i * 2] = head;
      pool.comet.array[i * 2 + 1] = Math.min(1, strength);
    },
    end() {
      for (const { mesh, comet, count } of pools.values()) {
        setInstanceCount(mesh, count);
        uploadInstancePrefix(mesh.instanceMatrix, count);
        if (mesh.instanceColor) uploadInstancePrefix(mesh.instanceColor, count);
        uploadInstancePrefix(comet, count);
      }
    },
    count(geometry) { return pools.get(geometry)?.count ?? 0; },
    dispose() {
      for (const { mesh } of pools.values()) { releaseCometGeometry(mesh.geometry); mesh.dispose(); }
      group.clear();
      pools.clear();
    },
  };
}
