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
 *
 * Menus add three more: `look` ({ x, y }, each -1…1 across the face, x toward
 * the worm's own left) aims both pupils at something instead of the idle
 * wander; `surprise` (0…1) widens the eyes, shrinks the pupils and rounds the
 * mouth; `dizzy` (0…1) circles the pupils without the knocked-out droop.
 */
export function animateWormFace(parts, character, time, { pulse = 0, transit = false, reducedMotion = false, ko = 0, koTime = 0, look = null, surprise = 0, dizzy: giddy = 0 } = {}) {
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
    const wide = Math.max(0, Math.min(1, surprise)) * (1 - stun);
    // A surprised blink is held open.
    const lid = wide > 0.2 ? 1 : blink;
    eye.scale.y *= profile.eye * asymmetry * lid * focus * (1 + delight * 0.14 + wide * 0.38);
    eye.scale.x *= 1 + wide * 0.16;
    pupil.scale.y *= profile.eye * asymmetry * lid * focus * (1 - wide * 0.3);
    pupil.scale.x *= (character === 'prism' ? 0.8 : 1) * (1 - wide * 0.3);
    // Looking at something replaces the idle wander; the pupil stays inside
    // the eye at full reach.
    const gazeX = look ? Math.max(-1, Math.min(1, look.x)) * 0.72 : reducedMotion ? 0 : Math.sin(t * 0.65) * 0.13;
    const gazeY = look ? Math.max(-1, Math.min(1, look.y)) * 0.5 : 0;
    // Dizzy: the two pupils circle in opposite directions.
    const giddyOn = reducedMotion ? 0 : Math.max(0, Math.min(1, giddy)) * (1 - stun);
    const spin = reducedMotion ? 0.6 : (stun > 0 ? koTime : t) * 7.5 * (i ? -1 : 1);
    const dizzy = stun * 0.42 + giddyOn * 0.36;
    offset.set(
      pupil.scale.x * ((gazeX * (1 - giddyOn)) * (1 - stun) + Math.cos(spin) * dizzy),
      pupil.scale.x * ((0.10 + delight * 0.2 + gazeY * (1 - giddyOn)) * (1 - stun) + Math.sin(spin) * dizzy),
      0
    ).applyQuaternion(pupil.quaternion);
    pupil.position.add(offset);
    const brow = eye.userData.wormBrow;
    if (brow) brow.rotation.z = (i ? -1 : 1) * (profile.tilt + delight * 0.16 - stun * 0.35 - wide * 0.3);
  }
  if (parts.mouth) {
    const wide = Math.max(0, Math.min(1, surprise)) * (1 - stun);
    parts.mouth.scale.x *= profile.smile * (1 + delight * 0.12) * (1 - 0.45 * stun) * (1 - 0.4 * wide);
    parts.mouth.scale.y *= ((transit && !reducedMotion ? 1.3 : 1) + delight * 0.65) * (1 + 0.9 * stun) * (1 + 1.1 * wide);
  }
}
