// Shared playable MOBI geometry: gameplay and every picker use this same rig.
// MOBI is the guide from the dialogue art (public/Mobi.png): a chunky, pearly
// block with a glowing window in every face, Rubik's-cube eyes and bulb
// antennae. The carried parity orb floats in antipodal gas behind the windows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMobiGasMaterial } from './mobiEnergyMaterials.js';
import { prefersReducedMotion } from '../utils/device.js';
import { wormBlink } from './wormFaceExpression.js';
import { createParityMobiusGeometry } from './parityGeometry.js';

export const MOBI_RADIUS = 0.12;
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _step = new THREE.Vector3();

/** Local -Z points forward; +Y follows the surface, including tunnel twists. */
export function orientMobi(object, forward, up) {
  _y.copy(up).normalize();
  if (_y.lengthSq() < 1e-8) _y.set(0, 1, 0);
  _z.copy(forward).negate().addScaledVector(_y, forward.dot(_y));
  if (_z.lengthSq() < 1e-8) {
    _z.set(Math.abs(_y.x) < 0.9 ? 1 : 0, Math.abs(_y.x) < 0.9 ? 0 : 1, 0);
    _z.addScaledVector(_y, -_z.dot(_y));
  }
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _basis.makeBasis(_x, _y, _z);
  object.quaternion.setFromRotationMatrix(_basis);
}

// Pearly violet → teal, the guide art's holographic shell.
const PEARL_TOP = new THREE.Color('#8a5cff');
const PEARL_BOTTOM = new THREE.Color('#14b4d8');
const PEARL_CORNER = new THREE.Color('#e2d6ff');
const WINDOW_GLOW = new THREE.Color('#5ff2ff');

// A plain box whose normals lean out toward its long edges, so it shades like
// a rounded beam for 36 vertices instead of a RoundedBoxGeometry's 900.
function pillowBox(dims, lean, longAxis = -1) {
  const box = new THREE.BoxGeometry(...dims).toNonIndexed();
  const position = box.attributes.position, normal = box.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(normal, i);
    for (let axis = 0; axis < 3; axis++) {
      if (axis === longAxis || Math.abs(n.getComponent(axis)) > 0.5) continue;
      n.setComponent(axis, lean * Math.sign(position.getComponent(i, axis)));
    }
    n.normalize().toArray(normal.array, i * 3);
  }
  return box;
}

