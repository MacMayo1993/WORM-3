// Shared playable MOBI geometry: gameplay and every picker use this same rig.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createParityMobiusGeometry } from './parityGeometry.js';

export const MOBI_RADIUS = 0.12;
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();

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

export function createMobiModel({ face = true } = {}) {
  const group = new THREE.Group();
  group.name = 'MOBI';
  const light = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const cyan = light('#80e8ff');
  const violet = light('#bd92ff');
  const dark = light('#183249');
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: '#b9b0f4', emissive: '#44316e', emissiveIntensity: 0.25, roughness: 0.22, metalness: 0.08,
    clearcoat: 1, iridescence: 1, transparent: true, opacity: 0.14,
    depthWrite: false, side: THREE.FrontSide,
  });
  const shellGeometry = new RoundedBoxGeometry(2, 2, 2, 2, 0.12);
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.name = 'transparent-body';
  shell.renderOrder = 2;
  group.add(shell);
  const frame = new THREE.Mesh(createMobiFrameGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  frame.name = 'body-frame';
  group.add(frame);

  // Miniature of the collectible's crossed halos, antipodal axis and Möbius band.
  // Enlarged carried orb, still enclosed throughout its full rotation.
  const core = new THREE.Group();
  core.name = 'parity-core';
  const primary = light('#80e8ff');
  const secondary = light('#bd92ff');
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), primary);
  core.add(gem);
  const haloGeo = new THREE.TorusGeometry(0.34, 0.013, 6, 40);
  const halo = new THREE.Mesh(haloGeo, primary);
  halo.rotation.x = Math.PI / 2;
  const crossed = new THREE.Mesh(haloGeo, secondary);
  crossed.rotation.set(Math.PI / 2, Math.PI / 3, 0);
  core.add(halo, crossed);
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
  core.scale.setScalar(1.7);
  const ownedBandMaterial = band.material;
  group.add(core);

  if (!face) {
    dark.dispose(); cyan.dispose(); violet.dispose();
    group.scale.setScalar(MOBI_RADIUS);
    return { group, core, gem, band, eyes: [], primary, secondary, ownedBandMaterial, shellMaterial, lastTime: null, transitRoll: 0 };
  }

  // The guide's tiny Rubik's-cube eyes, kept above the core's sight line.
  const eyes = [];
  const eyeGeo = new RoundedBoxGeometry(0.52, 0.52, 0.52, 2, 0.055);
  const tileGeo = new THREE.PlaneGeometry(0.145, 0.145);
  const tileMaterials = ['#ecfbff', '#63d7ef', '#b4a3f5'].map(light);
  for (const sign of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sign * 0.45, 0.58, -1.02);
    eye.add(new THREE.Mesh(eyeGeo, dark));
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const front = new THREE.Mesh(tileGeo, row === 1 && col === 1 ? dark : tileMaterials[(row + col) % 3]);
      front.position.set((col - 1) * 0.164, (row - 1) * 0.164, -0.265);
      front.rotation.y = Math.PI;
      eye.add(front);
      const top = new THREE.Mesh(tileGeo, tileMaterials[col % 3]);
      top.position.set((col - 1) * 0.164, 0.265, (row - 1) * 0.164);
      top.rotation.x = -Math.PI / 2;
      eye.add(top);
    }
    eyes.push(eye);
    group.add(eye);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.035, 0.35, 8), violet);
    antenna.position.set(sign * 0.65, 1.1, 0.1);
    antenna.rotation.z = -sign * 0.22;
    group.add(antenna);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.017, 6, 24, Math.PI), cyan);
  smile.position.set(0, -0.46, -1.015);
  smile.rotation.z = Math.PI;
  smile.scale.y = 0.45;
  group.add(smile);
  group.scale.setScalar(MOBI_RADIUS);
  return { group, core, gem, band, eyes, primary, secondary, ownedBandMaterial, shellMaterial, lastTime: null, transitRoll: 0 };
}

/** Time is supplied by the caller's pause-aware clock; no independent timers. */
export function animateMobi(rig, time, { pulse = 0, transit = false } = {}) {
  const dt = rig.lastTime === null ? 0 : Math.max(0, time - rig.lastTime);
  rig.lastTime = time;
  if (transit) rig.transitRoll += Math.min(dt, 0.1) * 1.3;
  rig.core.rotation.set(Math.PI / 4 + time * 0.32, time * 0.48, Math.PI / 4 + rig.transitRoll);
  rig.band.rotation.y = -time * 0.6;
  rig.gem.scale.setScalar(1 + Math.sin(time * 3) * 0.08 + Math.max(0, Math.min(1, pulse)) * 0.35);
  const blink = Math.sin(time * 0.9) > 0.985 ? 0.18 : 1;
  rig.eyes.forEach(eye => { eye.scale.y = blink; });
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

// Solid rails stay readable on bright and patterned tiles.
export function createMobiFrameGeometry() {
  const pieces = [];
  for (let axis = 0; axis < 3; axis++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const dims = [0.085, 0.085, 0.085]; dims[axis] = 1.96;
    const edge = new THREE.BoxGeometry(...dims);
    const pos = [0, 0, 0]; pos[(axis + 1) % 3] = a * 0.94; pos[(axis + 2) % 3] = b * 0.94;
    edge.translate(...pos); pieces.push(edge);
  }
  const railCount = pieces.length;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    pieces.push(new THREE.BoxGeometry(.20, .20, .20).translate(x * .94, y * .94, z * .94));
  }
  pieces.forEach((piece, i) => {
    const color = new THREE.Color(i < railCount ? '#503080' : '#ddc4ff');
    const colors = new Float32Array(piece.attributes.position.count * 3);
    for (let j = 0; j < colors.length; j += 3) color.toArray(colors, j);
    piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach(p => p.dispose());
  return geometry;
}

export function setMobiOrbAppearance(rig, appearance) {
  rig.primary.color.set(appearance.gemColor);
  rig.secondary.color.set(appearance.bandColor);
  rig.band.material = appearance.bandMaterial;
}
