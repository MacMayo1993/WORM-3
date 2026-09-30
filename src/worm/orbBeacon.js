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

/**
 * The resting ring and its ping. `arrival` (0→1) fades the beacon in with the
 * orb's reveal; `time` is the orb's own phased clock.
 * @returns {{ringScale, ringIntensity, pingVisible, pingScale, pingIntensity}}
 */
export function beaconPoseInto(out, time, near, arrival = 1, reducedMotion = false) {
  const breathe = reducedMotion ? 0 : Math.sin(time * 2.2) * 0.05;
  out.ringScale = 1 + breathe + 0.12 * near;
  out.ringIntensity = arrival * (0.55 + 0.45 * near + (reducedMotion ? 0 : Math.sin(time * 2.2) * 0.06));
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
 * One InstancedMesh for every beacon (ring and ping) on the board. Each instance
 * carries the orb's colour and an opacity (`aIntensity`), patched into the one
 * shared material, so a fading ping never darkens into a shadow ring.
 */
export function createOrbBeacons(capacity = 512) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aIntensity', opacity);
  const material = new THREE.MeshBasicMaterial({
    map: beaconTexture(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    // Transparent + DoubleSide would otherwise draw in two passes, flipping `side`
    // and re-selecting the program every frame. A flat decal needs one pass.
    forceSinglePass: true
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aIntensity;\nvarying float vBeaconIntensity;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBeaconIntensity = aIntensity;');
    shader.fragmentShader = 'varying float vBeaconIntensity;\n' +
      shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vBeaconIntensity;');
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
    /** Lay a ring of world `diameter` flat on a tile with outward `normal`. `color` is a THREE.Color or CSS string. */
    add(position, normal, diameter, color, intensity) {
      if (count >= capacity || intensity <= 0.002) return;
      _q.setFromUnitVectors(_z, normal);
      _m.compose(position, _q, _s.setScalar(diameter));
      mesh.setMatrixAt(count, _m);
      mesh.setColorAt(count, color.isColor ? color : _c.set(color));
      opacity.array[count] = Math.min(1, intensity);
      count++;
    },
    end() {
      setInstanceCount(mesh, count);
      uploadInstancePrefix(mesh.instanceMatrix, count);
      if (mesh.instanceColor) uploadInstancePrefix(mesh.instanceColor, count);
      uploadInstancePrefix(opacity, count);
    },
    get count() { return count; },
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); }
  };
}
