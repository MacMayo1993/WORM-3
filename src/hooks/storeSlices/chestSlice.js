import { persistedState } from './persistedState.js';
import { addXp, levelProgress, savePlayerState } from '../../progression/model.js';
import { CHEST_MODES, GEM_EXCHANGE, GEM_LEVEL_REWARD, GEM_STORY_REWARD, newChestWallet, rollChest } from '../../economy/chests.js';

export function pendingGemRewards(state) {
  const wallet = state.chestWallet ?? newChestWallet();
  const level = levelProgress(state.playerProgress.xp).level;
  const story = Object.entries(state.playerProgress.wormStory?.stars ?? {}).filter(([, stars]) => stars > 0).map(([id]) => Number(id));
  return { level, story, amount: Math.max(0, level - wallet.claimedLevel) * GEM_LEVEL_REWARD + story.filter(id => !wallet.claimedStory.includes(id)).length * GEM_STORY_REWARD };
}
export const createChestSlice = (set, get) => {
  // Persist cost, outcome and ownership together before starting the animation.
  // Closing/reloading reveals the same receipt; there is no second claim action.
  const commit = patch => {
    const next = { ...get(), ...patch };
    if (!savePlayerState(next)) return { error: 'Could not save. No currency was spent. Please try again.' };
    set(patch); return { ok: true };
  };
  return {
    chestWallet: persistedState.chestWallet,
    chestRolling: false,
    rollCubieChest: mode => {
      const s = get(), def = CHEST_MODES[mode];
      if (!def || s.chestRolling || s.demoMode) return { error: 'Finish the current roll before rolling again.' };
      if (s.chestWallet.gems < def.cost) return { error: `Need ${def.cost - s.chestWallet.gems} more gems.` };
      let receipt;
      try { receipt = { ...rollChest(mode, s.ownedItems), id: s.chestWallet.rolls + 1 }; }
      catch { return { error: 'The roll could not start. No gems were spent.' }; }
      const reward = receipt.reward;
      const grant = addXp(s.playerProgress, reward.xp ?? 0, 'chests');
      const patch = { chestRolling: true, chestWallet: { ...s.chestWallet,
        gems: s.chestWallet.gems - def.cost + (reward.gems ?? 0), rolls: receipt.id,
        history: [...s.chestWallet.history, receipt].slice(-20) },
        playerProgress: grant.progress, parityPoints: s.parityPoints + (reward.points ?? 0) + grant.points,
        ownedItems: reward.kind === 'item' ? [...s.ownedItems, reward.itemId] : s.ownedItems };
      const result = commit(patch);
      return result.ok ? { receipt } : result;
    },
    finishChestRoll: id => { if (get().chestWallet.history.at(-1)?.id === id) set({ chestRolling: false }); },
    exchangeChestGems: () => {
      const s = get();
      if (s.chestRolling || s.demoMode || s.parityPoints < GEM_EXCHANGE.points) return { error: `Exchange requires ${GEM_EXCHANGE.points} Parity Points.` };
      return commit({ parityPoints: s.parityPoints - GEM_EXCHANGE.points, chestWallet: { ...s.chestWallet, gems: s.chestWallet.gems + GEM_EXCHANGE.gems } });
    },
    claimChestGems: () => {
      const s = get(), pending = pendingGemRewards(s);
      if (s.chestRolling || s.demoMode || !pending.amount) return { error: 'Earn gems through XP levels and Story clears.' };
      return commit({ chestWallet: { ...s.chestWallet, gems: s.chestWallet.gems + pending.amount,
        claimedLevel: Math.max(s.chestWallet.claimedLevel, pending.level), claimedStory: [...new Set([...s.chestWallet.claimedStory, ...pending.story])] } });
    },
  };
};
