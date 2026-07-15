import { describe, expect, it } from 'vitest';
import { DEMO_LEVEL_CONFIGS, DEMO_STEP_IDS } from '../components/screens/DemoFlowController.jsx';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';

function applyCubeDemoConfig(config) {
  let state = makeCubies(config.cubeSize);

  if (config.scrambleSequence) {
    for (const { axis, sliceIndex, dir } of config.scrambleSequence) {
      state = rotateSliceCubies(state, config.cubeSize, axis, sliceIndex, dir);
    }
  }

  if (config.flipSequence) {
    const flipMap = buildManifoldGridMap(state, config.cubeSize);
    for (const { x, y, z, dirKey } of config.flipSequence) {
      state = flipStickerPair(state, config.cubeSize, x, y, z, dirKey, flipMap);
    }
  }

  return state;
}

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

  it('sets stage three one flip away from a solved cube', () => {
    const config = DEMO_LEVEL_CONFIGS['flip-gateway'];
    const [solveFlip] = config.flipSequence;
    const staged = applyCubeDemoConfig(config);

    expect(checkRubiksSolved(staged, config.cubeSize)).toBe(false);

    const flipMap = buildManifoldGridMap(staged, config.cubeSize);
    const solved = flipStickerPair(
      staged,
      config.cubeSize,
      solveFlip.x,
      solveFlip.y,
      solveFlip.z,
      solveFlip.dirKey,
      flipMap,
    );

    expect(checkRubiksSolved(solved, config.cubeSize)).toBe(true);
  });

  it('sets stage one to an actual one-move solve instead of a solved idle cube', () => {
    const config = DEMO_LEVEL_CONFIGS['baby-cube'];
    const [setupMove] = config.scrambleSequence;
    const staged = applyCubeDemoConfig(config);

    expect(checkRubiksSolved(staged, config.cubeSize)).toBe(false);

    const solved = rotateSliceCubies(
      staged,
      config.cubeSize,
      setupMove.axis,
      setupMove.sliceIndex,
      -setupMove.dir,
    );

    expect(checkRubiksSolved(solved, config.cubeSize)).toBe(true);
  });
});
