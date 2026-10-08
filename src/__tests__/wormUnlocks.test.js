import { describe, it, expect, beforeEach } from 'vitest';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';
import { WORM_UNLOCK_ORDER, WORM_LEVELS_PER_UNLOCK, characterUnlockLevels, wormLevelsCompleted, isCharacterUnlocked,
  earnedCharacterItems, nextCharacterUnlock, syncCharacterUnlocks, grantCharacterUnlocks } from '../worm/wormUnlocks.js';
import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { chestPool, CHEST_TIERS } from '../economy/chests.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';

const cleared = (ids, stars = 1) => ({ ...newProgress(), wormStory: { stars: Object.fromEntries(ids.map(id => [id, stars])), claimed: {} } });
const firstN = n => cleared(Array.from({ length: n }, (_, i) => i + 1));

describe('worm unlocks', () => {
  it('orders every character once, Classic free and one more every ten levels', () => {
    expect([...WORM_UNLOCK_ORDER].sort()).toEqual(WORM_CHARACTERS.map(c => c.id).sort());
    expect(WORM_UNLOCK_ORDER[0]).toBe('classic');
    expect(WORM_UNLOCK_ORDER.map(characterUnlockLevels)).toEqual(WORM_UNLOCK_ORDER.map((_, i) => i * WORM_LEVELS_PER_UNLOCK));
    expect(characterUnlockLevels('nobody')).toBeNull();
    // The campaign is long enough to earn every worm.
    expect(WORM_STORY_LEVELS.length).toBeGreaterThanOrEqual(characterUnlockLevels(WORM_UNLOCK_ORDER.at(-1)));
  });

  it('counts cleared levels, in any order, ignoring zero-star entries', () => {
    expect(wormLevelsCompleted(newProgress())).toBe(0);
    expect(wormLevelsCompleted(undefined)).toBe(0);
    expect(wormLevelsCompleted(cleared([3, 40, 77]))).toBe(3);
    expect(wormLevelsCompleted({ wormStory: { stars: { 1: 2, 2: 0 } } })).toBe(1);
  });

  it('unlocks exactly one worm per ten levels cleared', () => {
    expect(earnedCharacterItems(firstN(9))).toEqual(['character_classic']);
    expect(earnedCharacterItems(firstN(10))).toEqual(['character_classic', 'character_inch']);
    expect(earnedCharacterItems(firstN(59))).toHaveLength(6);
    expect(earnedCharacterItems(firstN(60))).toHaveLength(7);
    expect(isCharacterUnlocked(firstN(19), 'glow')).toBe(false);
    expect(isCharacterUnlocked(firstN(20), 'glow')).toBe(true);
    expect(nextCharacterUnlock(firstN(13))).toMatchObject({ character: { id: 'glow' }, levels: 20, remaining: 7 });
    expect(nextCharacterUnlock(firstN(60))).toBeNull();
  });

  it('re-locks ownership to progress on load but only adds after a level', () => {
    const owned = ['skin_royal', 'character_mobi', 'character_prism'];
    expect(syncCharacterUnlocks(owned, firstN(12))).toEqual(['skin_royal', 'character_classic', 'character_inch']);
    expect(grantCharacterUnlocks(owned, firstN(12))).toEqual([...owned, 'character_classic', 'character_inch']);
    const same = ['character_classic'];
    expect(grantCharacterUnlocks(same, firstN(3))).toBe(same);
  });

  it('never sells or rolls a worm, and every chest tier still has rewards', () => {
    for (const tier of CHEST_TIERS.keys()) if (tier) {
      expect(chestPool(tier).length).toBeGreaterThan(0);
      expect(chestPool(tier).some(item => item.type === 'character')).toBe(false);
    }
    expect(STORE_ITEMS.filter(item => item.type === 'character' && item.price > 0)).toEqual([]);
    expect(STORE_ITEMS.some(item => item.type === 'trail' || item.id.startsWith('trail_'))).toBe(false);
  });
});

describe('clearing levels in play', () => {
  const state = () => useGameStore.getState();
  const won = { alive: true, elapsed: 10, cuts: 0, orbs: 18, colors: 6 };
  beforeEach(() => {
    state().clearDisparityGame();
    useGameStore.setState({ parityPoints: 0, ownedItems: ['character_classic'], demoMode: false, wormCharacter: 'classic' });
  });
  const clearLevelOne = () => {
    state().initWormMode(undefined, undefined, 3.5, 1, 30, null, true, true, 1);
    useGameStore.setState({ wormStoryReady: true, wormGamePhase: 'active' });
    state().startWormStory();
    useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
    state().completeWormStory(state().wormRunId, won);
  };

  it('grants the next worm on the tenth cleared level and announces it', () => {
    useGameStore.setState({ playerProgress: cleared([2, 3, 4, 5, 6, 7, 8, 9, 10]) });
    expect(state().setWormCharacter('inch')).toBe(false);
    clearLevelOne();
    expect(state().ownedItems).toContain('character_inch');
    expect(state().wormStoryResult.unlockedCharacter).toBe('inch');
    state().setWormCharacter('inch'); expect(state().wormCharacter).toBe('inch');
  });

  it('announces nothing when a level does not reach the next ten', () => {
    useGameStore.setState({ playerProgress: cleared([2, 3]) });
    clearLevelOne();
    expect(state().ownedItems).toEqual(['character_classic']);
    expect(state().wormStoryResult.unlockedCharacter).toBeUndefined();
  });
});
