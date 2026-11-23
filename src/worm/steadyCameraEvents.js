import { MathUtils, Matrix4, Vector3 } from 'three';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { makeElementalRevealOrbit, sampleElementalRevealOrbit } from './elementalRevealOrbit.js';
import { makeTailCutShot, sampleTailCutShot } from './tailCutCamera.js';
import { HEAL_PAUSE_DURATION, FACE_NORMALS } from './healerWorm/constants.js';
import { getWormStickerWorldPos, wormExpansion } from './wormExpansion.js';

const WORLD_UP = new Vector3(0, 1, 0);
const EAST = new Vector3(1, 0, 0);

export function makeSteadyCameraEvents() {
  return {
    kind: null, shot: null, run: null, duration: 0,
    eye: new Vector3(), target: new Vector3(), up: new Vector3(), basis: new Matrix4(),
    healEye: new Vector3(), healTarget: new Vector3(), healSide: new Vector3(),
  };
}

// True only while a deliberate gameplay beat owns the view. Reuse the authored
// chase shots without handing normal steering or tunnel motion to chase.
export function stepSteadyCameraEvents(events, camera, worm, size, state, target, reducedMotion) {
  const runChanged = events.run !== state.wormRunId;
  events.run = state.wormRunId;
  const { wormGamePhase: phase } = state;
  const eligible = !runChanged && !reducedMotion && state.wormAlive !== false &&
    (phase === 'active' || phase === 'finalHealing') && worm.phase.current === 'crawling' &&
    !(state.wormStoryLevel && !state.wormStoryStarted && !state.wormStoryResult);
  if (!eligible) {
    events.kind = events.shot = null;
    return false;
  }
  const heal = worm.healPauseT?.current ?? 0;
  const cut = worm.cutFocusT?.current ?? 0;
  const reveal = worm.elementalFocusT?.current ?? 0;
  const tile = worm.healFocusTile?.current;
  const impact = worm.cutFocusPos?.current;
  // Match the simulation's clock order. A portal heal without a focus tile
  // doesn't get a shot or interrupt the steady tunnel view.
  const kind = heal > 0 && tile ? 'heal' : cut > 0 && impact ? 'cut' : reveal > 0 ? 'element' : null;
  if (!kind) {
    events.kind = events.shot = null;
    return false;
  }
  if (events.kind !== kind) {
    if (state.wormPaused) return false;
    events.kind = kind;
    if (kind === 'element') {
      events.shot = makeElementalRevealOrbit(camera, target, { size, expansion: wormExpansion.amount });
      events.duration = reveal;
    } else if (kind === 'cut') {
      events.shot = makeTailCutShot(camera, target, impact, worm.cutFocusSlice?.current, size,
        cubeExpansionScale(size, worm.expansionAmount?.current ?? 0));
    } else {
      events.shot = { eye: camera.position.clone(), target: target.clone(), up: camera.up.clone() };
      events.healTarget.fromArray(getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size));
    }
  }

  if (kind === 'element') {
    sampleElementalRevealOrbit(events.shot, 1 - reveal / events.duration, events.eye, events.target, events.up);
  } else if (kind === 'cut') {
    sampleTailCutShot(events.shot, cut, events.eye, events.target, events.up);
  } else {
    // The ring's tile pop gets a brief, level three-quarter look, not a spin.
    const elapsed = HEAL_PAUSE_DURATION - heal;
    const weight = Math.min(MathUtils.smoothstep(elapsed, 0, .22), MathUtils.smoothstep(heal, 0, .28));
    const normal = FACE_NORMALS[tile.dirKey] ?? FACE_NORMALS.PZ;
    events.healSide.crossVectors(normal, Math.abs(normal.y) > .9 ? EAST : WORLD_UP).normalize();
    events.healEye.copy(events.healTarget).addScaledVector(normal, 2 + size * .16)
      .addScaledVector(events.healSide, .8 + elapsed * .34);
    events.eye.lerpVectors(events.shot.eye, events.healEye, weight);
    events.target.lerpVectors(events.shot.target, events.healTarget, weight);
    events.up.copy(events.shot.up);
  }

  camera.position.copy(events.eye);
  camera.quaternion.setFromRotationMatrix(events.basis.lookAt(events.eye, events.target, events.up));
  camera.up.copy(WORLD_UP).applyQuaternion(camera.quaternion);
  return true;
}
