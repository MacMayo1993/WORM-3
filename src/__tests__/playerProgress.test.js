import { describe, it, expect } from 'vitest';
import { newProgress, addXp, levelProgress, xpForLevel, wormOrbXp, sanitizeProgress, readPlayerSave, savePlayerState, PLAYER_SAVE_KEY, difficultyMultiplier, puzzleMode, puzzleFingerprint } from '../progression/model.js';
import { availableRewards, rewardChoices, REWARD_LEVELS } from '../progression/rewards.js';
import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

describe('permanent player levels', () => {
  it('uses the progressive curve at all 49 boundaries, with a level-50 cap', () => {
    expect(levelProgress(0)).toMatchObject({level:1,current:0,needed:100});
    for (let l=2;l<=50;l++) {
      const threshold=xpForLevel(l);
      expect(levelProgress(threshold-1).level).toBe(l-1);
      expect(levelProgress(threshold).level).toBe(l);
      expect(threshold-xpForLevel(l-1)).toBe(100+25*(l-2));
    }
    expect(xpForLevel(50)).toBe(34300);
    expect(levelProgress(100000)).toMatchObject({level:50,max:true,fraction:1});
    for (const invalid of [NaN,Infinity,undefined,-20]) expect(xpForLevel(invalid)).toBe(0);
  });
  it('pays all crossed levels once and never subtracts XP when points are spent', () => {
    const grant=addXp(newProgress(),xpForLevel(5),'worm');
    expect(grant.points).toBe(100);
    expect(grant.progress.modeXp.worm).toBe(xpForLevel(5));
    expect(addXp(grant.progress,1,'teach').points).toBe(0);
    for (const invalid of [NaN,Infinity,-20,2.5,'30']) expect(addXp(grant.progress,invalid,'worm').amount).toBe(0);
    expect(addXp(grant.progress,30,'holonomy').amount).toBe(0);
  });
  it('keeps counting total XP at the cap without more level payouts', () => {
    const p={...newProgress(),xp:xpForLevel(50)};
    expect(addXp(p,100,'worm')).toMatchObject({points:0,amount:100});
  });
  it('bounds orb XP equally on normal and Mega boards', () => {
    expect([0,1,20,21,22,80,9999].map(wormOrbXp)).toEqual([0,2,40,40,41,70,70]);
  });
  it.each([['easy',1],['medium',1.2],['hard',1.4],['expert',1.4],['master',1.4]])('scales %s modestly', (difficulty,value) => {
    expect(difficultyMultiplier(difficulty)).toBe(value);
  });
  it('classifies every retained puzzle mode without retired routes', () => {
    expect(puzzleMode({currentLevel:1,activePackId:'story-campaign'})).toBe('story');
    expect(puzzleMode({currentLevel:101,activePackId:'cube-academy'})).toBe('cube');
    expect(puzzleMode({currentLevel:201,activePackId:'algorithm-codex'})).toBe('codex');
    expect(puzzleMode({currentLevelData:{dailyKey:'2026-09-15'}})).toBe('daily');
    expect(puzzleMode({})).toBe('freeplay');
    expect(puzzleMode({randomMode:true})).toBe('random');
    expect(puzzleMode({settings:{biomeMode:{enabled:true}}})).toBe('biome');
  });
  it('fingerprints the arrangement independently of object property order', () => {
    const c=rotateSliceCubies(makeCubies(3),3,'row',2,1);
    const clone=structuredClone(c);
    for (const plane of clone) for (const row of plane) for (const cube of row) cube.stickers=Object.fromEntries(Object.entries(cube.stickers).reverse());
    expect(puzzleFingerprint(c,3)).toBe(puzzleFingerprint(clone,3));
    expect(puzzleFingerprint(c,3)).not.toBe(puzzleFingerprint(makeCubies(3),3));
  });
});

describe('level reward choices', () => {
  it.each(REWARD_LEVELS)('offers only real, unique rewards at level %i', level => {
    const choices=rewardChoices(level);
    expect(new Set(choices.map(c=>c.id)).size).toBe(choices.length);
    expect(choices.at(-1).id).toBe('points');
    for (const c of choices) for (const id of c.items) expect(STORE_ITEMS.find(i=>i.id===id),id).toBeTruthy();
    expect(choices.length).toBe(level===50?3:5);
  });
  it('offers alternatives to owned cosmetics and points when the catalogue is owned', () => {
    const owned=rewardChoices(5).flatMap(c=>c.items);
    expect(rewardChoices(5,owned).flatMap(c=>c.items).some(id=>owned.includes(id))).toBe(false);
    for (const level of REWARD_LEVELS) expect(rewardChoices(level,STORE_ITEMS.map(i=>i.id))).toHaveLength(1);
  });
  it('supports partial ownership of the final bundles', () => {
    const owned=['skin_galaxy','scheme_cosmic'];
    const bundle=rewardChoices(50,owned).find(c=>c.id==='singularity-worm');
    expect(bundle.newItems).toEqual(['hat_halo']);
  });
  it('only exposes earned, unclaimed milestones', () => {
    const p={...newProgress(),xp:xpForLevel(15),claimedRewards:{5:'points'}};
    expect(availableRewards(p)).toEqual([10,15]);
    expect(rewardChoices(3)).toEqual([]);
  });
});

describe('atomic player save', () => {
  it('roundtrips XP, spent wallet, claims and ownership together', () => {
    const progress={...newProgress(),xp:xpForLevel(5),claimedRewards:{5:'hat_party'},challenges:[{key:'freeplay:3:111',times:2,guided:true}]};
    const state={playerProgress:progress,parityPoints:7,ownedItems:['hat_party','skin_slime']};
    expect(savePlayerState(state,localStorage)).toBe(true);
    const save=readPlayerSave(localStorage);
    expect(save).toMatchObject({progress,points:7,ownedItems:state.ownedItems,chestWallet:{gems:20,rolls:0},legacyCharacters:false});
    expect(addXp(save.progress,1,'worm').points).toBe(0);
    expect(availableRewards(save.progress)).toEqual([]);
  });
  it('recovers malformed or unavailable storage without throwing', () => {
    for (const raw of ['bad','null','{}','{"version":99}','{"version":1,"progress":{},"points":-2,"ownedItems":[]}']) {
      localStorage.setItem(PLAYER_SAVE_KEY,raw); expect(readPlayerSave(localStorage)).toBeNull();
    }
    const storage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
    expect(readPlayerSave(storage)).toBeNull();
    expect(savePlayerState({},storage)).toBe(false);
  });
  it('bounds saved history, validates numbers and discards locked claims', () => {
    const p=sanitizeProgress({xp:100,modeXp:{worm:NaN,coop:100},claimedRewards:{5:'points'},milestones:{'teach:a:0':1,bad:-1},challenges:Array.from({length:100},(_,i)=>({key:`test:${i}`,times:500})),bests:{'level:1':NaN}});
    expect(p.modeXp).toEqual({}); expect(p.claimedRewards).toEqual({});
    expect(p.challenges).toHaveLength(64); expect(p.challenges[0].times).toBe(3);
    expect(p.milestones).toEqual({'teach:a:0':1}); expect(p.bests).toEqual({});
    expect(sanitizeProgress(null)).toEqual(newProgress());
  });
});
