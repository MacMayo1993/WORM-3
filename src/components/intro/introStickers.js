import { makeCubies } from '../../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair, unflipStickerPair } from '../../game/manifoldLogic.js';
import { TILES, PAIRS } from './introTopology.js';

const directions = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
const original = makeCubies(3);
const map = buildManifoldGridMap(original, 3);
let flipped = original;
for (const pair of PAIRS) flipped = flipStickerPair(flipped, 3, ...pair.position.map(v => v + 1), directions[pair.faceIndex], map);
let restored = flipped;
for (const pair of PAIRS) restored = unflipStickerPair(restored, 3, ...pair.position.map(v => v + 1), directions[pair.faceIndex], map);

// The gameplay flip is the source of truth for every colour the opening shows:
// [before, flipped, restored] for each of the 54 stickers, in TILES order.
export const INTRO_STICKERS = [original, flipped, restored].map(cubies => TILES.map(tile => {
  const [x, y, z] = tile.position.map(v => v + 1);
  return cubies[x][y][z].stickers[directions[tile.faceIndex]];
}));
