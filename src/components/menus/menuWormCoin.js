import * as THREE from 'three';
import { CRAFT } from '../../worm/handmadeParts.js';

// The Store worm's coin: a fat gold Parity Point carried on the worm's
// shoulders like a shell, leaned back toward the tail, its diamond turning.
// It follows the handmade pieces' rules for things a worm wears: big (wider
// than 1.6 bead radii), bold (two golds and a dark rim), lit (an emissive floor
// so it never goes dull) and inked (a back-face hull in the craft ink).

// Sizes in bead radii, so the coin scales with whichever worm wears it.
export const COIN_RADIUS = 0.95;
export const COIN_THICKNESS = 0.26;
export const COIN_SEGMENT = 3; // the shoulders, clear of the head and its hat
const INK = 0.075;
const SPIN = 1.2; // radians a second
// How far the coin leans back toward the tail from lying flat on the back.
export const COIN_LEAN = 0.55;

const FACE_GOLD = '#ffc83d';
const RIM_GOLD = '#d99a1e';
const EMBLEM = '#fff1a8';

/**
 * Build a coin for a bead of `radius`, hung on `holder` (a segment's group:
 * +Y up off the surface). Returns { group, pose(time), dispose() }.
 */
export function wearMenuWormCoin(holder, radius) {
  const group = new THREE.Group();
  group.name = 'menu-worm-coin';
  // Leaned back toward the tail like a shell on the worm's back, so its face
  // shows from above (the carousel looks straight at the face the worm is on)
  // as well as from the side. Standing upright it read as a thin edge.
  const mount = new THREE.Group();
  mount.rotation.x = COIN_LEAN;
  group.add(mount);
  const spin = new THREE.Group();
  mount.add(spin);
  const owned = [];
  const own = r => { owned.push(r); return r; };

  // The disc's faces look up and down its own axis (local Y).
  const disc = own(new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 32));
  const rim = own(new THREE.TorusGeometry(COIN_RADIUS * 0.84, COIN_THICKNESS * 0.26, 8, 32));
  rim.rotateX(Math.PI / 2);
  // A raised diamond, the wallet's Parity Point mark, on each face.
  const emblem = own(new THREE.OctahedronGeometry(COIN_RADIUS * 0.44, 0));
  emblem.scale(0.72, 0.22, 1);
  const hull = own(new THREE.CylinderGeometry(COIN_RADIUS + INK, COIN_RADIUS + INK, COIN_THICKNESS + INK * 2, 32));

  const face = own(new THREE.MeshStandardMaterial({ color: FACE_GOLD, metalness: 0.55, roughness: 0.28, emissive: FACE_GOLD, emissiveIntensity: 0.28 }));
  const edge = own(new THREE.MeshStandardMaterial({ color: RIM_GOLD, metalness: 0.6, roughness: 0.32, emissive: RIM_GOLD, emissiveIntensity: 0.22 }));
  const mark = own(new THREE.MeshStandardMaterial({ color: EMBLEM, metalness: 0.3, roughness: 0.2, emissive: EMBLEM, emissiveIntensity: 0.4 }));
  const ink = own(new THREE.MeshBasicMaterial({ color: CRAFT.ink, side: THREE.BackSide }));

  spin.add(new THREE.Mesh(disc, face));
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(rim, edge);
    ring.position.y = side * COIN_THICKNESS * 0.5;
    const diamond = new THREE.Mesh(emblem, mark);
    diamond.position.y = side * COIN_THICKNESS * 0.5;
    spin.add(ring, diamond);
  }
  const outline = new THREE.Mesh(hull, ink);
  outline.name = 'menu-worm-coin-ink';
  spin.add(outline);

  group.scale.setScalar(radius);
  // Its low edge sunk a little into the bead, like a pack strapped on, not
  // balanced on top.
  group.position.y = radius * (0.78 + Math.sin(COIN_LEAN) * COIN_RADIUS + COIN_THICKNESS * 0.5);
  holder.add(group);

  return {
    group,
    /** Turn and rock on the worm's own clock (a frozen clock holds it still). */
    pose(time, reducedMotion = false) {
      // The coin turns in its own plane (the diamond goes round) and rocks a
      // little as the worm crawls; reduced motion holds it at rest.
      spin.rotation.y = reducedMotion ? 0 : time * SPIN;
      mount.rotation.x = COIN_LEAN + (reducedMotion ? 0 : Math.sin(time * 3.1) * 0.12);
      mount.rotation.z = reducedMotion ? 0 : Math.sin(time * 2.3 + 1) * 0.1;
    },
    dispose() {
      group.removeFromParent();
      owned.forEach(resource => resource.dispose());
    },
  };
}
