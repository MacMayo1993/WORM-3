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
