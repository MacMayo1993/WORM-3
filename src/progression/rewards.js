import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { levelProgress, playerRank } from './model.js';

const THEMES = {
  5: ['hat_party', 'skin_cherry', 'tile_neckerFlip', 'scheme_reef'],
  10: ['tile_infinityTunnel', 'tile_drosteSpiral', 'skin_void', 'scheme_cosmic'],
  15: ['hat_flower', 'skin_emerald', 'tile_crystalGrowth', 'scheme_tropical'],
  20: ['tile_cymatics', 'tile_compass', 'skin_toxic', 'scheme_bioluminescence'],
  25: ['hat_wizard', 'skin_bubble', 'tile_paradoxWeave', 'scheme_aurora'],
  30: ['tile_mobiusBand', 'tile_rp2Geodesics', 'skin_sunset', 'scheme_eclipse'],
  35: ['hat_halo', 'skin_ice', 'tile_hyperbolicWeave', 'scheme_arctic'],
  40: ['tile_orbChamber', 'tile_paintedWindow', 'skin_galaxy', 'scheme_deepsea'],
  45: ['hat_crown', 'skin_gold', 'tile_stellarLensing', 'scheme_gemstone'],
};
export const REWARD_LEVELS = Array.from({ length: 10 }, (_, i) => (i + 1) * 5);
export function rewardTitle(level) {
  return level % 10 === 0 ? playerRank(level) : 'Choose your next look';
}
export function rewardChoices(level, ownedItems = []) {
  if (!REWARD_LEVELS.includes(level)) return [];
  const owned = new Set(ownedItems);
  if (level === 50) {
    const bundles = [
      { id: 'singularity-cube', label: 'Singularity Cube', items: ['tile_hopfFibers', 'tile_rp2Geodesics', 'scheme_cosmic'] },
      { id: 'singularity-worm', label: 'Singularity Worm', items: ['skin_galaxy', 'hat_halo', 'scheme_cosmic'] },
    ].map(b => ({ ...b, newItems: b.items.filter(id => !owned.has(id)) })).filter(b => b.newItems.length);
    return [...bundles, { id: 'points', label: '450 Parity Points', points: 450, items: [] }];
  }
  const used = new Set();
  const options = THEMES[level].map(id => {
    const preferred = STORE_ITEMS.find(item => item.id === id);
    const item = !owned.has(id) ? preferred : STORE_ITEMS.find(item => item.type === preferred?.type && item.price > 0 && !owned.has(item.id) && !used.has(item.id));
    if (!item || used.has(item.id)) return null;
    used.add(item.id);
    return { id: item.id, label: item.label, items: [item.id], item };
  }).filter(Boolean);
  // Always offer a clear alternative, including when a long-time player owns
  // the entire catalogue. Never silently give a duplicate cosmetic.
  return [...options, { id: 'points', label: '150 Parity Points', points: 150, items: [] }];
}
export function availableRewards(progress) {
  const level = levelProgress(progress.xp).level;
  return REWARD_LEVELS.filter(n => n <= level && !progress.claimedRewards[n]);
}