// One outward-facing quad (the window lips only ever show their front).
function lipQuad(axis, sign, along, across, center, length, width) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  const positions = new Float32Array(18), normals = new Float32Array(18);
  corners.forEach(([u, v], i) => {
    const p = [...center];
    p[along] += u * length / 2; p[across] += v * width / 2;
    positions.set(p, i * 3);
    normals[i * 3 + axis] = sign;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  // Wind each quad to face out of its window.
  const a = new THREE.Vector3(...positions.slice(0, 3)), b = new THREE.Vector3(...positions.slice(3, 6)), c = new THREE.Vector3(...positions.slice(6, 9));
  if (b.sub(a).cross(c.sub(a)).getComponent(axis) * sign < 0) {
    for (let t = 0; t < 2; t++) for (let k = 0; k < 3; k++) {
      const i = t * 3 + 1, j = t * 3 + 2;
      [positions[i * 3 + k], positions[j * 3 + k]] = [positions[j * 3 + k], positions[i * 3 + k]];
    }
  }
  return geometry;
}

/**
 * The shell's bezel: shared by the head and every tail block, so it is one
 * merged geometry with vertex colours and a per-vertex `mobiGlow` weight (the
 * lit inner lip of each window). Draw it with createMobiFrameMaterial().
 * `smooth` builds truly rounded beams for single meshes (the head, previews);
 * the gameplay tail instances hundreds of blocks and takes the pillow-shaded
 * build (~0.9k vertices rather than ~19k), identical at chase distance.
 */
export function createMobiFrameGeometry({ smooth = true } = {}) {
  const pieces = [];
  const roles = [];
  const BEAM = 0, CAP = 1, LIP = 2;
  const push = (geometry, role) => { pieces.push(geometry.index ? geometry.toNonIndexed() : geometry); roles.push(role); };
  // Twelve chunky bevelled beams leave a square window in every face.
  const beam = 0.36, inner = 1 - beam / 2;
  for (let axis = 0; axis < 3; axis++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const dims = [beam, beam, beam]; dims[axis] = 1.7;
    const edge = smooth ? new RoundedBoxGeometry(...dims, 2, 0.07) : pillowBox(dims, 0.45, axis);
    const pos = [0, 0, 0]; pos[(axis + 1) % 3] = a * inner; pos[(axis + 2) % 3] = b * inner;
    edge.translate(...pos); push(edge, BEAM);
  }
  // Rounded corner caps stand a hair proud, as on the dialogue art.
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const cap = smooth ? new RoundedBoxGeometry(0.44, 0.44, 0.44, 2, 0.12) : pillowBox([0.44, 0.44, 0.44], 0.5);
    push(cap.translate(x * 0.8, y * 0.8, z * 0.8), CAP);
  }
  // A lit lip inside each window's rim: 6 faces × 4 sides.
  const lip = 1 - beam - 0.012;
  for (let axis = 0; axis < 3; axis++) for (const s of [-1, 1]) for (let side = 1; side <= 2; side++) for (const t of [-1, 1]) {
    const along = (axis + (side === 1 ? 2 : 1)) % 3, across = (axis + side) % 3;
    const pos = [0, 0, 0];
    pos[axis] = s * 1.002; pos[across] = t * lip;
    push(lipQuad(axis, s, along, across, pos, 2 * lip, 0.04), LIP);
  }
  const color = new THREE.Color();
  pieces.forEach((piece, i) => {
    piece.deleteAttribute('uv');
    const position = piece.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const glow = new Float32Array(position.count).fill(roles[i] === LIP ? 1 : 0);
    for (let j = 0; j < position.count; j++) {
      if (roles[i] === LIP) color.copy(WINDOW_GLOW);
      else {
        const x = position.getX(j), y = position.getY(j), z = position.getZ(j);
        color.copy(PEARL_BOTTOM).lerp(PEARL_TOP, THREE.MathUtils.clamp(0.5 + y * 0.4 + x * 0.12 - z * 0.08, 0, 1));
        if (roles[i] === CAP) color.lerp(PEARL_CORNER, 0.4);
      }
      color.toArray(colors, j * 3);
    }
    piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    piece.setAttribute('mobiGlow', new THREE.BufferAttribute(glow, 1));
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach(p => p.dispose());
  return geometry;
}

/** Pearly, iridescent bezel with self-lit window lips; works instanced or not. */
export function createMobiFrameMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.34, metalness: 0.22,
    clearcoat: 0.8, clearcoatRoughness: 0.14,
    iridescence: 0.55, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 620],
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mobiGlow;\nvarying float vMobiGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMobiGlow = mobiGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMobiGlow;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.12 + vMobiGlow * 1.6);');
  };
  material.customProgramCacheKey = () => 'mobi-frame';
  return material;
}

export function createMobiShellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#d9ccff', emissive: '#5f4c96', emissiveIntensity: 0.3, roughness: 0.12, metalness: 0.05,
    clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, transparent: true, opacity: 0.26,
    depthWrite: false, side: THREE.FrontSide,
  });
}

// Eyes are 3×3 cube faces. Stickers are one merged mesh; the pupil slides over them.
function createEyeStickerGeometry() {
  const pieces = [];
  const color = new THREE.Color();
  for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
    const piece = new RoundedBoxGeometry(0.165, 0.165, 0.04, 1, 0.035).translate(c * 0.19, r * 0.19, 0);
    color.set(r === 0 && c === 0 ? '#f4feff' : (r + c) % 2 === 0 ? '#bdf6ff' : '#7fe6fb');
    const colors = new Float32Array(piece.attributes.position.count * 3);
    for (let j = 0; j < colors.length; j += 3) color.toArray(colors, j);
    piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(piece);
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach(p => p.dispose());
  return geometry;
}

