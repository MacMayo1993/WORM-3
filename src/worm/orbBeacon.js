// src/worm/orbBeacon.js
// The tile beacon under every parity orb: a soft ring of light on the tile the
// orb will be collected from, in the orb's own colour. It answers "which tile?"
// at a glance (an orb hovers, and on a curved cube its tile is not always the one
// straight below it on screen), and it wakes up as the worm closes in: the ring
// brightens and sends out pings, and the orb itself perks up (orbProximity).
//
// Every beacon on the board is one instanced draw. The ring is a coloured band
// over a soft dark contact shadow, so it reads on every sticker colour (a purely
// additive glow vanished on white and yellow tiles). Rings lie flat on their own
// tiles and never overlap, so one transparent batch cannot mis-sort them; it draws
// after the cubie bodies (renderOrder -1) and before the orbs' glass (0).
import * as THREE from 'three';
import { uploadInstancePrefix, setInstanceCount } from '../3d/instanceUploads.js';

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = v => v * v * (3 - 2 * v);

/** Distance (world units) at which an orb starts to notice the worm, and where it is fully awake. */
export const PROXIMITY_FAR = 1.9;
export const PROXIMITY_NEAR = 0.65;
/** Seconds between pings once the worm is close. */
export const PING_PERIOD = 1.1;

/** 0 far away → 1 when the worm's head is right at the orb. */
export function orbProximity(distance) {
  return smooth(clamp01((PROXIMITY_FAR - distance) / (PROXIMITY_FAR - PROXIMITY_NEAR)));
}

/**
 * The orb's own response to the worm: a small swell and faster spin. Reduced
 * motion keeps the orb still and lets the beacon's brightness carry the cue.
 */
export function orbPerkInto(out, near, reducedMotion = false) {
  out.scale = reducedMotion ? 1 : 1 + 0.16 * near;
  out.spin = 1 + 1.4 * near;
  return out;
}

/** How close (in orbProximity's 0→1) the worm must be before an orb's rings start to show. */
export const RING_FROM = 0.15;

/**
 * How much of its parity rings (the orbit rings, or the crossed halos and poles)
 * an orb wears: none at rest, so a full board reads as gems on their bands rather
 * than a field of rings, growing in as the worm closes on it. Reduced motion
 * shows or hides them whole.
 */
export function orbRingScale(near, reducedMotion = false) {
  if (reducedMotion) return near >= 0.5 ? 1 : 0;
  return smooth(clamp01((near - RING_FROM) / (1 - RING_FROM)));
}

/**
 * The resting ring and its ping. `arrival` (0→1) fades the beacon in with the
 * orb's reveal; `time` is the orb's own phased clock.
 * @returns {{ringScale, ringIntensity, pingVisible, pingScale, pingIntensity}}
 */
export function beaconPoseInto(out, time, near, arrival = 1, reducedMotion = false) {
  const breathe = reducedMotion ? 0 : Math.sin(time * 2.2) * 0.05;
  out.ringScale = 1 + breathe + 0.12 * near;
  // Far rings stay quiet so the board is not a field of targets; the ones the
  // worm is closing on light up.
  out.ringIntensity = arrival * (0.3 + 0.7 * near + (reducedMotion ? 0 : Math.sin(time * 2.2) * 0.06));
  const phase = ((time / PING_PERIOD) % 1 + 1) % 1;
  out.pingVisible = !reducedMotion && near > 0.05 && arrival >= 1;
  out.pingScale = 0.9 + 1.1 * smooth(phase);
  out.pingIntensity = out.pingVisible ? near * 0.8 * (1 - phase) * (1 - phase) : 0;
  return out;
}

/** Radius (fraction of the half-size) of the ring's bright band. */
export const BEACON_BAND = 0.7;

let _texture = null;
/**
 * The ring as a small RGBA map. RGB is white where the instance colour should
 * show (the band and a faint inner fill) and black for the contact shadow just
 * outside it; alpha is coverage.
 */
export function beaconTexture() {
  if (_texture) return _texture;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2; // 0 centre → 1 edge
      const band = Math.exp(-(((r - BEACON_BAND) / 0.075) ** 2));
      const fill = r < BEACON_BAND ? 0.16 * (r / BEACON_BAND) ** 2 : 0;
      const shadow = r > BEACON_BAND && r < 1 ? 0.38 * Math.exp(-(((r - 0.82) / 0.09) ** 2)) : 0;
      const lit = Math.min(1, band + fill);
      const a = r >= 1 ? 0 : Math.min(1, lit + shadow);
      const white = a > 0 ? lit / a : 0; // share of this texel that is colour, not shadow
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(255 * white);
      data[i + 3] = Math.round(a * 255);
    }
  }
  _texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  _texture.magFilter = THREE.LinearFilter;
  _texture.minFilter = THREE.LinearFilter;
  _texture.needsUpdate = true;
  return _texture;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

/**
 * The light a glass gem throws on its tile. Under every resting orb the beacon
 * carries a pool: a soft shadow the gem casts, a bright spot where it focuses
 * the light, and moving caustic filaments in the gem's colour. The shadow is what
 * lets it read on white and yellow stickers, where coloured light alone vanished.
 * It is drawn in the beacon's own program (per-instance `aCaustic`: strength and
 * phase), so it adds no draw and no program, and it runs on `uBeaconTime`, which
 * the orb loop holds still for reduced motion.
 */
