import { checkRubiksWin } from '../../game/winDetection.js';
import { persistedState } from './persistedState.js';
import { createXpRun, difficultyMultiplier, puzzleFingerprint, puzzleMode, count } from '../../progression/model.js';
import { xpChanges, wormXpChanges, puzzleXpChanges, achievementChanges } from '../../progression/awards.js';
import { availableRewards, rewardChoices } from '../../progression/rewards.js';
import { getLevelPar } from '../../levels/scoring.js';

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
    const colors = [...new Set([...(state.playerProgress.chaosColors || []), ...(state.disparityWinner.pair || [])])].filter(n => Number.isInteger(n) && n >= 1 && n <= 6);
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
