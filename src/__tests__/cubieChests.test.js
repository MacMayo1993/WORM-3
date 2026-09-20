import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { CHEST_MODES, CHEST_TIERS, chestOdds, chestItemTier, chestPool, drawChestFace, resolveChestFaces, rollChest, newChestWallet, sanitizeChestWallet } from '../economy/chests.js';
import { STORE_ITEMS, DEFAULT_OWNED } from '../utils/storeCatalog.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, xpForLevel, savePlayerState, readPlayerSave, PLAYER_SAVE_KEY } from '../progression/model.js';
const state = () => useGameStore.getState();
beforeEach(() => { localStorage.clear(); useGameStore.setState({ playerProgress: newProgress(), chestWallet: newChestWallet(), chestRolling: false, parityPoints: 200, ownedItems: [...DEFAULT_OWNED], demoMode: false }); });
afterEach(() => vi.restoreAllMocks());
it.each(Array.from({ length: 36 }, (_, n) => [Math.floor(n / 6), n % 6]))('resolves paired faces %i and %i using the lower tier or a capped upgrade', (a, b) => {
  expect(resolveChestFaces([a, b])).toBe(a === b ? Math.min(5, a + 1) : Math.min(a, b));
});
it('calculates the complete distribution exactly and improves mythic odds per gem for paired rolls', () => {
  const expected = [0.32, 0.315, 0.2077, 0.1028, 0.0376, 0.0169];
  const paired = chestOdds('double');
  paired.forEach((p, i) => expect(p).toBeCloseTo(expected[i], 12));
  for (const mode of Object.keys(CHEST_MODES)) {
    expect(CHEST_MODES[mode].weights.reduce((a,b) => a+b, 0)).toBe(10000);
    expect(chestOdds(mode).reduce((a,b) => a+b, 0)).toBeCloseTo(1, 12);
  }
  expect(paired[5] / 15).toBeGreaterThan(chestOdds('single')[5] / 10);
});
it('samples weighted boundaries without biasing endpoints or accepting invalid entropy', () => {
  expect(drawChestFace(CHEST_MODES.single.weights, () => 0)).toBe(0);
  expect(drawChestFace(CHEST_MODES.single.weights, () => .5)).toBe(1);
  expect(drawChestFace(CHEST_MODES.single.weights, () => .99)).toBe(5);
  for (const n of [1, -1, NaN, Infinity]) expect(() => rollChest('single', [], () => n)).toThrow();
  expect(() => resolveChestFaces([6])).toThrow(); expect(() => rollChest('missing', [])).toThrow();
});
it('covers every purchasable catalog item once and guarantees an unowned item within the rolled tier', () => {
  const pools = CHEST_TIERS.slice(1).flatMap((_, i) => chestPool(i+1));
  expect(new Set(pools.map(item => item.id)).size).toBe(pools.length);
  expect(pools.length).toBe(STORE_ITEMS.filter(item => item.price > 0).length);
  for (let tier = 1; tier <= 5; tier++) {
    const pool = chestPool(tier); expect(pool.length).toBeGreaterThan(0);
    const face = CHEST_MODES.single.weights.slice(0, tier).reduce((a,b) => a+b,0) / 10000 + .00001;
    const rng = () => face;
    const owned = pool.slice(1).map(i => i.id);
    const result = rollChest('single', owned, rng);
    expect(result.reward).toEqual({ kind: 'choice', itemIds: [pool[0].id] });
    expect(chestItemTier(pool[0])).toBe(tier);
    expect(rollChest('single', pool.map(i => i.id), rng).reward).toEqual({ kind: 'complete', gems: CHEST_TIERS[tier].compensation });
  }
});
it('commits the result before reveal, prevents double charges and reloads the same receipt', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 0; return array; });
  const result = state().rollCubieChest('single'); expect(result.receipt.tier).toBe(0);
  expect(state()).toMatchObject({ parityPoints: 225, playerProgress: { xp: 25 }, chestWallet: { gems: 10, rolls: 1 }, chestRolling: true });
  const saved = readPlayerSave(); expect(saved.chestWallet.history[0]).toEqual(result.receipt);
  expect(state().rollCubieChest('single').error).toBeTruthy(); expect(state().chestWallet.gems).toBe(10);
  state().finishChestRoll(99); expect(state().chestRolling).toBe(true);
  state().finishChestRoll(result.receipt.id); expect(state().chestRolling).toBe(false);
  expect(sanitizeChestWallet(saved.chestWallet)).toEqual(saved.chestWallet);
});
it('does not spend or grant anything when saving or entropy fails', () => {
  const snapshot = { wallet: state().chestWallet, owned: state().ownedItems, points: state().parityPoints, xp: state().playerProgress.xp };
  const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => { throw new Error('entropy'); });
  expect(state().rollCubieChest('single').error).toBeTruthy(); entropy.mockRestore();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(state().rollCubieChest('double').error).toContain('Could not save');
  expect(state().exchangeChestGems().error).toContain('Could not save');
  expect(state().chestWallet).toBe(snapshot.wallet); expect(state().ownedItems).toBe(snapshot.owned);
  expect(state().parityPoints).toBe(snapshot.points); expect(state().playerProgress.xp).toBe(snapshot.xp);
});
it('claims XP and Story gems only once, exchanges exact amounts and keeps zero balances across reloads', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), xp: xpForLevel(3), wormStory: { stars: { 1: 3, 2: 1 }, claimed: {} } } });
  expect(state().claimChestGems().ok).toBe(true); expect(state().chestWallet.gems).toBe(50);
  expect(state().claimChestGems().error).toBeTruthy(); expect(state().chestWallet.gems).toBe(50);
  state().exchangeChestGems(); expect(state()).toMatchObject({ parityPoints: 100, chestWallet: { gems: 60 } });
  state().exchangeChestGems(); expect(state()).toMatchObject({ parityPoints: 0, chestWallet: { gems: 70 } });
  expect(state().exchangeChestGems().error).toBeTruthy();
  expect(readPlayerSave().chestWallet.gems).toBe(70);
  useGameStore.setState({ chestWallet: { ...state().chestWallet, gems: 0 } });
  expect(readPlayerSave().chestWallet.gems).toBe(0); expect(state().rollCubieChest('single').error).toBeTruthy();
});
it('migrates old saves once, sanitizes malformed records, and retains spent welcome gems', () => {
  localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify({ version: 1, progress: newProgress(), points: 25, ownedItems: ['skin_royal'] }));
  const old = readPlayerSave(); expect(old.legacyCharacters).toBe(true); expect(old.chestWallet.gems).toBe(20);
  savePlayerState({ playerProgress: old.progress, parityPoints: old.points, ownedItems: old.ownedItems, chestWallet: { ...old.chestWallet, gems: 0 } });
  expect(readPlayerSave()).toMatchObject({ legacyCharacters: false, chestWallet: { gems: 0 } });
  const bad = sanitizeChestWallet({ gems: -10, rolls: Infinity, claimedLevel: NaN, claimedStory: [1,1,11,'2'], history: [{ faces: [6] }] });
  expect(bad).toMatchObject({ gems: 0, rolls: 0, claimedLevel: 1, claimedStory: [1], history: [] });
});
it('uses catalog prices, rejects negative/non-finite money, and equips only owned characters outside demos', () => {
  for (const n of [-100, NaN, Infinity, .5]) expect(state().spendCoins(n)).toBe(false);
  for (const n of [-100, NaN, Infinity, Number.MAX_SAFE_INTEGER]) state().earnCoins(n);
  expect(state().parityPoints).toBe(200);
  expect(state().buyItem('missing', -100)).toBe(false);
  expect(state().buyItem('skin_royal', -100)).toBe(true); expect(state().parityPoints).toBe(50);
  useGameStore.setState({ wormCharacter: 'classic' }); state().setWormCharacter('mobi'); expect(state().wormCharacter).toBe('classic');
  useGameStore.setState({ ownedItems: [...state().ownedItems, 'character_mobi'] });
  state().setWormCharacter('mobi'); expect(state().wormCharacter).toBe('mobi');
});
it('persists a mythic choice before granting the selected character exactly once', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = Math.floor(.995 * 4294967296); return array; });
  const { receipt } = state().rollCubieChest('single');
  expect(receipt.tier).toBe(5); expect(receipt.reward.kind).toBe('choice');
  expect(receipt.reward.itemIds).toHaveLength(3);
  const itemId = receipt.reward.itemIds[1];
  expect(readPlayerSave().ownedItems).not.toContain(itemId);
  expect(state().chooseChestReward(receipt.id, itemId).error).toBeTruthy();
  state().finishChestRoll(receipt.id);
  expect(state().rollCubieChest('single').error).toBeTruthy();
  expect(state().chooseChestReward(receipt.id + 1, itemId).error).toBeTruthy();
  expect(state().chooseChestReward(receipt.id, 'character_classic').error).toBeTruthy();
  expect(state().chooseChestReward(receipt.id, itemId).receipt.reward).toEqual({ kind: 'item', itemId });
  expect(readPlayerSave().ownedItems).toContain(itemId);
  expect(state().chooseChestReward(receipt.id, receipt.reward.itemIds[0]).error).toBeTruthy();
  expect(readPlayerSave().ownedItems).not.toContain(receipt.reward.itemIds[0]);
  const character = itemId.replace('character_', ''); state().setWormCharacter(character);
  expect(state().wormCharacter).toBe(character); expect(state().chestWallet.gems).toBe(10);
});

