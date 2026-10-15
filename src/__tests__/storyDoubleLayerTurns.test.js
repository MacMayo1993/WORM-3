import { describe, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyRotationCycle, storyRotationDescription } from '../worm/story/levels.js';

describe('authored double-layer story turns', () => {
  const stages = [[71, 3], [82, 3], [97, 2], [103, 2], [106, 2], [115, 1]];

  it('introduces the mechanic only on selected late boards larger than 7×7', () => {
    expect(WORM_STORY_LEVELS.filter(level => level.doubleLayerEvery).map(level => [level.id, level.doubleLayerEvery])).toEqual(stages);
    for (const level of WORM_STORY_LEVELS) {
      const turns = storyRotationCycle(level.cubeSize, level);
      if (level.doubleLayerEvery) {
        expect(level.cubeSize).toBeGreaterThan(7);
        expect(level.rotateEvery).toBeGreaterThan(0);
      } else expect(turns.every(turn => !turn.sliceIndices)).toBe(true);
    }
  });

  it.each(stages)('level %i repeats separated counter-turns every %i hazards', (id, every) => {
    const level = storyLevel(id), cycle = storyRotationCycle(level.cubeSize, level);
    expect(cycle).toHaveLength(6);
    expect(new Set(cycle.map(move => move.axis))).toEqual(new Set(['col', 'row', 'depth']));
    // Cross the cycle boundary as well: the authored cadence must not reset early.
    for (let index = 0; index < 18; index++) {
      const move = cycle[index % cycle.length];
      if ((index + 1) % every) { expect(move.sliceIndices).toBeUndefined(); continue; }
      expect(move.sliceIndices).toHaveLength(2);
      expect(move.sliceIndices[0]).toBe(move.sliceIndex);
      expect(move.sliceDirs).toEqual([move.dir, -move.dir]);
      expect(Math.abs(move.sliceIndices[0] - move.sliceIndices[1])).toBeGreaterThanOrEqual(2);
      for (const layer of move.sliceIndices) {
        expect(layer).toBeGreaterThanOrEqual(0);
        expect(layer).toBeLessThan(level.cubeSize);
      }
    }
    expect(storyRotationDescription(level)).toContain('two layers');
  });

  it('keeps small boards and stages without timed turns single-layer even with the option set', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      expect(storyRotationCycle(size, { rotateEvery: 10, doubleLayerEvery: 1 }).every(move => !move.sliceIndices)).toBe(true);
    }
    expect(storyRotationCycle(10, { doubleLayerEvery: 1 }).every(move => !move.sliceIndices)).toBe(true);
    expect(storyRotationDescription(storyLevel(69))).toBe('Turns every 11s');
  });
});
