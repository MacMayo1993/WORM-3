import { beforeEach, afterEach, it, expect } from 'vitest';
import { movingSliceCrossing } from '../worm/healerWorm/sliceCrossing.js';
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