function createAntennaGeometry(sign) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.38, 0.05), new THREE.Vector3(sign * 0.16, 0.62, -0.1));
  return new THREE.TubeGeometry(curve, 10, 0.045, 6, false);
}

export function createMobiModel({ face = true } = {}) {
  const group = new THREE.Group();
  group.name = 'MOBI';
  // Everything MOBI draws lives under `body`, so the caller can place, orient and
  // scale `group` while the rig bobs, squashes and tilts inside it.
  const body = new THREE.Group();
  body.name = 'mobi-body';
  group.add(body);
  const light = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const cyan = light('#80e8ff');
  const violet = light('#bd92ff');
  const shellMaterial = createMobiShellMaterial();
  const shellGeometry = new RoundedBoxGeometry(2, 2, 2, 2, 0.12);
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.name = 'transparent-body';
  shell.renderOrder = 2;
  body.add(shell);
  const frame = new THREE.Mesh(createMobiFrameGeometry(), createMobiFrameMaterial());
  frame.name = 'body-frame';
  body.add(frame);
  const gas = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12), createMobiGasMaterial());
  gas.name = 'antipodal-gas';
  gas.renderOrder = 1;
  body.add(gas);

  // Miniature of the collectible's crossed halos, antipodal axis and Möbius band.
  // Enlarged carried orb, still enclosed throughout its full rotation.
  const core = new THREE.Group();
  core.name = 'parity-core';
  const primary = light('#80e8ff');
  const secondary = light('#bd92ff');
  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: '#80e8ff', emissive: '#80e8ff', emissiveIntensity: 0.6,
    roughness: 0.06, metalness: 0, iridescence: 1, clearcoat: 1,
    transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false,
  });
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), gemMaterial);
  gem.name = 'orb-shell';
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), primary);
  plasma.name = 'orb-plasma';
  core.add(plasma);
  core.add(gem);
  const haloGeo = new THREE.TorusGeometry(0.30, 0.014, 6, 32);
  const halo = new THREE.Mesh(haloGeo, primary);
  halo.rotation.x = Math.PI / 2;
  const crossed = new THREE.Mesh(haloGeo, secondary);
  crossed.rotation.set(Math.PI / 2, Math.PI / 3, 0);
  core.add(halo, crossed);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.013, 6, 32), secondary);
  orbit.rotation.set(0.65, 0.35, 0.4);
  core.add(orbit);
  core.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.66, 8), primary));
  const nodeGeo = new THREE.SphereGeometry(0.047, 12, 8);
  for (const sign of [-1, 1]) {
    const node = new THREE.Mesh(nodeGeo, sign === 1 ? primary : secondary);
    node.name = sign === 1 ? 'positive-pole' : 'negative-pole';
    node.position.y = sign * 0.33;
    core.add(node);
  }
  const band = new THREE.Mesh(createParityMobiusGeometry(0.30, 0.065),
    new THREE.MeshStandardMaterial({ color: '#bd92ff', emissive: '#805ec8', emissiveIntensity: 0.7, roughness: 0.24 }));
  core.add(band);
  core.scale.setScalar(2.05);
  const ownedBandMaterial = band.material;
  body.add(core);

  const rig = {
    group, body, core, gem, gas, band, eyes: [], pupils: [], brows: [], stickers: [], antennae: [], cheeks: [],
    primary, secondary, ownedBandMaterial, shellMaterial, lastTime: null, transitRoll: 0,
    // Secondary-motion state; advanced only by the caller's (pause-aware) clock.
    motion: {
      lastPos: new THREE.Vector3(), lastFwd: new THREE.Vector3(), hasPose: false,
      gait: 0, stride: 0, turn: 0, lean: 0,
      antenna: [{ x: 0, z: 0, vx: 0, vz: 0 }, { x: 0, z: 0, vx: 0, vz: 0 }],
      gaze: new THREE.Vector2(), twist: 0,
    },
  };

  if (!face) {
    cyan.dispose(); violet.dispose();
    group.scale.setScalar(MOBI_RADIUS);
    return rig;
  }

  // The face is a dark glossy screen set into the front window; the cube eyes
  // stand proud of it like the guide's, and read at gameplay distance.
  const screenMaterial = new THREE.MeshPhysicalMaterial({
    color: '#16213a', emissive: '#1d3a5c', emissiveIntensity: 0.45, roughness: 0.18, metalness: 0.2, clearcoat: 1,
  });
  const screen = new THREE.Mesh(new RoundedBoxGeometry(1.44, 1.44, 0.12, 2, 0.1), screenMaterial);
  screen.name = 'face-screen';
  screen.position.z = -0.9;
  body.add(screen);

  const eyeBody = new THREE.MeshPhysicalMaterial({ color: '#1a2233', roughness: 0.3, metalness: 0.2, clearcoat: 1 });
  const stickerMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const dark = new THREE.MeshBasicMaterial({ color: '#10192b' });
  const glintMaterial = light('#ffffff');
  const eyeGeo = new RoundedBoxGeometry(0.64, 0.64, 0.5, 2, 0.09);
  const stickerGeo = createEyeStickerGeometry();
  const pupilGeo = new RoundedBoxGeometry(0.25, 0.27, 0.05, 2, 0.06);
  const glintGeo = new THREE.BoxGeometry(0.07, 0.07, 0.02);
  const browGeo = new RoundedBoxGeometry(0.52, 0.08, 0.07, 1, 0.03);
  for (const sign of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sign * 0.4, 0.28, -1.12);
    // Tip the lenses towards the gameplay camera, clear of the hat seat.
    eye.rotation.x = 0.2;
    eye.add(new THREE.Mesh(eyeGeo, eyeBody));
    const stickers = new THREE.Mesh(stickerGeo, stickerMaterial);
    stickers.position.z = -0.26;
    eye.add(stickers);
    const pupil = new THREE.Mesh(pupilGeo, dark);
    pupil.position.set(0, 0, -0.3);
    eye.add(pupil);
    const glint = new THREE.Mesh(glintGeo, glintMaterial);
    glint.position.set(0.05, 0.07, -0.03);
    pupil.add(glint);
    const brow = new THREE.Mesh(browGeo, violet);
    brow.position.set(0, 0.42, -0.1);
    eye.add(brow);
    rig.eyes.push(eye); rig.pupils.push(pupil); rig.brows.push(brow); rig.stickers.push(stickers);
    body.add(eye);

    // Bulb antennae hinge at their base and lag behind MOBI's motion.
    const antenna = new THREE.Group();
    antenna.position.set(sign * 0.5, 0.98, 0.2);
    antenna.add(new THREE.Mesh(createAntennaGeometry(sign), violet));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), cyan);
    bulb.position.set(sign * 0.16, 0.62, -0.1);
    antenna.add(bulb);
    rig.antennae.push(antenna);
    body.add(antenna);

    const cheek = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.04, 1, 0.03),
      light('#ff8fcb'));
    cheek.position.set(sign * 0.52, -0.2, -0.99);
    rig.cheeks.push(cheek);
    body.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 24, Math.PI), cyan);
  smile.position.set(0, -0.3, -0.99);
  smile.rotation.z = Math.PI;
  smile.scale.y = 0.62;
  body.add(smile);
  rig.smile = smile;
  group.scale.setScalar(MOBI_RADIUS);
  return rig;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// Deterministic "random" for gaze targets: same time, same look.
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Time is supplied by the caller's pause-aware clock; no independent timers.
 * Call after placing and orienting `rig.group`: MOBI reads its own travel from
 * that pose to drive the gait, lean and antenna lag.
 */
