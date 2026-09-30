// Shared meshes for any tail length: clear shell, pearly bezel, parity core and gas.
// Shells never receive skin/pickup colors; those belong inside the glass.
import * as THREE from 'three';
import { createMobiCoreMaterial, addMobiInstanceAttributes } from './mobiEnergyMaterials.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMobiModel, disposeMobi, createMobiFrameGeometry, createMobiFrameMaterial } from './mobiModel.js';

export const MOBI_SEGMENT_RADIUS = 0.11;

// A handful of blocks (menus, previews) get the smooth bezel; the gameplay tail,
// instanced up to MAX_TAIL, takes the pillow-shaded one.
export function createMobiSegmentAssets(capacity = 1, { smooth = capacity <= 8 } = {}) {
  const model = createMobiModel({ face: false });
  model.group.scale.setScalar(1);
  model.core.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  model.group.updateMatrixWorld(true);
  const pieces = [];
  model.core.traverse(object => {
    if (!object.isMesh || object === model.band) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.deleteAttribute('uv');
    const role = object === model.gem || object.name === 'positive-pole' ? 0 : object.name === 'orb-plasma' ? 1
      : object.material === model.secondary ? 3 : 2;
    geometry.setAttribute('mobiRole', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(role), 1));
    const color = new THREE.Color(1, 1, 1);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geometry);
  });
  const coreGeometry = mergeGeometries(pieces);
  pieces.forEach(g => g.dispose());
  const shellGeometry = model.group.getObjectByName('transparent-body').geometry.clone();
  const shellMaterial = model.shellMaterial.clone();
  const bandGeometry = model.band.geometry.clone();
  bandGeometry.applyMatrix4(model.band.matrixWorld);
  const gasGeometry = new THREE.SphereGeometry(0.88, 16, 12);
  const gasMaterial = model.gas.material.clone();
  gasMaterial.color = gasMaterial.uniforms.uGemColor.value;
  addMobiInstanceAttributes(gasGeometry, capacity);
  addMobiInstanceAttributes(coreGeometry, capacity);
  disposeMobi(model);

  const frameGeometry = createMobiFrameGeometry({ smooth });
  return {
    shellGeometry, shellMaterial, frameGeometry, coreGeometry, bandGeometry, gasGeometry, gasMaterial,
    bandMaterial: new THREE.MeshBasicMaterial({ color: '#bd92ff', toneMapped: false }),
    frameMaterial: createMobiFrameMaterial(),
    coreMaterial: createMobiCoreMaterial(),
  };
}

export function createMobiSegment(assets) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(assets.shellGeometry, assets.shellMaterial);
  shell.renderOrder = 2;
  const frame = new THREE.Mesh(assets.frameGeometry, assets.frameMaterial);
  const core = new THREE.Mesh(assets.coreGeometry, assets.coreMaterial.clone());
  core.material.color = core.material.uniforms.uGemColor.value;
  const gas = new THREE.Mesh(assets.gasGeometry, assets.gasMaterial);
  gas.renderOrder = 1;
  const band = new THREE.Mesh(assets.bandGeometry, assets.bandMaterial);
  core.add(band);
  group.add(shell, frame, core, gas);
  return { group, core, band, gas };
}

export function disposeMobiSegmentAssets(assets) {
  Object.values(assets).forEach(resource => resource.dispose());
}

// One block per ORB_SEGMENT_GROWTH simulation segments, so the glass never
// stacks: every third starter segment, then one per collected orb. Blocks sit
// a full block-width apart, clear of the head.
export function isMobiBlockSegment(index, baseLength, growth) {
  if (index <= 0) return false;
  return index < baseLength ? index % growth === 0 : (index - baseLength) % growth === growth - 1;
}

/**
 * The tail's follow-the-leader tumble. `travel` is distance crawled (world
 * units), so each block takes the pose the one ahead of it had on the same
 * spot, and the wave holds still when MOBI does; `time` only adds a slow idle
 * sway. Roll/pitch/yaw are radians about the block's own axes; `lift` is in
 * block radii along the surface normal (never down, so clearance holds).
 */
export function mobiTailSwayInto(out, block, travel, time, reduced = false) {
  if (reduced) { out.roll = 0; out.pitch = 0; out.yaw = 0; out.lift = 0; return out; }
  const phase = travel * 3.4 - block * 0.95 + time * 0.9;
  out.roll = Math.sin(phase) * 0.22;
  out.pitch = Math.sin(phase * 0.5 + block * 1.7) * 0.07;
  out.yaw = Math.sin(phase + 1.3) * 0.09;
  out.lift = (0.5 + 0.5 * Math.sin(phase - 0.7)) * 0.16;
  return out;
}