it.each([1, 2, 3, 4, 5])('offers three unique unowned cosmetics in tier %i, or only the remaining choices', tier => {
  const pool = chestPool(tier);
  const face = CHEST_MODES.single.weights.slice(0, tier).reduce((a,b) => a+b,0) / 10000 + .00001;
  const roll = owned => rollChest('single', owned, () => face);
  const offered = roll([pool[0].id]).reward.itemIds;
  expect(offered).toHaveLength(3);
  expect(new Set(offered).size).toBe(3);
  expect(offered).not.toContain(pool[0].id);
  offered.forEach(id => expect(pool.some(item => item.id === id)).toBe(true));
  expect(new Set(roll(pool.slice(2).map(i => i.id)).reward.itemIds)).toEqual(new Set(pool.slice(0,2).map(i => i.id)));
});

it('retains the exact pending options across reload and recovers from a failed claim save', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = Math.floor(.995 * 4294967296); return array; });
  const { receipt } = state().rollCubieChest('single');
  const saved = readPlayerSave();
  useGameStore.setState({ chestWallet: saved.chestWallet, ownedItems: saved.ownedItems, chestRolling: false });
  expect(state().chestWallet.history.at(-1)).toEqual(receipt);
  expect(state().rollCubieChest('double').error).toBeTruthy();
  const failSave = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const itemId = receipt.reward.itemIds[0];
  expect(state().chooseChestReward(receipt.id, itemId).error).toContain('Could not save');
  expect(state().ownedItems).not.toContain(itemId);
  expect(state().chestWallet.history.at(-1)).toEqual(receipt);
  failSave.mockRestore();
  expect(state().chooseChestReward(receipt.id, itemId).receipt.reward.itemId).toBe(itemId);
  expect(readPlayerSave().chestWallet.gems).toBe(10);
});

