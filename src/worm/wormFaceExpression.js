import * as THREE from 'three';

// Large, distinct shapes survive thumbnail rendering; detail is head-only.
const profile = (iris, lid, eye, tilt, smile, period) => ({ iris, lid, eye, tilt, smile, period });
export const WORM_FACE_PROFILES = {
  classic: profile('#36b99b', '#203c39', 1, 0.04, 1, 4.7),
  inch: profile('#d3a344', '#45462b', 0.80, -0.12, 0.82, 5.8),
  glow: profile('#59e6fc', '#213a59', 1.09, 0.08, 0.88, 4.1),
  book: profile('#dcab52', '#433226', 0.91, 0.16, 0.72, 5.2),
  wiggle: profile('#f58bba', '#502849', 1.04, 0.22, 1.13, 3.6),
  prism: profile('#b998ff', '#38284f', 0.84, -0.18, 0.9, 4.9),
};

// A brief eased close/open, not a long binary squash. Supplied time can freeze.
export function wormBlink(time, period = 4.7) {
  const phase = ((time % period) + period) % period;
  const distance = Math.abs(phase - period * 0.72);
  return distance >= 0.12 ? 1 : 1 - 0.92 * (0.5 + 0.5 * Math.cos(Math.PI * distance / 0.12));
}

const offset = new THREE.Vector3();
/** Call after layoutWormFace: never accumulates scale or gaze between frames. */
/**
 * `ko` (0…1) is the knocked-out look once the worm dies: eyes droop to heavy lids,
 * pupils spin in dizzy circles (on `koTime`, which keeps running while the game
 * clock is frozen) and the mouth drops to a stunned "o".
 */
export function animateWormFace(parts, character, time, { pulse = 0, transit = false, reducedMotion = false, ko = 0, koTime = 0 } = {}) {
  const profile = WORM_FACE_PROFILES[character] || WORM_FACE_PROFILES.classic;
  const t = reducedMotion ? 0 : time;
  const stun = Math.max(0, Math.min(1, ko));
  const delight = reducedMotion ? 0 : Math.max(0, Math.min(1, pulse)) * (1 - stun);
  const blink = reducedMotion || stun > 0 ? 1 : wormBlink(t, profile.period);
  const focus = (transit && !reducedMotion ? 0.88 : 1) * (1 - 0.42 * stun);
  for (let i = 0; i < 2; i++) {
    const eye = parts.eyes?.[i], pupil = parts.pupils?.[i];
    if (!eye || !pupil) continue;
    const asymmetry = character === 'wiggle' && i === 0 ? 1.12 : 1;
    eye.scale.y *= profile.eye * asymmetry * blink * focus * (1 + delight * 0.14);
    pupil.scale.y *= profile.eye * asymmetry * blink * focus;
    pupil.scale.x *= character === 'prism' ? 0.8 : 1;
    const gaze = reducedMotion ? 0 : Math.sin(t * 0.65) * 0.13;
    // Dizzy: the two pupils circle in opposite directions.
    const spin = reducedMotion ? 0.6 : koTime * 7.5 * (i ? -1 : 1);
    const dizzy = stun * 0.42;
    offset.set(
      pupil.scale.x * (gaze * (1 - stun) + Math.cos(spin) * dizzy),
      pupil.scale.x * ((0.10 + delight * 0.2) * (1 - stun) + Math.sin(spin) * dizzy),
      0
    ).applyQuaternion(pupil.quaternion);
    pupil.position.add(offset);
    const brow = eye.userData.wormBrow;
    if (brow) brow.rotation.z = (i ? -1 : 1) * (profile.tilt + delight * 0.16 - stun * 0.35);
  }
  if (parts.mouth) {
    parts.mouth.scale.x *= profile.smile * (1 + delight * 0.12) * (1 - 0.45 * stun);
    parts.mouth.scale.y *= ((transit && !reducedMotion ? 1.3 : 1) + delight * 0.65) * (1 + 0.9 * stun);
  }
}