export const CAUSTIC_POOL = 0.56; // radius of the pool, as a fraction of the beacon's half-size
// Caustic filaments: the edges of a slowly drifting, gently warped Voronoi
// network, the cell pattern light makes through a curved glass surface. Drawn a
// pixel or so wide from screen derivatives, so they stay crisp at chip size.
export const BEACON_CAUSTIC_GLSL = /* glsl */ `
vec2 orbCausticHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float orbCausticLines(vec2 q, float t) {
  vec2 p = q * 8.0;
  p += 0.3 * vec2(sin(p.y * 1.3 + t * 0.9), sin(p.x * 1.1 - t * 0.7));
  vec2 cell = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.4 * sin(t * 0.8 + 6.2831 * orbCausticHash(cell + g));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  float e = d2 - d1;
  float l = 1.0 - smoothstep(0.0, 0.16 + fwidth(e) * 1.5, e);
  return l * l;
}`;
export const BEACON_CAUSTIC_FRAGMENT = /* glsl */ `
  {
    vec2 bc = vMapUv - 0.5;
    float bcR = length(bc) * 2.0;
    float bcPool = (1.0 - smoothstep(0.16, ${CAUSTIC_POOL.toFixed(2)}, bcR)) * vBeaconCaustic.x;
    float bcLines = orbCausticLines(bc, uBeaconTime + vBeaconCaustic.y);
    float bcFocus = exp(-bcR * bcR / 0.012);
    float shadeA = bcPool * 0.42 * (1.0 - bcFocus);
    float lightA = clamp((bcLines * 0.8 + bcFocus) * bcPool, 0.0, 1.0);
    // The gem's shadow over the ring, then its light over both (non-premultiplied "over").
    float a1 = shadeA + diffuseColor.a * (1.0 - shadeA);
    vec3 c1 = diffuseColor.rgb * diffuseColor.a * (1.0 - shadeA) / max(a1, 1e-4);
    vec3 lightC = mix(vColor, vec3(1.0), 0.25 + 0.55 * bcFocus);
    float a2 = lightA + a1 * (1.0 - lightA);
    diffuseColor.rgb = (lightC * lightA + c1 * a1 * (1.0 - lightA)) / max(a2, 1e-4);
    diffuseColor.a = a2;
  }`;

/**
 * One InstancedMesh for every beacon (ring and ping) on the board. Each instance
 * carries the orb's colour, an opacity (`aIntensity`) and its caustic pool
 * (`aCaustic`), patched into the one shared material, so a fading ping never
 * darkens into a shadow ring.
 */
export function createOrbBeacons(capacity = 512) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aIntensity', opacity);
  const caustic = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  caustic.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aCaustic', caustic);
  const time = { value: 0 };
  const material = new THREE.MeshBasicMaterial({
    map: beaconTexture(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    // Transparent + DoubleSide would otherwise draw in two passes, flipping `side`
    // and re-selecting the program every frame. A flat decal needs one pass.
    forceSinglePass: true
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uBeaconTime = time;
    shader.vertexShader = 'attribute float aIntensity;\nattribute vec2 aCaustic;\nvarying float vBeaconIntensity;\nvarying vec2 vBeaconCaustic;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBeaconIntensity = aIntensity;\n  vBeaconCaustic = aCaustic;');
    shader.fragmentShader = 'varying float vBeaconIntensity;\nvarying vec2 vBeaconCaustic;\nuniform float uBeaconTime;\n' + BEACON_CAUSTIC_GLSL + '\n' +
      shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vBeaconIntensity;' + BEACON_CAUSTIC_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'orb-beacon';
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'ParityOrbBeacons';
  mesh.frustumCulled = false; // placed under culled orbs only
  mesh.raycast = () => {};
  mesh.renderOrder = -0.5; // after the worm-mode cubie bodies (-1), before the orbs' glass (0)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, _c.setRGB(1, 1, 1)); // allocate the colour buffer up front
  mesh.count = 0;
  let count = 0;
  return {
    mesh,
    begin() { count = 0; },
    /** The caustics' clock (seconds); hold it still for reduced motion. */
    setTime(seconds) { time.value = seconds; },
    /**
     * Lay a ring of world `diameter` flat on a tile with outward `normal`. `color`
     * is a THREE.Color or CSS string. `pool` (0 → 1) adds the gem's caustic pool
     * under it, at caustic clock offset `phase`; pings pass none.
     */
    add(position, normal, diameter, color, intensity, pool = 0, phase = 0) {
      if (count >= capacity || (intensity <= 0.002 && pool <= 0.002)) return;
      _q.setFromUnitVectors(_z, normal);
      _m.compose(position, _q, _s.setScalar(diameter));
      mesh.setMatrixAt(count, _m);
      mesh.setColorAt(count, color.isColor ? color : _c.set(color));
      opacity.array[count] = Math.min(1, Math.max(0, intensity));
      caustic.array[count * 2] = Math.min(1, Math.max(0, pool));
      caustic.array[count * 2 + 1] = phase;
      count++;
    },
    end() {
      setInstanceCount(mesh, count);
      uploadInstancePrefix(mesh.instanceMatrix, count);
      if (mesh.instanceColor) uploadInstancePrefix(mesh.instanceColor, count);
      uploadInstancePrefix(opacity, count);
      uploadInstancePrefix(caustic, count);
    },
    get count() { return count; },
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); }
  };
}
