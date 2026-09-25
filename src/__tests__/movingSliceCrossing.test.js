import { beforeEach, afterEach, it, expect } from 'vitest';
import { movingSliceCrossing, armTurnWatch, stepTurnWatch } from '../worm/healerWorm/sliceCrossing.js';
import { setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';
let sim;
beforeEach(() => {
  resetLiveRotation();
  sim = { prevTile:{x:0,y:1,z:4}, pos:{x:1,y:1,z:4}, interpT:0.51 };
  setLiveRotation('col',[1],[0.6],1,0.6);
});
afterEach(resetLiveRotation);
it('hits at the boundary in both directions and on a secondary turning layer', () => {
  expect(movingSliceCrossing(sim,0.49,0)).toMatchObject({axis:'col',sliceIndex:1});
  [sim.prevTile,sim.pos]=[sim.pos,sim.prevTile];
  expect(movingSliceCrossing(sim,0.49,0)).toMatchObject({sliceIndex:1});
  setLiveRotation('col',[3,1],[-0.7,0.6],3,-0.7);
  expect(movingSliceCrossing(sim,0.49,0)).toMatchObject({sliceIndex:1});
});
it('does not kill before contact, after an already completed crossing, or on aligned faces', () => {
  sim.interpT=0.49; expect(movingSliceCrossing(sim,0.4,0)).toBeNull();
  sim.interpT=0.7; expect(movingSliceCrossing(sim,0.6,0)).toBeNull();
  for(const angle of [0,Math.PI/2]) {
    setLiveRotation('col',[1],[angle],1,angle);
    expect(movingSliceCrossing(sim,0.49,0)).toBeNull();
  }
});
it('allows sufficiently high jumps, rockets, landing grace and co-rotating layers', () => {
  sim.isJumping=true; expect(movingSliceCrossing(sim,0.49,0.7)).toBeNull();
  expect(movingSliceCrossing(sim,0.49,0.1)).not.toBeNull();
  sim.rocketActive=true; expect(movingSliceCrossing(sim,0.49,0)).toBeNull();
  sim.rocketActive=false; sim.landingGraceT=0.1; expect(movingSliceCrossing(sim,0.49,0)).toBeNull();
  sim.landingGraceT=0; setLiveRotation('col',[0,1],[0.6,0.6],1,0.6);
  expect(movingSliceCrossing(sim,0.49,0)).toBeNull();
});

// A head mid-step when the hazard fires crosses in the turn's first frames,
// where the live check lets aligned faces pass. The watch hands that crossing
// back to the fire-time rules instead of leaving the body across a moving seam.
const ref = current => ({ current });
const wormAt = (fromX, toX, t) => ({
  prevTile: ref({ x: fromX, y: 1, z: 4 }), pos: ref({ x: toX, y: 1, z: 4 }), interpT: ref(t),
  isJumping: ref(false), jumpLift: () => 0, rocketActive: ref(false), landingGraceT: ref(0)
});
it('reports a head entering or leaving the turning layer before and early in the turn', () => {
  const worm = wormAt(0, 1, 0.4);
  const watch = armTurnWatch(worm, 'col', [1], 7);
  expect(watch.headOn).toBe(false);
  expect(stepTurnWatch(watch, worm, 7)).toBeNull();
  worm.interpT.current = 0.55; // crossed before the animation started
  expect(stepTurnWatch(watch, worm, 7)).toBe('crossed');
  expect(watch.headOn).toBe(true);
  expect(stepTurnWatch(watch, worm, 7)).toBeNull(); // once per crossing
  setLiveRotation('col', [1], [0.03], 1, 0.03);
  worm.prevTile.current = { x: 1, y: 1, z: 4 }; worm.pos.current = { x: 2, y: 1, z: 4 }; worm.interpT.current = 0.6;
  expect(stepTurnWatch(watch, worm, 7)).toBe('crossed'); // leaving, at an aligned angle
  resetLiveRotation();
  expect(stepTurnWatch(watch, worm, 7)).toBe('done');
});
it('leaves late crossings to the live check and end alignment, and honours jump, rocket and landing grace', () => {
  const worm = wormAt(0, 1, 0.4);
  let watch = armTurnWatch(worm, 'col', [1], 7);
  setLiveRotation('col', [1], [1.2], 1, 1.2);
  worm.interpT.current = 0.55;
  expect(stepTurnWatch(watch, worm, 7)).toBeNull();
  for (const guard of [w => { w.isJumping.current = true; w.jumpLift = () => 0.7; }, w => { w.rocketActive.current = true; }, w => { w.landingGraceT.current = 0.1; }]) {
    const w = wormAt(0, 1, 0.4); guard(w);
    watch = armTurnWatch(w, 'col', [1], 7);
    setLiveRotation('col', [1], [0.02], 1, 0.02);
    w.interpT.current = 0.55;
    expect(stepTurnWatch(watch, w, 7)).toBeNull();
    expect(watch.headOn).toBe(true); // tracked, so landing later is not a second crossing
  }
});

it('ends at the commit even when no frame of the tween was observed', () => {
  const worm = wormAt(0, 1, 0.4);
  const watch = armTurnWatch(worm, 'col', [1], 7);
  // Committed (epoch bumped) without the watch ever seeing liveRotation.active:
  // a later idle crossing of the old layer must not read as a hit.
  worm.interpT.current = 0.55;
  expect(stepTurnWatch(watch, worm, 8)).toBe('done');
});
