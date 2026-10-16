import { Vector3, MathUtils } from 'three';
import { sliceShotInto } from './sliceShot.js';
import { CUT_FOCUS_DURATION, CUT_FOCUS_IN, CUT_FOCUS_OUT } from './healerWorm/constants.js';

// Capture both ends once so the turning layer and shorter tail cannot drag the
// camera during the one-second hold. Aim at the cut itself, not the cube centre.
export function makeTailCutShot(camera, look, impact, slice, size, scale) {
  const distance = Math.max(0.1, camera.position.distanceTo(look));
  const start = {
    cam: camera.position.clone(),
    look: camera.getWorldDirection(new Vector3()).multiplyScalar(distance).add(camera.position),
    up: camera.up.clone(),
  };
  const target = sliceShotInto({ cam: new Vector3(), look: new Vector3(), up: new Vector3() },
    impact, slice?.axis ?? null, slice?.layer ?? null, size, {
      scale, fov: camera.fov, aspect: camera.aspect, chaseDistance: distance, focusImpact: true,
    });
  return { start, target };
}

export function sampleTailCutShot(shot, remaining, cam, look, up) {
  const elapsed = CUT_FOCUS_DURATION - remaining;
  const blend = Math.min(MathUtils.smoothstep(elapsed, 0, CUT_FOCUS_IN),
    MathUtils.smoothstep(remaining, 0, CUT_FOCUS_OUT));
  cam.lerpVectors(shot.start.cam, shot.target.cam, blend);
  look.lerpVectors(shot.start.look, shot.target.look, blend);
  up.lerpVectors(shot.start.up, shot.target.up, blend);
  if (up.lengthSq() < 1e-6) up.copy(shot.target.up);
  up.normalize();
}
