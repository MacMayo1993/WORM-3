import { it, expect } from 'vitest';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { storyLevel, storyOutcome } from '../worm/story/levels.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

function crossing() {
  resetLiveRotation();
  const sim = makeWormSim(5), level = storyLevel(3), practice = stageStory(sim, 5, level);
  // Model a body grown through pickups; levels now start with an empty tail.
  sim.tailLength = 140;
  practice.rotationEpoch = 0;
  sim.pos = { ...practice.target };
  sim._curWP.fromArray(getStickerWorldPos(2, 2, 4, 'PZ', 5, 0));
  sim.prevWorldPos = null; sim.interpT = 0.6; sim.isJumping = true; sim.jumpT = 0.5;
  const read = () => storyMetrics(sim, practice, level, { wormSessionOrbs: 12, rotationEpoch: 0, animState: null }, [], 0.02);
  return { sim, practice, level, read };
}
it('counts four separate landed body clearances, not airborne frames or double-jump resets', () => {
  const { sim, level, read } = crossing();
  for (let jumps = 0; jumps < 4; jumps++) {
    sim.isJumping = true; sim.jumpT = 0.5;
    for (let frame = 0; frame < 50; frame++) expect(read().bodyJumps).toBe(jumps);
    sim.jumpT = 0.25; expect(read().bodyJumps).toBe(jumps); // same airborne episode
    sim.isJumping = false;
    const metrics = read(); expect(metrics.bodyJumps).toBe(jumps + 1);
    if (jumps < 3) expect(storyOutcome(level, metrics)).toBeNull();
    else expect(storyOutcome(level, metrics)).toMatchObject({ stars: 3 });
    expect(read().bodyJumps).toBe(jumps + 1); // extra grounded frames do not recount
  }
});
it.each(['low', 'empty', 'severed', 'fatal'])('rejects %s jumps as successful body clearances', kind => {
  const { sim, read } = crossing();
  if (kind === 'low') sim.jumpT = 0.001;
  if (kind === 'empty') sim.pos = { x: 2, y: 1, z: 4, dirKey: 'PZ' };
  if (kind === 'severed') sim.tailLength = 2;
  read(); sim.isJumping = false;
  if (kind === 'fatal') sim.alive = false;
  expect(read().bodyJumps).toBe(0);
});
it('preserves the no-cut star only across uncut runs and resets attempt metrics', () => {
  const { sim, read } = crossing();
  sim.cutFocusT = 0.5; expect(read().cuts).toBe(1); expect(read().cuts).toBe(1);
  sim.cutFocusT = 0; read(); sim.cutFocusT = 0.5; expect(read().cuts).toBe(2);
  const retry = stageStory(sim, 5, storyLevel(3));
  expect(retry).toMatchObject({ bodyJumps: 0, cuts: 0, elapsed: 0, pendingTunnel: null });
  expect(retry.colors.size).toBe(0); expect(retry.tunnels.size).toBe(0);
});
