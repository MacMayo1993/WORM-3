import * as THREE from 'three';
import { buildCraftModel, disposeCraftModel, poseHandmadeHat } from '../../worm/wormAccessories.js';
import { isHandmadeHat } from '../../worm/handmadeAccessoriesData.js';
import { FACE_LAYOUT } from '../../worm/wormFaceLayout.js';

// The equipped hat on a menu worm. Handmade hats are the accessories' craft
// models (inked, animated, already in the menu's bundle); the older felt hats
// come from wormHatParts.js, which stays a lazy chunk exactly as it is for the
// preview renderer, so wearing one never grows the opening screen's download.

let feltParts = null;
let feltLoad = null;
function loadFeltParts() {
  feltLoad ??= import('../../worm/wormHatParts.js').then(module => { feltParts = module.getHatParts; return feltParts; });
  return feltLoad;
}

const GEOMETRY = {
  cylinder: args => new THREE.CylinderGeometry(...args),
  cone: args => new THREE.ConeGeometry(...args),
  sphere: args => new THREE.SphereGeometry(...args),
  torus: args => new THREE.TorusGeometry(...args),
  box: args => new THREE.BoxGeometry(...args),
  octahedron: args => new THREE.OctahedronGeometry(...args),
};

function buildFeltHat(getHatParts, id, radius) {
  const group = new THREE.Group();
  const owned = [];
  for (const part of getHatParts(id, radius)) {
    const [name, args] = part.geo;
    const make = GEOMETRY[name];
    if (!make) continue;
    const geometry = make(args);
    const material = new THREE.MeshStandardMaterial({
      color: part.mat.color, emissive: part.mat.emissive ?? 0x000000, emissiveIntensity: part.mat.emissiveIntensity ?? 1,
      roughness: part.mat.roughness ?? 1, metalness: part.mat.metalness ?? 0,
    });
    owned.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...part.pos);
    if (part.rot) mesh.rotation.set(...part.rot);
    if (part.scale) mesh.scale.set(...part.scale);
    group.add(mesh);
  }
  return { group, dispose: () => owned.forEach(r => r.dispose()) };
}

/**
 * Hang hat `id` on `holder` (the head's group, +Y out of the surface, -Z
 * ahead) for a head of `radius`. Returns a handle whose `pose(time)` animates
 * it and `dispose()` takes it off; a felt hat appears once its chunk loads.
 */
export function wearMenuWormHat(holder, id, radius) {
  const anchor = new THREE.Group();
  anchor.name = 'menu-worm-hat';
  anchor.position.set(0, radius * FACE_LAYOUT.hatSeat, 0);
  holder.add(anchor);
  const hatRadius = radius * FACE_LAYOUT.hatScale;
  const forward = new THREE.Vector3(0, 0, -1), up = new THREE.Vector3(0, 1, 0);
  let built = null, gone = false;
  if (!id || id === 'none') return { anchor, pose() {}, dispose() { anchor.removeFromParent(); } };
  if (isHandmadeHat(id)) {
    const craft = buildCraftModel(id);
    craft.scale.setScalar(hatRadius);
    anchor.add(craft);
    built = { dispose: () => disposeCraftModel(craft) };
  } else {
    const attach = getHatParts => {
      if (gone || !getHatParts) return;
      built = buildFeltHat(getHatParts, id, hatRadius);
      anchor.add(built.group);
    };
    if (feltParts) attach(feltParts);
    else loadFeltParts().then(attach).catch(error => console.warn('[menu worm] hat failed to load', error));
  }
  return {
    anchor,
    pose(time) { if (isHandmadeHat(id)) poseHandmadeHat(anchor, id, forward, up, time); },
    dispose() {
      gone = true;
      built?.dispose();
      anchor.removeFromParent();
    },
  };
}
