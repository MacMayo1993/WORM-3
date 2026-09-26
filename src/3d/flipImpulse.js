// src/3d/flipImpulse.js
// Shared one-shot "flip impulse" — a world-space micro-kick fired by a flipping
// StickerPlane and consumed by CameraFlipKick (which pans the camera) so the view
// recoils along the flipped tile's normal while the tile itself punches the other
// way. Module-level (not React state) so firing it never triggers a re-render.
import * as THREE from 'three';

export const flipImpulse = {
  dir: new THREE.Vector3(0, 0, 1), // world-space kick direction (tile outward normal)
  t: 0, // remaining time, seconds (0 = idle)
  dur: 0.28, // kick duration
  strength: 0 // peak camera offset in world units
};

// Fire a kick along `dir` (a THREE.Vector3, need not be normalized).
export function fireFlipImpulse(dir, strength = 0.08) {
  flipImpulse.dir.copy(dir).normalize();
  flipImpulse.t = flipImpulse.dur;
  flipImpulse.strength = strength;
}

// A short rumble for heavy hits — chaos lightning landing on a tile. The recoil
// above pushes the view along one normal; this jitters it on all three axes and
// decays, so a strike lands as a jolt through the whole frame. A weaker hit never
// cuts short a stronger one that is still ringing.
export const cameraShake = { t: 0, dur: 0.2, amp: 0, phase: 0 };

export function fireCameraShake(amp, dur = 0.2) {
  const live = cameraShake.t > 0 ? cameraShake.amp * (cameraShake.t / cameraShake.dur) ** 2 : 0;
  if (!(amp > live)) return;
  cameraShake.amp = amp;
  cameraShake.dur = dur;
  cameraShake.t = dur;
}

/** Advance the rumble by `dt` seconds and write this frame's offset into `out`. */
export function stepCameraShake(out, dt) {
  if (cameraShake.t <= 0) return out.set(0, 0, 0);
  cameraShake.t = Math.max(0, cameraShake.t - dt);
  cameraShake.phase += dt;
  const k = cameraShake.t / cameraShake.dur;
  const env = cameraShake.amp * k * k;
  const p = cameraShake.phase;
  return out.set(Math.sin(p * 83) * env, Math.sin(p * 97 + 1.7) * env, Math.sin(p * 71 + 3.1) * env * 0.6);
}