export function animateMobi(rig, time, { pulse = 0, transit = false } = {}) {
  const reduced = prefersReducedMotion();
  if (reduced) { time = 0; pulse = 0; transit = false; }
  rig.gas.material.uniforms.uTime.value = time;
  rig.gas.material.uniforms.uMotion.value = reduced ? 0 : 1;
  const dt = rig.lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - rig.lastTime));
  rig.lastTime = time;
  if (transit) rig.transitRoll += dt * 1.3;
  rig.core.rotation.set(Math.PI / 4 + time * 0.32, time * 0.48, Math.PI / 4 + rig.transitRoll);
  rig.band.rotation.y = -time * 0.6;
  const joy = clamp01(pulse);
  rig.gem.scale.setScalar(1 + Math.sin(time * 3) * 0.08 + joy * 0.35);

  // ── Read travel from the caller's pose ────────────────────────────────────
  const m = rig.motion;
  _fwd.set(0, 0, -1).applyQuaternion(rig.group.quaternion);
  _up.set(0, 1, 0).applyQuaternion(rig.group.quaternion);
  let speed = 0, turn = 0;
  if (m.hasPose && dt > 0) {
    _step.subVectors(rig.group.position, m.lastPos);
    const scale = Math.max(1e-4, rig.group.scale.x);
    // Tunnel exits and respawns teleport the head; that is not a stride.
    if (_step.length() < scale * 12) speed = Math.max(0, _step.dot(_fwd)) / dt / scale;
    turn = _step.copy(m.lastFwd).cross(_fwd).dot(_up) / dt;
  }
  m.lastPos.copy(rig.group.position); m.lastFwd.copy(_fwd); m.hasPose = true;
  if (reduced) { speed = 0; turn = 0; }
  const k = Math.min(1, dt * 6);
  // Gameplay crawls at roughly 20–40 head radii a second.
  m.gait += (clamp01(speed / 18) - m.gait) * k;
  m.turn += (THREE.MathUtils.clamp(turn, -4, 4) - m.turn) * k;
  m.stride += dt * (2.2 + m.gait * 9);
  const gait = m.gait;

  // ── Body: hop-bob, squash on each landing, lean into turns ────────────────
  const hop = Math.abs(Math.sin(m.stride));
  const idle = 1 - gait;
  const bob = (hop * 0.1 * gait + Math.sin(time * 1.8) * 0.035 * idle) * (reduced ? 0 : 1);
  const land = (1 - hop) * gait;
  const squash = 1 - land * 0.09 + joy * 0.06;
  rig.body.position.set(0, bob, 0);
  rig.body.scale.set(1 + (1 - squash) * 0.7, squash, 1 + (1 - squash) * 0.7);
  // Curious head tilt at rest, nose-down lean when crawling, bank into turns.
  rig.body.rotation.set(
    -gait * 0.12 + Math.sin(m.stride * 2) * 0.03 * gait,
    m.turn * 0.05,
    Math.sin(time * 0.7) * 0.1 * idle - m.turn * 0.07 + Math.sin(m.stride) * 0.035 * gait,
  );
  if (reduced) rig.body.rotation.set(0, 0, 0);

  if (!rig.eyes.length) return;

  // ── Eyes: saccades, look into turns, a Rubik's twist now and then ─────────
  const beat = Math.floor(time / 1.6);
  const into = clamp01((time - beat * 1.6) / 0.12);
  const prevX = hash(beat - 1) * 2 - 1, prevY = hash(beat + 90) * 2 - 1;
  const nextX = hash(beat) * 2 - 1, nextY = hash(beat + 91) * 2 - 1;
  const e = smooth(into);
  const gazeX = THREE.MathUtils.clamp((prevX + (nextX - prevX) * e) * 0.07 - m.turn * 0.04, -0.1, 0.1);
  const gazeY = (prevY + (nextY - prevY) * e) * 0.05 + joy * 0.06;
  const blink = wormBlink(time, 4.4) * wormBlink(time + 0.28, 13.2);
  // Every ~9s one eye twists its front layer a quarter turn, like a cube move.
  const twistPhase = (time % 9.3) / 9.3;
  const twistT = clamp01((twistPhase - 0.5) / 0.05);
  const twist = smooth(twistT) * Math.PI / 2;
  rig.eyes.forEach((eye, i) => {
    eye.scale.set(1 + joy * 0.12, blink * (1 + joy * 0.14), 1);
    rig.pupils[i].position.set(gazeX, gazeY, -0.3);
    rig.pupils[i].scale.setScalar(1 - joy * 0.2);
    rig.stickers[i].rotation.z = i === (Math.floor(time / 9.3) % 2) ? twist : 0;
    rig.brows[i].rotation.z = (i ? -1 : 1) * (0.09 + joy * 0.22) + m.turn * 0.04;
    rig.brows[i].position.y = 0.42 + joy * 0.08 + gait * 0.02;
    rig.cheeks[i].scale.setScalar(1 + joy * 0.35);
  });
  if (rig.smile) rig.smile.scale.set(1 + joy * 0.15, 0.62 + joy * 0.45, 1);

  // ── Antennae: damped springs pushed by stride, turns and delight ──────────
  rig.antennae.forEach((antenna, i) => {
    const s = m.antenna[i];
    const side = i ? 1 : -1;
    const targetX = gait * 0.35 + (reduced ? 0 : Math.sin(time * 1.3 + i) * 0.06);
    const targetZ = m.turn * 0.18 + side * (0.08 + joy * 0.25);
    const kick = (1 - hop) * gait * 6 - joy * 4;
    if (dt > 0) {
      s.vx += ((targetX - s.x) * 90 - s.vx * 9 + kick) * dt;
      s.vz += ((targetZ - s.z) * 90 - s.vz * 9) * dt;
      s.x += s.vx * dt; s.z += s.vz * dt;
      s.x = THREE.MathUtils.clamp(s.x, -0.6, 0.8); s.z = THREE.MathUtils.clamp(s.z, -0.7, 0.7);
    }
    antenna.rotation.set(reduced ? 0 : s.x, 0, reduced ? side * 0.08 : s.z);
  });
}

