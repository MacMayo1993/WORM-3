import { beforeEach, afterEach, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubEnv('DEV', false); localStorage.clear(); });
afterEach(() => vi.unstubAllEnvs());
it('starts production players with Classic and a one-time twenty-gem wallet', async () => {
  const { persistedState: s } = await import('../hooks/storeSlices/persistedState.js');
  expect(s.ownedItems).toContain('character_classic'); expect(s.ownedItems).not.toContain('character_mobi');
  expect(s.chestWallet.gems).toBe(20); expect(s.wormCharacter).toBe('classic');
});
const clearedLevels = n => ({ stars: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 1])), claimed: {} });
it.each([false, true])('re-locks worms granted before levels earned them, even with damaged settings: %s', async broken => {
  localStorage.setItem('worm3_player_progress_v1', JSON.stringify({ version: 1, progress: { xp: 0, wormStory: clearedLevels(23) }, points: 80,
    ownedItems: ['skin_royal', 'character_mobi', 'character_prism', 'trail_comet'] }));
  localStorage.setItem('worm3_character', 'mobi');
  if (broken) localStorage.setItem('worm3_settings', '{');
  const { persistedState: s } = await import('../hooks/storeSlices/persistedState.js');
  // 23 levels cleared earns Classic, Inch Worm and Glow Worm.
  expect(s.ownedItems.filter(id => id.startsWith('character_')).sort()).toEqual(['character_classic', 'character_glow', 'character_inch']);
  expect(s.ownedItems).toContain('skin_royal'); expect(s.ownedItems).not.toContain('trail_comet');
  expect(s.wormCharacter).toBe('classic');
  expect(s.chestWallet.gems).toBe(20);
});
it('keeps an empty gem wallet empty and rejects an unowned saved character', async () => {
  localStorage.setItem('worm3_player_progress_v1', JSON.stringify({ version: 1, progress: { xp: 0 }, points: 0, ownedItems: ['character_classic'], chestWallet: { version: 1, gems: 0, rolls: 3, history: [] } }));
  localStorage.setItem('worm3_character', 'mobi');
  const { persistedState: s } = await import('../hooks/storeSlices/persistedState.js');
  expect(s.chestWallet.gems).toBe(0); expect(s.wormCharacter).toBe('classic'); expect(s.ownedItems).not.toContain('character_mobi');
});

it('loads owned accessory slots without disturbing an existing hat', async () => {
  localStorage.setItem('worm3_player_progress_v1', JSON.stringify({version:1,progress:{xp:0},points:0,
    ownedItems:['hat_tophat','accessory_seedSatchel','accessory_ribbonTail']}));
  localStorage.setItem('worm3_hat','tophat');
  localStorage.setItem('worm3_accessories',JSON.stringify({face:'buttonGoggles',body:'seedSatchel',tail:'ribbonTail',neck:'seedSatchel'}));
  const {persistedState:s}=await import('../hooks/storeSlices/persistedState.js');
  expect(s.wormHat).toBe('tophat');
  expect(s.wormAccessories).toEqual({face:'none',neck:'none',body:'seedSatchel',tail:'ribbonTail'});
});
it('ignores damaged accessory storage without resetting the player wallet', async () => {
  localStorage.setItem('worm3_player_progress_v1',JSON.stringify({version:1,progress:{xp:0},points:71,ownedItems:['character_classic']}));
  localStorage.setItem('worm3_accessories','{');
  const {persistedState:s}=await import('../hooks/storeSlices/persistedState.js');
  expect(s.parityPoints).toBe(71);
  expect(s.wormAccessories).toEqual({face:'none',neck:'none',body:'none',tail:'none'});
});
