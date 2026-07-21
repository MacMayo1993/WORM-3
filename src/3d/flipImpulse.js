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
