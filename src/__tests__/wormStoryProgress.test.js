import { beforeEach, it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, readPlayerSave, sanitizeProgress } from '../progression/model.js';
import { storyLevel, storyOutcome, storyUnlocked } from '../worm/story/levels.js';
import { getStoreItem } from '../utils/storeCatalog.js';
const state = () => useGameStore.getState();
const won = { alive: true, elapsed: 10, cuts: 0, orbs: 18, colors: 6 };
function start(id = 1) {
  state().initWormMode(undefined, undefined, 3.5, 1, 30, null, true, true, id);
  useGameStore.setState({ wormStoryReady: true, wormGamePhase: 'active' });
  state().startWormStory();
}
beforeEach(() => {
  state().clearDisparityGame();
  useGameStore.setState({ playerProgress: newProgress(), parityPoints: 0, ownedItems: [], demoMode: false });
});
it('locks future levels, fixes story rules, and restores ordinary Free Play runs', () => {
  const id = state().wormRunId;
  start(2); expect(state().wormRunId).toBe(id);
  start(); expect(state()).toMatchObject({ wormSpeed: 1.5, wormEnemiesEnabled: false, wormCombatMode: false, xpRun: null, wormMission: null });
  state().setWormSpeed(3); expect(state().wormSpeed).toBe(storyLevel(1).speed);
  state().clearDisparityGame(); state().initWormMode(); state().setWormSpeed(2);
  expect(state()).toMatchObject({ wormStoryLevel: null, wormStoryReady: false, wormStoryResult: null, wormSpeed: 2 });
  expect(state().xpRun).not.toBeNull(); expect(state().wormMission).not.toBeNull();
});
it.each([{ wormPaused: true }, { wormAlive: false }, { wormStoryStarted: false }, { wormGamePhase: 'countdown' }, { demoMode: true }])('rejects completion while %j', patch => {
  start(); useGameStore.setState(patch); state().completeWormStory(state().wormRunId, won);
  expect(state().wormStoryResult).toBeNull(); expect(state().playerProgress.xp).toBe(0);
});
it('pays first clears and newly improved stars once, persists them, and rejects stale runs', () => {
  start(); state().completeWormStory(state().wormRunId - 1, won);
  expect(state().wormStoryResult).toBeNull();
  state().completeWormStory(state().wormRunId, { ...won, elapsed: storyLevel(1).par + 15, cuts: 1 });
  expect(state().wormStoryResult).toMatchObject({ stars: 1, points: 25, xp: 50 });
  expect(storyUnlocked(state().playerProgress, 2)).toBe(true);
  expect(storyUnlocked(state().playerProgress, 3)).toBe(false);
  start(); state().completeWormStory(state().wormRunId, won);
  expect(state().wormStoryResult).toMatchObject({ stars: 3, points: 20, xp: 20 });
  const wallet = state().parityPoints, xp = state().playerProgress.xp;
  start(); state().completeWormStory(state().wormRunId, won); state().completeWormStory(state().wormRunId, won);
  expect(state().parityPoints).toBe(wallet); expect(state().playerProgress.xp).toBe(xp);
  expect(readPlayerSave()).toMatchObject({ progress: state().playerProgress, points: wallet });
});
it.each([3, 5, 6, 7, 8, 9, 10])('claims an existing cosmetic from level %i exactly once, including after leaving the run', id => {
  const level = storyLevel(id); for (const item of level.reward) expect(getStoreItem(item)).toBeTruthy();
  state().claimWormStoryReward(id, level.reward[0]); expect(state().ownedItems).toEqual([]);
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({length:id}, (_, i) => [i+1, 1])), claimed: {} } } });
  state().claimWormStoryReward(id, 'points'); expect(state().parityPoints).toBe(0);
  state().claimWormStoryReward(id, level.reward[0]); state().claimWormStoryReward(id, level.reward[1]);
  expect(state().ownedItems).toEqual([level.reward[0]]);
  expect(readPlayerSave()).toMatchObject({ ownedItems: [level.reward[0]], progress: { wormStory: { claimed: { [id]: level.reward[0] } } } });
});
it('provides the alternate reward only when both choices are owned', () => {
  const level = storyLevel(3);
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: { 1: 1, 2: 1, 3: 1 }, claimed: {} } }, ownedItems: level.reward });
  state().claimWormStoryReward(3, 'points'); state().claimWormStoryReward(3, 'points');
  expect(state().parityPoints).toBe(100); expect(state().ownedItems).toEqual(level.reward);
});
it('sanitizes old, malformed, and gapped saves without unlocking reward claims', () => {
  expect(sanitizeProgress({}).wormStory).toEqual({ stars: {}, claimed: {} });
  expect(sanitizeProgress({ wormStory: { stars: { 1: 3, 2: 4, 3: 1 }, claimed: { 3: 'hat_party' } } }).wormStory).toEqual({ stars: { 1: 3 }, claimed: {} });
});
it('requires every physical objective and rejects expiration or old tutorial clears', () => {
  const complete = { ...won, orbs: 30, colors: 6, uniqueTunnels: 4, bodyJumps: 4, landed: true,
    rotations: 6, rotationSettled: true, healed: 6, remaining: 0, tailClear: true };
  for (let id = 1; id <= 6; id++) {
    expect(storyOutcome(storyLevel(id), complete)).toMatchObject({ stars: 3 });
    expect(storyOutcome(storyLevel(id), { ...complete, elapsed: storyLevel(id).limit + 0.01 })).toBeNull();
    expect(storyOutcome(storyLevel(id), { ...won, orbs: 4, tunnels: 1, crossedBody: true, landed: true, rotations: 1, healed: 3, remaining: 0, tailClear: true, rotationSettled: true })).toBeNull();
  }
  expect(storyOutcome(storyLevel(2), { ...complete, tailClear: false })).toBeNull();
  expect(storyOutcome(storyLevel(3), { ...complete, landed: false })).toBeNull();
  expect(storyOutcome(storyLevel(4), { ...complete, rotationSettled: false })).toBeNull();
  expect(storyOutcome(storyLevel(5), { ...complete, colors: 5 })).toBeNull();
  expect(storyOutcome(storyLevel(6), { ...complete, remaining: 1 })).toBeNull();
  expect(storyOutcome(storyLevel(6), { ...complete, orbs: 29 })).toBeNull();
  expect(storyOutcome(storyLevel(6), { ...complete, rotations: 5 })).toBeNull();
});

it('Book receives its XP bonus on first Story clears', () => {
  useGameStore.setState({ wormCharacter: 'book' }); start();
  state().completeWormStory(state().wormRunId, { ...won, elapsed: storyLevel(1).par + 15, cuts: 1 });
  expect(state().wormStoryResult.xp).toBe(63);
  useGameStore.setState({ wormCharacter: 'classic' });
});
