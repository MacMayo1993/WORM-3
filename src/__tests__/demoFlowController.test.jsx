import { describe, expect, it } from 'vitest';
import { DEMO_LEVEL_CONFIGS, DEMO_STEP_IDS } from '../components/screens/DemoFlowController.jsx';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';

// Every cube stage starts solved; the WATCH beat live-plays config.watch on top
// of that solved state before the player tries it themselves (see App.jsx
// handleDemoStepContinue). These tests replay that same beat.
describe('demo flow configuration', () => {
  it('keeps the shipped demo in the intended seven-stage order plus end state', () => {
    expect(DEMO_STEP_IDS).toEqual([
      'baby-cube',
      'twin-paradox',
      'flip-gateway',
      'worm-traversal',
      'chaos-forecast',
      'random-showcase',
      'cosmetic-reward',
      'end',
    ]);
  });

  it('flip-gateway starts solved; flipping all surface stickers breaks it, flipping back solves', () => {
    const config = DEMO_LEVEL_CONFIGS['flip-gateway'];
    const sz = config.cubeSize;
    let state = makeCubies(sz);

    expect(checkRubiksSolved(state, sz)).toBe(true);
    expect(config.flipSequence).toBeNull();

    // Simulate the user flipping every positive-face sticker (one per antipodal pair).
    const flipMap = buildManifoldGridMap(state, sz);
    const flips = [];
    for (let a = 0; a < sz; a++)
      for (let b = 0; b < sz; b++) {
        flips.push({ x: sz - 1, y: a, z: b, dirKey: 'PX' });
        flips.push({ x: a, y: sz - 1, z: b, dirKey: 'PY' });
        flips.push({ x: a, y: b, z: sz - 1, dirKey: 'PZ' });
      }

    for (const f of flips) state = flipStickerPair(state, sz, f.x, f.y, f.z, f.dirKey, flipMap);
    expect(checkRubiksSolved(state, sz)).toBe(false);

    // Flipping them all back restores solved parity.
    for (const f of flips) state = flipStickerPair(state, sz, f.x, f.y, f.z, f.dirKey, flipMap);
    expect(checkRubiksSolved(state, sz)).toBe(true);
  });

  it('stages baby-cube solved, then its watch moves break the solve', () => {
    const config = DEMO_LEVEL_CONFIGS['baby-cube'];
    let state = makeCubies(config.cubeSize);

    expect(checkRubiksSolved(state, config.cubeSize)).toBe(true);

    for (const { axis, sliceIndex, dir } of config.watch.moves) {
      state = rotateSliceCubies(state, config.cubeSize, axis, sliceIndex, dir);
    }
    expect(checkRubiksSolved(state, config.cubeSize)).toBe(false);

    for (const { axis, sliceIndex, dir } of [...config.watch.moves].reverse()) {
      state = rotateSliceCubies(state, config.cubeSize, axis, sliceIndex, -dir);
    }
    expect(checkRubiksSolved(state, config.cubeSize)).toBe(true);
  });
});
