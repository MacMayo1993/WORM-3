import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCubies } from '../../src/game/cubeState.js';
import { rotateSliceCubies } from '../../src/game/cubeRotation.js';
import { DIR_TO_VEC, RUBIKS_FACE_COLORS } from '../../src/utils/constants.js';

// Every puzzle starts solved. No sticker is painted independently of its cubie.
// Chaos shows a physically possible partial turn of one intact outer layer.
export const ART_RECIPES = {
  worm: { moves: [], worm: true },
  cube: { moves: [['col', 2, 1], ['row', 2, -1], ['depth', 2, 1]] },
  teach: { moves: [], arrow: true },
  chaos: { moves: [['col', 2, 1], ['row', 2, 1], ['depth', 2, -1]], turn: { axis: 'row', slice: 2, angle: Math.PI / 6 } },
  random: { moves: [['row', 2, 1], ['col', 2, -1], ['depth', 2, 1], ['row', 0, -1], ['col', 0, 1], ['depth', 2, 1]], shuffle: true },
  store: { gift: true },
};
export function artworkCubeState(id) {
  const recipe = ART_RECIPES[id];
  if (!recipe || recipe.gift) return null;
  return recipe.moves.reduce((cube, [axis, slice, dir]) => rotateSliceCubies(cube, 3, axis, slice, dir), makeCubies(3));
}
const material = (color, roughness = 0.24) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.02, envMapIntensity: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.2 });
function addMesh(parent, geometry, mat, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function ball(parent, radius, mat, position, scale) {
  const mesh = addMesh(parent, new THREE.SphereGeometry(radius, 32, 24), mat, position);
  if (scale) mesh.scale.set(...scale);
  return mesh;
}
function curve(parent, points, radius, mat) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return addMesh(parent, new THREE.TubeGeometry(path, 48, radius, 12, false), mat);
}

export function buildPuzzle(id) {
  const cubies = artworkCubeState(id);
  if (!cubies) return null;
  const puzzle = new THREE.Group(); puzzle.name = 'legal-puzzle';
  const chassis = material('#202c3c', 0.32);
  const body = new RoundedBoxGeometry(0.98, 0.98, 0.98, 4, 0.095);
  const tile = new RoundedBoxGeometry(0.84, 0.84, 0.035, 4, 0.07);
  const colors = Object.fromEntries(Object.entries(RUBIKS_FACE_COLORS).map(([id, color]) => [id, material(color)]));
  const z = new THREE.Vector3(0, 0, 1);
  const turn = ART_RECIPES[id].turn;
  const rotating = new THREE.Group(); rotating.name = 'turning-layer'; puzzle.add(rotating);
  for (const slab of cubies) for (const row of slab) for (const cubie of row) {
    if (!Object.keys(cubie.stickers).length) continue;
    const group = new THREE.Group(); group.name = 'cubie'; group.userData.cell = [cubie.x, cubie.y, cubie.z];
    group.position.set(cubie.x - 1, cubie.y - 1, cubie.z - 1);
    const coordinate = turn?.axis === 'row' ? cubie.y : turn?.axis === 'col' ? cubie.x : cubie.z;
    (turn && coordinate === turn.slice ? rotating : puzzle).add(group);
    addMesh(group, body, chassis);
    for (const [face, sticker] of Object.entries(cubie.stickers)) {
      const normal = new THREE.Vector3(...DIR_TO_VEC[face]);
      const mesh = addMesh(group, tile, colors[sticker.curr], normal.clone().multiplyScalar(0.496).toArray());
      mesh.name = 'sticker'; mesh.userData = { face, color: sticker.curr };
      mesh.quaternion.setFromUnitVectors(z, normal);
    }
  }
  if (turn) rotating.rotation[turn.axis === 'row' ? 'y' : turn.axis === 'col' ? 'x' : 'z'] = turn.angle;
  return puzzle;
}

function addWorm(parent) {
  const lime = material('#8fd62f'), pale = material('#c8ec4e'), white = material('#fff9db'), dark = material('#182a31');
  // A single tail-to-head chain resting across the top face; eyes only on the head.
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    ball(parent, 0.13 + t * 0.22, i % 2 ? pale : lime,
      [1.05 - 2.12 * t, 1.61 + Math.sin(t * Math.PI) * 0.60, -0.58 + t * 1.26], [1.05, 1, 1]);
  }
  const head = new THREE.Group(); head.position.set(-1.18, 1.84, 0.85); head.rotation.y = -0.18; parent.add(head);
  ball(head, 0.47, lime, [0, 0, 0], [1, 0.98, 0.95]);
  for (const x of [-0.19, 0.19]) {
    ball(head, 0.165, white, [x, 0.13, 0.34], [1, 1.12, 0.75]);
    ball(head, 0.085, dark, [x + 0.02, 0.125, 0.455], [1, 1.08, 0.48]);
    ball(head, 0.023, white, [x + 0.001, 0.165, 0.49]);
  }
  curve(head, [[-0.13, -0.15, 0.393], [0, -0.21, 0.419], [0.14, -0.15, 0.393]], 0.023, dark);
}
function addTurnArrow(parent, color, y = 1.9, reverse = false) {
  const mat = material(color), points = [];
  for (let i = 0; i <= 30; i++) {
    const angle = -0.35 + i / 30 * Math.PI * 0.96;
    points.push([Math.cos(angle) * 1.86, y, Math.sin(angle) * 1.86]);
  }
  if (reverse) points.reverse();
  curve(parent, points, 0.085, mat);
  const end = new THREE.Vector3(...points.at(-1));
  const direction = end.clone().sub(new THREE.Vector3(...points.at(-2))).normalize();
  const tip = addMesh(parent, new THREE.ConeGeometry(0.24, 0.48, 24), mat, end.addScaledVector(direction, 0.18).toArray());
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}
function addGift(parent) {
  const teal = material('#34b9ab'), navy = material('#173d50'), gold = material('#ffcf42');
  addMesh(parent, new RoundedBoxGeometry(2.7, 2.35, 2.7, 5, 0.18), teal, [0, -0.14, 0]);
  addMesh(parent, new RoundedBoxGeometry(2.92, 0.45, 2.92, 5, 0.12), navy, [0, 1.21, 0]);
  addMesh(parent, new RoundedBoxGeometry(0.46, 2.82, 2.74, 3, 0.025), gold, [0, 0.07, 0]);
  addMesh(parent, new RoundedBoxGeometry(2.74, 2.82, 0.46, 3, 0.025), gold, [0, 0.07, 0]);
  for (const sign of [-1, 1]) curve(parent, [[0, 1.52, 0], [sign * 0.76, 2.02, 0.05], [sign * 0.88, 1.58, 0.22], [0, 1.52, 0]], 0.115, gold);
  ball(parent, 0.22, gold, [0, 1.6, 0]);
}
export function buildArtwork(id) {
  const recipe = ART_RECIPES[id];
  if (!recipe) throw new Error(`Unknown mode artwork: ${id}`);
  const root = new THREE.Group();
  if (recipe.gift) addGift(root);
  else root.add(buildPuzzle(id));
  if (recipe.worm) addWorm(root);
  if (recipe.arrow) addTurnArrow(root, '#ffd443');
  if (recipe.shuffle) {
    addTurnArrow(root, '#a384f9', 1.9);
    addTurnArrow(root, '#6ce2d7', -1.85, true);
  }
  return root;
}