it('compensates an offered item acquired elsewhere without changing the other saved options', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = Math.floor(.995 * 4294967296); return array; });
  const { receipt } = state().rollCubieChest('single'); state().finishChestRoll(receipt.id);
  const itemId = receipt.reward.itemIds[0];
  useGameStore.setState({ ownedItems: [...state().ownedItems, itemId] });
  expect(state().chooseChestReward(receipt.id, itemId).receipt.reward).toEqual({ kind: 'complete', gems: 15 });
  expect(state().chestWallet.gems).toBe(25);
  expect(state().ownedItems.filter(id => id === itemId)).toHaveLength(1);
  expect(state().chooseChestReward(receipt.id, itemId).error).toBeTruthy();
  expect(state().chestWallet.gems).toBe(25);
});

it('validates saved choices and keeps old awarded receipts non-claimable', () => {
  expect(state().chooseChestReward().error).toBeTruthy();
  const ids = chestPool(5).slice(0,3).map(i => i.id);
  const receipt = { id: 1, mode: 'single', faces: [5], tier: 5, cost: 10, reward: { kind: 'choice', itemIds: ids } };
  const wallet = { ...newChestWallet(), rolls: 1, gems: 10, history: [receipt] };
  expect(sanitizeChestWallet(wallet)).toEqual(wallet);
  for (const badIds of [[], [ids[0], ids[0]], [...ids, chestPool(5)[3].id], ['missing'], [chestPool(1)[0].id]]) {
    expect(sanitizeChestWallet({ ...wallet, history: [{ ...receipt, reward: { kind: 'choice', itemIds: badIds } }] }).history).toEqual([]);
  }
  const legacy = { ...receipt, reward: { kind: 'item', itemId: ids[0] } };
  useGameStore.setState({ chestWallet: sanitizeChestWallet({ ...wallet, history: [legacy] }) });
  expect(state().chestWallet.history[0]).toEqual(legacy);
  expect(state().chooseChestReward(1, ids[0]).error).toBeTruthy();
});
