import { makeWormSim } from '../healerWorm/wormSim.js';
import { sampleGapBodyInto } from '../traversal/gapTraversal.js';

// The same renderer-facing refs as useWormCrawler, with no gameplay/reward writes.
export function makeGapLabWorm(traversal) {
  const sim = makeWormSim(3);
  sim.phase = 'crawling'; sim.tailLength = traversal.segments;
  sim.pos = { x: 1, y: 2, z: 1, dirKey: 'PY' }; sim.moveDir = 'right';
  sim.orbPickupColors = Array(Math.floor((traversal.segments - 4) / 3)).fill('#85bee8');
  sim.orbPickupFaceIds = sim.orbPickupColors.map(() => 1);
  const aliases = { orbPickupColorsRef: 'orbPickupColors', orbPickupFaceIdsRef: 'orbPickupFaceIds', colorEpochRef: 'colorEpoch' };
  const worm = Object.fromEntries([...Object.keys(sim), ...Object.keys(aliases)].map(key => [key, {
    get current() { return sim[aliases[key] || key]; }, set current(value) { sim[aliases[key] || key] = value; },
  }]));
  worm.traversalPose = { current: { sample: (distance, position, normal, forward) => sampleGapBodyInto(traversal, distance, position, normal, forward) } };
  return worm;
}
