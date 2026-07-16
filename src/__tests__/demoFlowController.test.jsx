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
  it('keeps the shipped demo in the intended six-stage order plus end state', () => {
    expect(DEMO_STEP_IDS).toEqual([
      'baby-cube',
      'twin-paradox',
      'flip-gateway',
      'worm-traversal',
      'chaos-forecast',
      'cosmetic-reward',
      'end',
    ]);
  });

  it('stages flip-gateway solved, one watch-flip away from unsolved and back', () => {
    const config = DEMO_LEVEL_CONFIGS['flip-gateway'];
    const solveFlip = config.watch.tile;
    const solved = makeCubies(config.cubeSize);

    expect(checkRubiksSolved(solved, config.cubeSize)).toBe(true);

    const flipMap = buildManifoldGridMap(solved, config.cubeSize);
    const brokenByWatch = flipStickerPair(
      solved,
      config.cubeSize,
      solveFlip.x,
      solveFlip.y,
      solveFlip.z,
      solveFlip.dirKey,
      flipMap,
    );
    expect(checkRubiksSolved(brokenByWatch, config.cubeSize)).toBe(false);

    // Flipping the same antipodal pair back is exactly what the player's TRY
    // interaction re-solves.
    const resolved = flipStickerPair(
      brokenByWatch,
      config.cubeSize,
      solveFlip.x,
      solveFlip.y,
      solveFlip.z,
      solveFlip.dirKey,
      flipMap,
    );
    expect(checkRubiksSolved(resolved, config.cubeSize)).toBe(true);
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
