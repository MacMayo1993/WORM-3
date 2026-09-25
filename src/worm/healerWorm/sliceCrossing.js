import { liveRotation, liveLayerAngleAt } from '../liveRotation.js';

// Resolve once at the visible tile boundary, including entering and leaving a
// moving slab. Equal-angle adjacent layers move together and have no shear seam.
export function movingSliceCrossing(sim, before, lift) {
  if (!liveRotation.active || !sim.prevTile || before >= 0.5 || sim.interpT < 0.5 ||
      sim.rocketActive || sim.landingGraceT > 0 || (sim.isJumping && lift > 0.45)) return null;
  const axis = liveRotation.axis;
  const coord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
  const from = sim.prevTile[coord], to = sim.pos[coord];
  if (from === to) return null;
  const a = liveLayerAngleAt(from) ?? 0, b = liveLayerAngleAt(to) ?? 0;
  if (Math.abs(a - b) < 0.08) return null;
  // Aligned faces at the beginning/end of the quarter-turn are traversable.
  if (Math.max(Math.abs(Math.sin(2 * a)), Math.abs(Math.sin(2 * b))) < 0.12) return null;
  return { axis, sliceIndex: liveLayerAngleAt(to) != null ? to : from };
}

// ── Early-turn watch ─────────────────────────────────────────────────────────
// The hazard decides cuts and deaths once, at the instant it fires, from where
// the body lies. The live check above then kills a head that crosses a seam
// mid-turn — but it deliberately lets the head cross while the faces are still
// aligned, and it cannot see the frame or two between the turn firing and the
// animation starting. A head mid-step at fire time crosses in exactly that
// window, leaving the body straddling a moving seam: neither cut nor killed,
// just dragged. The watch closes that gap. Armed at fire time with the side the
// head was on, it reports when the head changes sides early in the turn, so the
// caller can re-run the fire-time rules against the body as it now lies:
// entering the turning layer with the body outside is a death, leaving it is a
// tail cut. Late in the turn the live check and end alignment own crossings.

/** Occupied head tile on the turning axis: the tile it came from until it is halfway across. */
function headCoord(worm, axis) {
  const coord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
  const tile = ((worm.interpT?.current ?? 1) < 0.5 && worm.prevTile?.current) || worm.pos.current;
  return tile[coord];
}

export function armTurnWatch(worm, axis, layers) {
  return { axis, layers: layers.slice(), headOn: layers.includes(headCoord(worm, axis)), started: false };
}

const LATE_TURN = Math.PI / 4;

/**
 * Advance the watch one frame.
 * @returns {'crossed'|'done'|null} 'crossed' when the head changed sides early in
 *   the turn and the body must be re-resolved; 'done' once the turn has finished.
 */
export function stepTurnWatch(watch, worm) {
  if (!watch) return null;
  if (liveRotation.active) watch.started = true;
  else if (watch.started) return 'done';
  const onLayer = watch.layers.includes(headCoord(worm, watch.axis));
  if (onLayer === watch.headOn) return null;
  watch.headOn = onLayer;
  // The same exemptions as the live check: a rocket is untouchable, and a head
  // high in a jump (or still landing) clears the seam.
  const lift = worm.isJumping?.current ? (worm.jumpLift?.() ?? 0) : 0;
  if (worm.rocketActive?.current || (worm.landingGraceT?.current ?? 0) > 0 || lift > 0.45) return null;
  if (watch.started) {
    let angle = 0;
    for (const a of liveRotation.angles) angle = Math.max(angle, Math.abs(a));
    if (angle >= LATE_TURN) return null;
  }
  return 'crossed';
}
