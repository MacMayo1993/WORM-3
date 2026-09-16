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
export function animateWormFace(parts, character, time, { pulse = 0, transit = false, reducedMotion = false } = {}) {
  const profile = WORM_FACE_PROFILES[character] || WORM_FACE_PROFILES.classic;
  const t = reducedMotion ? 0 : time;
  const delight = reducedMotion ? 0 : Math.max(0, Math.min(1, pulse));
  const blink = reducedMotion ? 1 : wormBlink(t, profile.period);
  const focus = transit && !reducedMotion ? 0.88 : 1;
  for (let i = 0; i < 2; i++) {
    const eye = parts.eyes?.[i], pupil = parts.pupils?.[i];
    if (!eye || !pupil) continue;
    const asymmetry = character === 'wiggle' && i === 0 ? 1.12 : 1;
    eye.scale.y *= profile.eye * asymmetry * blink * focus * (1 + delight * 0.14);
    pupil.scale.y *= profile.eye * asymmetry * blink * focus;
    pupil.scale.x *= character === 'prism' ? 0.8 : 1;
    const gaze = reducedMotion ? 0 : Math.sin(t * 0.65) * 0.13;
    offset.set(pupil.scale.x * gaze, pupil.scale.x * (0.10 + delight * 0.2), 0).applyQuaternion(pupil.quaternion);
    pupil.position.add(offset);
    const brow = eye.userData.wormBrow;
    if (brow) brow.rotation.z = (i ? -1 : 1) * (profile.tilt + delight * 0.16);
  }
  if (parts.mouth) {
    parts.mouth.scale.x *= profile.smile * (1 + delight * 0.12);
    parts.mouth.scale.y *= (transit && !reducedMotion ? 1.3 : 1) + delight * 0.65;
  }
}
