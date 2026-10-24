import { MOBI_FIRSTS } from '../../worm/mobiFirsts.js';
import { checkRubiksWin } from '../../game/winDetection.js';
import { persistedState } from './persistedState.js';
import { createXpRun, difficultyMultiplier, puzzleFingerprint, puzzleMode, count } from '../../progression/model.js';
import { xpChanges, wormXpChanges, puzzleXpChanges, achievementChanges } from '../../progression/awards.js';
import { availableRewards, rewardChoices } from '../../progression/rewards.js';
import { getLevelPar } from '../../levels/scoring.js';
import { getWinnerFaces } from '../../utils/disparityBetting.js';
import { recordFreeBests } from '../../progression/wormBests.js';

export const createProgressionSlice = (set, get) => ({
  playerProgress: persistedState.playerProgress,
  xpRun: null,
  xpNotice: null,
  xpActivityRuns: {},
  beginAchievementActivity: mode => set(state => ['teach', 'explore', 'demo'].includes(mode)
    ? { xpActivityRuns: { ...state.xpActivityRuns, [mode]: createXpRun(mode, (state.xpActivityRuns?.[mode]?.id || 0) + 1, state.playerProgress.xp) }, xpNotice: state.xpNotice?.mode === mode ? null : state.xpNotice } : {}),
  showPlayerProgress: false,
  setShowPlayerProgress: value => set({ showPlayerProgress: value }),
  beginPuzzleXp: (scrambleMoves = 15) => set(state => {
    if (state.demoMode || state.showMainMenu || state.wormHealerMode || (state.chaosLevel > 0 && !state.currentLevel) || state.teachModeActive || checkRubiksWin(state.cubies, state.size)) return {};
    const mode = puzzleMode(state), level = state.currentLevelData;
    const moves = level ? (getLevelPar(level) || scrambleMoves) : scrambleMoves;
    return { xpRun: createXpRun(mode, state.gameStartTime, state.playerProgress.xp, {
      puzzle: true, levelId: state.currentLevel, size: state.size,
      eligible: moves >= (level ? 1 : 8), scrambleMoves: moves,
      challenge: level?.dailyKey ? `daily:${level.dailyKey}` : `${level ? `level:${state.currentLevel}` : mode}:${puzzleFingerprint(state.cubies, state.size)}`,
      multiplier: difficultyMultiplier(level?.difficulty), dailyKey: level?.dailyKey, par: getLevelPar(level),
    }) };
  }),
  markXpAssisted: () => set(state => state.xpRun?.puzzle && !state.xpRun.completed
    ? { xpRun: { ...state.xpRun, assisted: true } } : {}),
  completePuzzleXp: () => set(state => puzzleXpChanges(state)),
  recordWormXp: (kind, total, pair, runId) => set(state => wormXpChanges(state, kind, total, pair, runId)),
  // The first time a player makes an elemental recipe (by its id, e.g. 'steam'):
  // a milestone that persists, and a one-shot notice the HUD turns into NEW RECIPE.
  discoverWormFusion: id => set(state => {
    if (state.demoMode || typeof id !== 'string' || !/^[a-z]{2,24}$/.test(id)) return {};
    const mark = `first:fusion:${id}`;
    if (state.playerProgress.milestones[mark]) return {};
    return { playerProgress: { ...state.playerProgress, milestones: { ...state.playerProgress.milestones, [mark]: 1 } },
      wormFusionDiscovery: { id, seq: (state.wormFusionDiscovery?.seq ?? 0) + 1 } };
  }),
  // Mobi's line the first time a player meets one of WORM's moving parts
  // (worm/mobiFirsts.js), once per save; shown by the HUD's MobiLineNotice.
  sayMobiFirst: id => set(state => {
    const text = MOBI_FIRSTS[id];
    if (state.demoMode || !text) return {};
    const mark = `first:mobi:${id}`;
    if (state.playerProgress.milestones[mark]) return {};
    return { playerProgress: { ...state.playerProgress, milestones: { ...state.playerProgress.milestones, [mark]: 1 } },
      wormMobiLine: { id, text, seq: (state.wormMobiLine?.seq ?? 0) + 1 } };
  }),
  // A free-play run's personal bests (progression/wormBests.js), once per run, at
  // its end (death or a healed cube). wormRunBests tells the result cards which
  // numbers beat an earlier record.
  recordWormRunBests: runId => set(state => {
    if (state.demoMode || !state.wormHealerMode || state.wormStoryLevel || state.wormCombatMode ||
        runId !== state.wormRunId || state.wormRunBests?.runId === runId) return {};
    const { bests, beaten, previous } = recordFreeBests(state.playerProgress.bests, state.size, {
      orbs: state.wormSessionOrbs, heals: state.wormHealedCount, chain: state.wormRunBestCombo, time: state.wormTimeAlive,
    });
    return { playerProgress: { ...state.playerProgress, bests }, wormRunBests: { runId, beaten, previous } };
  }),
  finishWormXp: (won, runId) => set(state => {
    const run = state.xpRun;
    if (state.demoMode || !state.wormHealerMode || !run || run.mode !== 'worm' || run.id !== runId || runId !== state.wormRunId || run.completed) return {};
    const next = { ...run, completed: true };
    if (!won || !state.wormAlive || !['active', 'finalHealing'].includes(state.wormGamePhase)) return { xpRun: next };
    const paid = { ...state, ...xpChanges(state, Math.round(100 * run.multiplier), 'worm', 'Cube healed', next) };
    return achievementChanges(paid, state.size === 15 ? ['worm-restored', 'worm-mega'] : ['worm-restored'], { factor: run.multiplier });
  }),
  beginChaosXp: () => set(state => {
    if (state.demoMode || state.showMainMenu || state.currentLevel || state.wormHealerMode || state.chaosLevel <= 0) return {};
    if (state.xpRun?.mode === 'chaos' && state.xpRun.id === state.disparityRoundId && !state.xpRun.completed) return {};
    return { xpRun: createXpRun('chaos', state.disparityRoundId, state.playerProgress.xp) };
  }),
  finishChaosXp: () => set(state => {
    const run = state.xpRun;
    if (state.demoMode || state.currentLevel || !run || run.mode !== 'chaos' || run.completed || run.id !== state.disparityRoundId || !state.disparityWinner) return {};
    // Independent of wager, luck, odds, board size and total elimination count.
    const colors = [...new Set([...(state.playerProgress.chaosColors || []), ...getWinnerFaces(state.disparityWinner.pair)])].filter(n => Number.isInteger(n) && n >= 1 && n <= 6);
    const progress = { ...state.playerProgress, chaosColors: colors };
    const paid = { ...state, ...xpChanges(state, 50, 'chaos', 'Round completed', { ...run, completed: true }, progress) };
    return achievementChanges(paid, colors.length === 6 ? ['chaos-round', 'chaos-colors'] : ['chaos-round'], { discoveriesOnly: true });
  }),
  recordLessonXp: (kind, key) => set(state => {
    if (state.demoMode || !state.teachModeActive || !['teach', 'quiz'].includes(kind) || !/^[\w-]+:\d+$/.test(key)) return {};
    const id = `${kind}:${key}`;
    const previous = state.xpActivityRuns?.teach || createXpRun('teach', 1, state.playerProgress.xp);
    if (previous.seen.includes(id)) return {};
    const baseXp = state.playerProgress.milestones[id] ? 0 : kind === 'quiz' ? 35 : 25;
    const progress = { ...state.playerProgress, milestones: { ...state.playerProgress.milestones, [id]: 1 } };
    const algorithms = [...new Set([...(previous.featStats.algorithms || []), ...(kind === 'teach' ? [key] : [])])];
    const run = { ...previous, seen: [...previous.seen, id], featStats: { ...previous.featStats, algorithms } };
    const paid = { ...state, ...xpChanges(state, baseXp, 'teach', kind === 'quiz' ? 'Quiz solved' : 'Algorithm learned', run, progress) };
    const ids = [kind === 'quiz' ? 'teach-quiz' : 'teach-algorithm', ...(algorithms.length >= 3 ? ['teach-session'] : [])];
    const { xpRun, ...patch } = achievementChanges(paid, ids, { discoveriesOnly: true });
    return { ...patch, xpActivityRuns: { ...state.xpActivityRuns, teach: xpRun } };
  }),
  recordDiscoveryXp: key => set(state => {
    const onboarding = key === 'introduction';
    if (!['cubelet', 'introduction'].includes(key) || (onboarding ? !state.demoMode || !['worm-traversal', 'cosmetic-reward'].includes(state.demoStep) : state.demoMode)) return {};
    const id = `${onboarding ? 'demo' : 'explore'}:${key}`;
    const progress = { ...state.playerProgress, milestones: { ...state.playerProgress.milestones, [id]: 1 } };
    const mode = onboarding ? 'demo' : 'explore';
    const run = state.xpActivityRuns?.[mode] || createXpRun(mode, 1, state.playerProgress.xp);
    if (run.completed) return {};
    const baseXp = state.playerProgress.milestones[id] ? 0 : onboarding ? 50 : 30;
    const paid = { ...state, ...xpChanges(state, baseXp, mode, onboarding ? 'Introduction complete' : 'Three pairs explored', { ...run, completed: true }, progress) };
    const { xpRun, ...patch } = achievementChanges(paid, [onboarding ? 'demo-intro' : 'explore-pairs'], { discoveriesOnly: true });
    return { ...patch, xpActivityRuns: { ...state.xpActivityRuns, [mode]: xpRun } };
  }),
  claimLevelReward: (level, choiceId) => {
    const state = get();
    if (!availableRewards(state.playerProgress).includes(level)) return false;
    const choice = rewardChoices(level, state.ownedItems).find(c => c.id === choiceId);
    if (!choice) return false;
    set({
      playerProgress: { ...state.playerProgress, claimedRewards: { ...state.playerProgress.claimedRewards, [level]: choiceId } },
      ownedItems: [...new Set([...state.ownedItems, ...choice.items])],
      parityPoints: (state.parityPoints || 0) + count(choice.points),
    });
    return true;
  },
});
