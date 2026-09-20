import { characterXpMultiplier } from '../characterAbilities.js';
import { addXp } from '../../progression/model.js';
import { storyLevel, storyStars, storyUnlocked, storyOutcome } from './levels.js';

export function completeStoryChanges(state, runId, metrics) {
  const level = storyLevel(state.wormStoryLevel);
  if (!state.wormHealerMode || state.demoMode || !state.wormAlive || state.wormPaused ||
      !state.wormStoryStarted || state.wormStoryResult || state.wormRunId !== runId ||
      !['active', 'finalHealing'].includes(state.wormGamePhase) || !storyUnlocked(state.playerProgress, level?.id)) return {};
  const result = storyOutcome(level, metrics);
  if (!result) return {};
  const old = storyStars(state.playerProgress, level.id);
  const improved = Math.max(0, result.stars - Math.max(1, old));
  const points = (old ? 0 : level.points || 0) + improved * 10;
  const xp = Math.round(((old ? 0 : 50) + improved * 10) * characterXpMultiplier(state.wormCharacter));
  const progress = { ...state.playerProgress, wormStory: {
    ...state.playerProgress.wormStory,
    stars: { ...state.playerProgress.wormStory?.stars, [level.id]: Math.max(old, result.stars) },
  } };
  const grant = addXp(progress, xp, 'worm');
  return {
    playerProgress: grant.progress, parityPoints: state.parityPoints + points + grant.points,
    wormStoryResult: { ...result, levelId: level.id, xp, points: points + grant.points, first: !old },
    wormPaused: true, wormGamePhase: 'solved', wormTimeAlive: result.seconds,
    xpRun: state.xpRun ? { ...state.xpRun, completed: true } : null,
  };
}

export function claimStoryChanges(state, id, choice) {
  const level = storyLevel(id), progress = state.playerProgress;
  if (!level?.reward || !storyStars(progress, id) || progress.wormStory?.claimed?.[id]) return {};
  const allOwned = level.reward.every(item => state.ownedItems.includes(item));
  if (choice === 'points' ? !allOwned : !level.reward.includes(choice) || state.ownedItems.includes(choice)) return {};
  return {
    playerProgress: { ...progress, wormStory: { ...progress.wormStory, claimed: { ...progress.wormStory.claimed, [id]: choice } } },
    ownedItems: choice === 'points' ? state.ownedItems : [...state.ownedItems, choice],
    parityPoints: state.parityPoints + (choice === 'points' ? level.fallback : 0),
  };
}
