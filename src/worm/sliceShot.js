// sliceShot.js — where the camera stands to show a slice hazard land.
//
// The WORM'D beats (a tail cut the worm survives, and a slice death) used to
// push in on the impact point. On a phone that framed a few tiles of worm and
// none of the layer that did the cutting, so the player saw a flash but not
// what hit them. This shot pulls back far enough to hold the WHOLE cube in the
// lens, aims between the turning layer's centre and the impact, and comes in on
// a three-quarter angle off the impact face so the layer reads as a band
// across the cube with its turning edge visible.
//
// Pure maths: the camera module blends toward the result, tests project it.
import * as THREE from 'three';

const _n = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _side = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _centre = new THREE.Vector3();

// How far the aim leans from the layer's centre toward the impact point.
const AIM_TO_IMPACT = 0.35;
// Clear space around the cube's bounding sphere, in world units.
const FRAME_MARGIN = 0.45;

export const AXIS_VECTORS = {
  col: new THREE.Vector3(1, 0, 0),
  row: new THREE.Vector3(0, 1, 0),
  depth: new THREE.Vector3(0, 0, 1)
};

/**
 * @param {{cam:THREE.Vector3, look:THREE.Vector3, up:THREE.Vector3}} out
 * @param {number[]|THREE.Vector3} impact world-space hit point
 * @param {'col'|'row'|'depth'|null} axis turning axis; null for a hit with no
 *   slice (a bomb), which frames the whole cube leaning toward the impact
 * @param {number|null} layer turning layer index (0 … size-1)
 * @param {number} size cube size
 * @param {{scale?:number, fov?:number, aspect?:number}} lens cubie spacing (1 unless exploded), vertical FOV in degrees, aspect
 */
export function sliceShotInto(out, impact, axis, layer, size, { scale = 1, fov = 60, aspect = 1 } = {}) {
  const k = (size - 1) / 2;
  const impactV = Array.isArray(impact) ? _centre.fromArray(impact) : _centre.copy(impact);

  // The face the hit landed on (its dominant axis).
  const ax = Math.abs(impactV.x), ay = Math.abs(impactV.y), az = Math.abs(impactV.z);
  if (ax >= ay && ax >= az) _n.set(Math.sign(impactV.x) || 1, 0, 0);
  else if (ay >= az) _n.set(0, Math.sign(impactV.y) || 1, 0);
  else _n.set(0, 0, Math.sign(impactV.z) || 1);
  // No slice: any axis across the impact face gives the same three-quarter view
  // of the whole cube, aimed from the centre toward the hit.
  const sliced = !!AXIS_VECTORS[axis];
  if (!sliced) { axis = Math.abs(_n.x) > 0.9 ? 'row' : 'col'; layer = k; }
  _axis.copy(AXIS_VECTORS[axis]);

  // A hit on an end cap sees the layer face-on as a square, not a band, so step
  // to a face that crosses it.
  if (Math.abs(_n.dot(_axis)) > 0.9) {
    _n.set(0, 1, 0);
    if (Math.abs(_n.dot(_axis)) > 0.9) _n.set(0, 0, 1);
  }

  // Aim: the layer's centre on its axis, leaning toward the impact.
  const layerOffset = ((layer ?? k) - k) * scale;
  out.look.copy(_axis).multiplyScalar(layerOffset).lerp(impactV, AIM_TO_IMPACT);

  // Three-quarter view: mostly off the impact face, a little along the axis
  // (toward the layer's nearer end cap, so its turning edge shows) and a little
  // across, so the band does not sit dead-on.
  const alongSign = Math.sign((layer ?? k) - k) || 1;
  _side.crossVectors(_n, _axis).normalize();
  _dir.copy(_n).addScaledVector(_axis, 0.5 * alongSign).addScaledVector(_side, 0.35).normalize();

  // Distance that holds the cube's bounding sphere in the narrower half-angle,
  // plus how far the aim sits off the cube's centre.
  const half = k * scale + 0.5;
  const radius = Math.sqrt(3) * half + FRAME_MARGIN;
  const halfV = THREE.MathUtils.degToRad(fov) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const distance = radius / Math.sin(Math.min(halfV, halfH)) + out.look.length();
  out.cam.copy(out.look).addScaledVector(_dir, distance);

  // Level horizon: world up, unless the shot looks nearly straight up or down.
  out.up.set(0, 1, 0);
  if (Math.abs(_dir.y) > 0.9) out.up.copy(_axis.y ? _side : _axis);
  return out;
}
