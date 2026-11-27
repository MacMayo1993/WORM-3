import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid } from './manifoldLogic.js';
import { getManifoldGridId, faceRCFor } from './gridIds.js';

export const ROLL_MS = 10000;
export const LESSON_MS = 1500;
export const COOLDOWN_MS = 3000;

export const flipPuzzle = state => state.currentLevelData?.scoring === 'flips';
// Flip Cube free play itself: the flag is set by the Flip Cube wizard, and every
// other mode reached without the main menu (Random, Teach, Chaos, WORM, a level)
// reads as not free play, so its relapse toggle and numbers never leak there.
export const flipFreeplayActive = state => !!state.flipFreeplay && !state.currentLevelData && !state.demoMode && !state.wormHealerMode &&
  !state.teachModeActive && !state.randomMode && !state.chaosLevel;
export const relapseEnabled = state => !state.demoMode && !state.wormHealerMode && !state.teachModeActive && !state.randomMode && !state.chaosLevel &&
  (state.currentLevelData ? !!state.currentLevelData.relapse : !!(flipFreeplayActive(state) && state.settings?.flipRelapse));
export const flipSession = state => !state.demoMode && !state.wormHealerMode && !state.teachModeActive && (flipPuzzle(state) || relapseEnabled(state));
export const showingRelapseLesson = state => state.hasShuffled && state.currentLevelData?.relapseLesson && !state.flipRun.lessonSeen;
// Layer turns a flip level refuses right now: during the relapse lesson, the
// first-flip highlight, before the opening turns finish and on the win screen.
// The drag, its release and every move port read this one rule, so a drag can
// never commit a turn the board refuses.
export const flipTurnsLocked = state => !!(showingRelapseLesson(state) ||
  (flipPuzzle(state) && (state.firstFlipHighlightPair || !state.hasShuffled || state.victory)));

export function newFlipRun(seed = 1) {
  return { seed, elapsed: 0, nextRoll: ROLL_MS, flips: 0, count: 0, lessonSeen: false, cooldowns: {}, event: null,
    // The cube's own turns (levels with `cubeTurns`): when the next one lands, the
    // layer it has picked once its warning starts, and how many it has made. Their
    // randomness has its own stream, so adding them leaves the relapse rolls alone.
    turnSeed: (seed ^ 0x9e3779b9) >>> 0, nextCubeTurn: null, cubeTurn: null, cubeTurns: 0 };
}

const AXES = ['col', 'row', 'depth'];
const nextRandom = run => { run.turnSeed = (Math.imul(run.turnSeed, 1664525) + 1013904223) >>> 0; return run.turnSeed / 4294967296; };

/**
 * The cube turning a layer on its own, on a level that asks for it
 * (`level.cubeTurns`: { every, warn } in seconds). Writes into `run` (a copy):
 * schedules the first turn, picks the layer when its warning starts (so the
 * glow can show it) and, when the turn is due, returns it for the driver to
 * play. Any outer or middle layer, either way; seeded per run.
 */
export function stepCubeTurns(run, level, size) {
  const spec = level?.cubeTurns;
  if (!spec) return null;
  const every = spec.every * 1000, warn = spec.warn * 1000;
  if (run.nextCubeTurn == null) run.nextCubeTurn = run.elapsed + every;
  if (!run.cubeTurn && run.elapsed >= run.nextCubeTurn - warn) {
    run.cubeTurn = {
      axis: AXES[Math.floor(nextRandom(run) * AXES.length)],
      sliceIndex: Math.floor(nextRandom(run) * size),
      dir: nextRandom(run) < 0.5 ? 1 : -1,
      at: run.nextCubeTurn,
    };
  }
  if (run.cubeTurn && run.elapsed >= run.cubeTurn.at) {
    const turn = run.cubeTurn;
    run.cubeTurn = null;
    run.nextCubeTurn = run.elapsed + every;
    run.cubeTurns += 1;
    return { axis: turn.axis, sliceIndex: turn.sliceIndex, dir: turn.dir };
  }
  return null;
}

// Undo in a flip session restores the board and the player's score, never the
// run's clock: rewinding `elapsed`/`nextRoll`/`seed` let turn-then-undo hold a
// roll off for ever. A relapse clears the undo history (advanceFlipRun), so no
// checkpoint ever spans one and the relapse count never needs rewinding.
export function flipCheckpoint(state) {
  if (!flipSession(state)) return {};
  return { beforeFlipInput: { cubies: state.cubies, moves: state.moves, flips: state.flipRun.flips, focus: state.flipRun.focus ?? null } };
}

/** The store patch an Undo applies from a checkpoint: board and score back, clock kept. */
export function restoreFlipCheckpoint(state, checkpoint) {
  return {
    cubies: checkpoint.cubies,
    moves: checkpoint.moves,
    flipRun: { ...state.flipRun, flips: checkpoint.flips, focus: checkpoint.focus }
  };
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
  const cubeTurn = state.hasShuffled && !state.victory ? stepCubeTurns(run, state.currentLevelData, state.size) : null;
  if (cubeTurn) return { flipRun: run, cubeTurn };
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
  // A relapse is not undoable and clears the undo history: rewinding a player
  // move past it would put back a board from before the relapse.
  return { flipRun: run, cubies: board, moveHistory: [] };
}
