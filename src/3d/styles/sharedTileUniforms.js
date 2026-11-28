// src/3d/styles/sharedTileUniforms.js
// The uniforms every tile style reads (time, spin, gaze, the light rig…), apart
// from TileStyleMaterials.jsx so code on the first load (the opening's flip
// portal) can bind them without pulling in every style's shader source.
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';

// Shared time uniform updated by useFrame in parent
export const sharedUniforms = {
  time: { value: 0 },
  reducedMotion: { value: prefersReducedMotion() ? 1 : 0 },
  // "Spin energy" in [0,1]: spikes while a layer is rotating and decays after,
  // so styles like orbChamber can jostle their contents in reaction to the turn.
  spin: { value: 0 },
  // Which slice is turning, so only the moving tiles react:
  //   spinAxis  → 0 = X (col), 1 = Y (row), 2 = Z (depth)
  //   spinSlice → that axis's world coordinate of the rotating slice
  // A tile jostles only when its own world center lines up with spinSlice on
  // spinAxis. Rotation about an axis leaves that axis's coordinate invariant,
  // so this stays correct throughout the turn.
  spinAxis: { value: 0 },
  spinSlice: { value: 0 },
  // Monotonically increasing accumulator driven by spin energy so the dice
  // style settles to a new random orientation after every layer rotation.
  diceRoll: { value: 0 },
  // Where eye-like styles look: xyz a world point, w = 1 while there is one (the
  // worm's head in WORM runs). With w = 0 they look at the camera.
  gazeTarget: { value: new THREE.Vector4(0, 0, 0, 0) },
  // Per-cell dice roll state. `cellRoll` is a data texture (R channel) holding
  // how many times each grid cell has been rotated through; the dice style folds
  // it into its face hash so a returning cell never repeats while non-rotated
  // cells hold. `cellGridN` = cube size, `cellK` = (size-1)/2. Managed by
  // CubeAssembly; a 1×1 zero placeholder keeps materials valid before mount.
  cellRoll: { value: _makePlaceholderCellTex() },
  cellGridN: { value: 1 },
  cellK: { value: 0 },
  // The studio rig's light directions in world space (unit, toward each light).
  // GameScene turns them with the camera every frame so a styled tile is lit by
  // the same rig as a plain one; zero (no play scene) keeps the authored rig.
  rigKey: { value: new THREE.Vector3() },
  rigFill: { value: new THREE.Vector3() },
  rigRim: { value: new THREE.Vector3() },
};

function _makePlaceholderCellTex() {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
