// Three shared meshes for any tail length: clear shell, bright edges, parity core.
// Shells never receive skin/pickup colors; those belong inside the glass.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMobiModel, disposeMobi } from './mobiModel.js';

export const MOBI_SEGMENT_RADIUS = 0.055;

export function createMobiSegmentAssets() {
  const model = createMobiModel({ face: false });
  model.group.scale.setScalar(1);
  model.core.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  model.group.updateMatrixWorld(true);
  const pieces = [];
  model.core.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.deleteAttribute('uv');
    const color = object.material.color;
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geometry);
  });
  const coreGeometry = mergeGeometries(pieces);
  pieces.forEach(g => g.dispose());
  const shellGeometry = model.group.getObjectByName('transparent-body').geometry.clone();
  const shellMaterial = model.shellMaterial.clone();
  disposeMobi(model);

  // Mesh edges can be instanced together, unlike one LineSegments per bead.
  const edges = [];
  for (let axis = 0; axis < 3; axis++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const dims = [0.026, 0.026, 0.026];
    dims[axis] = 1.92;
    const edge = new THREE.BoxGeometry(...dims);
    const pos = [0, 0, 0];
    pos[(axis + 1) % 3] = a * 0.96;
    pos[(axis + 2) % 3] = b * 0.96;
    edge.translate(...pos);
    edges.push(edge);
  }
  const frameGeometry = mergeGeometries(edges);
  edges.forEach(g => g.dispose());
  return {
    shellGeometry, shellMaterial, frameGeometry, coreGeometry,
    frameMaterial: new THREE.MeshBasicMaterial({ color: '#8cd9f4', toneMapped: false }),
    coreMaterial: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}

export function createMobiSegment(assets) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(assets.shellGeometry, assets.shellMaterial);
  shell.renderOrder = 2;
  const frame = new THREE.Mesh(assets.frameGeometry, assets.frameMaterial);
  const core = new THREE.Mesh(assets.coreGeometry, assets.coreMaterial.clone());
  group.add(shell, frame, core);
  return { group, core };
}

export function disposeMobiSegmentAssets(assets) {
  Object.values(assets).forEach(resource => resource.dispose());
}
