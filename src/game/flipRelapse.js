import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid } from './manifoldLogic.js';
import { getManifoldGridId, faceRCFor } from './gridIds.js';

export const ROLL_MS = 10000;
export const LESSON_MS = 1500;
export const COOLDOWN_MS = 3000;

export const flipPuzzle = state => state.currentLevelData?.scoring === 'flips';
export const relapseEnabled = state => !state.demoMode && !state.wormHealerMode && !state.teachModeActive && !state.randomMode && !state.chaosLevel &&
  (state.currentLevelData ? !!state.currentLevelData.relapse : !!(state.flipFreeplay && state.settings?.flipRelapse));
export const flipSession = state => !state.demoMode && !state.wormHealerMode && !state.teachModeActive && (flipPuzzle(state) || relapseEnabled(state));
export const showingRelapseLesson = state => state.hasShuffled && state.currentLevelData?.relapseLesson && !state.flipRun.lessonSeen;

export function newFlipRun(seed = 1) {
  return { seed, elapsed: 0, nextRoll: ROLL_MS, flips: 0, count: 0, lessonSeen: false, cooldowns: {}, event: null };
}

export function flipCheckpoint(state) {
  if (!flipSession(state) && !state.flipFreeplay) return {};
  return { beforeFlipInput: { cubies: state.cubies, moves: state.moves, flipRun: state.flipRun } };
}

export function notePlayerFlip(run, sticker, twin, size) {
  const until = run.elapsed + COOLDOWN_MS;
  const cooldowns = { ...run.cooldowns, [getManifoldGridId(sticker, size)]: until };
  if (twin) cooldowns[getManifoldGridId(twin, size)] = until;
  const focus = twin && { id: getManifoldGridId(sticker, size), twinId: getManifoldGridId(twin, size), at: run.elapsed };
  return { ...run, flips: run.flips + 1, cooldowns, focus };
}

export function canRelapse(sticker, cap) {
  return sticker.flips > 0 && sticker.curr === sticker.orig && sticker.flips < cap &&
    !(cap % 2 && sticker.flips + 1 >= cap);
}

// Cache by immutable board. Id order holds across slice rotations and undo.
const candidateCache = new WeakMap();
export function scarredPairs(cubies, size, cap) {
  const cached = candidateCache.get(cubies);
  if (cached?.cap === cap) return cached.pairs;
  const map = buildManifoldGridMap(cubies, size);
  const pairs = [];
  for (const [id, loc] of map) {
    const sticker = loc.sticker;
    if (!canRelapse(sticker, cap)) continue;
    const twin = findAntipodalStickerByGrid(map, sticker, size);
    if (!twin || !canRelapse(twin.sticker, cap)) continue;
    const twinId = getManifoldGridId(twin.sticker, size);
    if (id < twinId) pairs.push({ id, twinId, loc, twin });
  }
  pairs.sort((a, b) => a.id.localeCompare(b.id));
  candidateCache.set(cubies, { cap, pairs });
  return pairs;
}

const faceNames = { PZ: 'Front', NZ: 'Back', PY: 'Top', NY: 'Bottom', PX: 'Right', NX: 'Left' };
function positionName(loc, size) {
  const { r, c } = faceRCFor(loc.dirKey, loc.x, loc.y, loc.z, size);
  return faceNames[loc.dirKey] + ' ' + (r + 1) + '·' + (c + 1);
}

export function advanceFlipRun(state, delta, cap) {
  const elapsed = state.flipRun.elapsed + delta;
  const run = { ...state.flipRun, elapsed };
  if (!relapseEnabled(state)) return { flipRun: run };
  const lesson = showingRelapseLesson(state);
  if (elapsed < (lesson ? LESSON_MS : run.nextRoll)) return { flipRun: run };
  run.nextRoll = elapsed + ROLL_MS;
  run.lessonSeen ||= lesson;
  let board = state.cubies;
  const hits = [];
  const map = buildManifoldGridMap(board, state.size);
  for (const { id, twinId, loc, twin } of scarredPairs(board, state.size, cap)) {
    if (run.cooldowns[id] > elapsed || run.cooldowns[twinId] > elapsed) continue;
    run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
    if (!lesson && run.seed / 4294967296 >= Math.min(1, loc.sticker.flips * 0.05)) continue;
    board = flipStickerPair(board, state.size, loc.x, loc.y, loc.z, loc.dirKey, map, cap);
    run.cooldowns = { ...run.cooldowns, [id]: elapsed + COOLDOWN_MS, [twinId]: elapsed + COOLDOWN_MS };
    hits.push({ id, twinId, from: positionName(loc, state.size), to: positionName(twin, state.size) });
  }
  if (!hits.length) return { flipRun: run };
  run.count += hits.length;
  run.event = { at: elapsed, hits };
  run.focus = { ...hits[0], at: elapsed };
  return { flipRun: run, cubies: board };
}
