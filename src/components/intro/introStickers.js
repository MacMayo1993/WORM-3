import { makeCubies } from '../../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair, unflipStickerPair } from '../../game/manifoldLogic.js';
import { TILES, PAIRS } from './introTopology.js';
import { applyDemoOverrides } from '../../utils/demoSettings.js';
import { DEFAULT_SETTINGS } from '../../utils/colorSchemes.js';
import { FULL_FLIP_START, IMPLODE_START } from './introTiming.js';

const directions = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
const original = makeCubies(3);
const map = buildManifoldGridMap(original, 3);
let flipped = original;
for (const pair of PAIRS) flipped = flipStickerPair(flipped, 3, ...pair.position.map(v => v + 1), directions[pair.faceIndex], map);
let restored = flipped;
for (const pair of PAIRS) restored = unflipStickerPair(restored, 3, ...pair.position.map(v => v + 1), directions[pair.faceIndex], map);

export const INTRO_STICKERS = [original, flipped, restored].map(cubies => TILES.map(tile => {
  const [x, y, z] = tile.position.map(v => v + 1);
  return cubies[x][y][z].stickers[directions[tile.faceIndex]];
}));
export const INTRO_PRESENTATION = { config: {
  settings: { ...applyDemoOverrides(DEFAULT_SETTINGS), colorScheme: 'standard', biomeMode: { enabled: false } },
  biomeEnabled: false, chaosLevel: 0, disparityFlipCap: 3, faceTextures: {}, mergeMode: false,
  mergeTheme: null, wormHealerMode: true, perfReducedFX: true
} };
export const introStickerStage = (time, reducedMotion = false) => reducedMotion || time < FULL_FLIP_START ? 0 : time < IMPLODE_START ? 1 : 2;