const _headQuat = new THREE.Quaternion();
/**
 * The animated head's frame in `rig.group`'s parent space (call after
 * animateMobi and after the caller sets the group's scale), so hats and face
 * accessories bob, lean and tilt with MOBI instead of hovering at the anchor.
 */
export function mobiHeadFrameInto(rig, center, forward, normal, quaternion = null) {
  _headQuat.copy(rig.group.quaternion).multiply(rig.body.quaternion);
  center.copy(rig.body.position).applyQuaternion(rig.group.quaternion)
    .multiplyScalar(rig.group.scale.x).add(rig.group.position);
  forward.set(0, 0, -1).applyQuaternion(_headQuat);
  normal.set(0, 1, 0).applyQuaternion(_headQuat);
  if (quaternion) quaternion.copy(_headQuat);
  return center;
}

export function disposeMobi(rig) {
  // Styled bands borrow the same cached material as the world pickups.
  rig.band.material = rig.ownedBandMaterial;
  const geometries = new Set();
  const materials = new Set();
  rig.group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}

export function setMobiOrbAppearance(rig, appearance) {
  rig.primary.color.set(appearance.gemColor);
  rig.gem.material.color.set(appearance.gemColor);
  rig.gem.material.emissive.set(appearance.gemColor);
  rig.gas.material.uniforms.uGemColor.value.set(appearance.gemColor);
  rig.gas.material.uniforms.uBandColor.value.set(appearance.bandColor);
  rig.secondary.color.set(appearance.bandColor);
  rig.band.material = appearance.bandMaterial;
}
