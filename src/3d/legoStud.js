import * as THREE from 'three';

// Lego stud: a single molded stud centered on each face. The face group's +Y axis is
// rotated to the outward normal, then the stud is built up the local +Y axis.
export const LEGO_FACE_TRANSFORMS = {
  PZ: { pos: [0, 0, 0.49], rot: [Math.PI / 2, 0, 0] },
  NZ: { pos: [0, 0, -0.49], rot: [-Math.PI / 2, 0, 0] },
  PX: { pos: [0.49, 0, 0], rot: [0, 0, -Math.PI / 2] },
  NX: { pos: [-0.49, 0, 0], rot: [0, 0, Math.PI / 2] },
  PY: { pos: [0, 0.49, 0], rot: [0, 0, 0] },
  NY: { pos: [0, -0.49, 0], rot: [Math.PI, 0, 0] }
};
// The stud's three parts, each laid out in the face group's frame: a slightly tapered
// body, an embossed ring on its top and a small raised centre pip. One geometry and
// one white material per part for the whole game, tinted per stud by the batch's
// instance colour. Built per stud, a LEGO look on a 15×15 was ~4,000 meshes,
// materials and geometries made on every swap, freed on its restore (which released
// their programs, so the next swap linked them again) and drawn one by one.
export const LEGO_STUD_PARTS = [
  { name: 'body', geometry: new THREE.CylinderGeometry(0.2, 0.21, 0.14, 26).translate(0, 0.07, 0),
    finish: { roughness: 0.35, metalness: 0, envMapIntensity: 0.6 } },
  { name: 'ring', geometry: new THREE.TorusGeometry(0.14, 0.022, 10, 28).rotateX(Math.PI / 2).translate(0, 0.142, 0),
    finish: { roughness: 0.28, metalness: 0, envMapIntensity: 0.75 } },
  { name: 'pip', geometry: new THREE.CylinderGeometry(0.055, 0.055, 0.05, 18).translate(0, 0.155, 0),
    finish: { roughness: 0.3, metalness: 0, envMapIntensity: 0.7 } }
].map(part => ({ ...part, material: new THREE.MeshStandardMaterial({ color: '#ffffff', ...part.finish }) }));
